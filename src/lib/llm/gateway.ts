import * as crypto from 'crypto';
import {
  GatewayRequest,
  GatewayResponse,
  GatewayMetrics,
  GatewayHealth,
  LLMResponse
} from './types';
import { ProviderResolver } from './resolver';
import { llmConfig } from './config';
import { estimateTokens } from '../reflection/context-assembly';

export class GatewayError extends Error {
  constructor(
    public type: 'timeout' | 'unavailable' | 'rate_limited' | 'invalid_response' | 'cancelled' | 'unauthorized' | 'unknown',
    message: string
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

// Global in-memory registries for Health and Circuit Breaker states
const HEALTH_REGISTRY = new Map<string, GatewayHealth>();
const CIRCUIT_COOLDOWNS = new Map<string, number>();

export class LLMGateway {
  private resolver = new ProviderResolver();

  /**
   * Recalculates prompt package checksum to ensure integrity.
   */
  private validateChecksum(request: GatewayRequest): void {
    const pkg = request.promptPackage;
    if (!pkg) {
      throw new GatewayError('invalid_response', 'LLMGateway: Prompt package is missing.');
    }

    const rawString = pkg.sections
      .map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`)
      .join('|');
    const calculated = crypto.createHash('sha256').update(rawString).digest('hex');

    if (calculated !== pkg.checksum) {
      throw new GatewayError('invalid_response', 'LLMGateway: Prompt package checksum validation failed.');
    }
  }

  /**
   * Helper to map provider exceptions to standardized Gateway errors.
   */
  private mapError(error: any): GatewayError {
    const msg = error.message || String(error);
    const lower = msg.toLowerCase();

    if (lower.includes('timeout') || lower.includes('deadline')) {
      return new GatewayError('timeout', 'LLM request timed out.');
    }
    if (lower.includes('rate') || lower.includes('limit') || lower.includes('429')) {
      return new GatewayError('rate_limited', 'LLM rate limit reached.');
    }
    if (lower.includes('auth') || lower.includes('key') || lower.includes('unauthorized') || lower.includes('permission')) {
      return new GatewayError('unauthorized', 'LLM request failed authentication or authorization.');
    }
    if (lower.includes('503') || lower.includes('network') || lower.includes('connect') || lower.includes('unavailable')) {
      return new GatewayError('unavailable', 'LLM service is unavailable.');
    }
    if (lower.includes('invalid') || lower.includes('parse') || lower.includes('json')) {
      return new GatewayError('invalid_response', 'LLM returned an invalid response.');
    }
    if (lower.includes('abort') || lower.includes('cancel')) {
      return new GatewayError('cancelled', 'LLM request was cancelled.');
    }

    return new GatewayError('unknown', `LLM request failed: ${msg}`);
  }

  /**
   * Determine if an error is retryable.
   */
  private isRetryable(error: GatewayError): boolean {
    // Only retry timeouts, rate limits (optional retry), and service unavailabilities (except auth errors)
    return error.type === 'timeout' || error.type === 'unavailable' || error.type === 'rate_limited';
  }

  /**
   * Checks the Circuit Breaker status for a provider.
   * Resets status to healthy if cooldown period (30s) has expired.
   */
  private checkCircuitBreaker(providerId: string): void {
    const cooldownEnd = CIRCUIT_COOLDOWNS.get(providerId);
    if (cooldownEnd) {
      if (Date.now() > cooldownEnd) {
        // Cooldown period expired, reset circuit
        CIRCUIT_COOLDOWNS.delete(providerId);
        const health = HEALTH_REGISTRY.get(providerId);
        if (health) {
          health.status = 'healthy';
          health.consecutiveFailures = 0;
        }
      } else {
        throw new GatewayError('unavailable', `LLMGateway: Circuit open for provider '${providerId}'. Request blocked.`);
      }
    }
  }

  /**
   * Record failure and trigger Circuit Breaker if threshold (3) is exceeded.
   */
  private recordFailure(providerId: string): void {
    let health = HEALTH_REGISTRY.get(providerId);
    if (!health) {
      health = { providerId, status: 'healthy', lastSuccess: 0, consecutiveFailures: 0, averageLatency: 0 };
      HEALTH_REGISTRY.set(providerId, health);
    }

    health.consecutiveFailures++;
    if (health.consecutiveFailures >= 3) {
      health.status = 'unhealthy';
      CIRCUIT_COOLDOWNS.set(providerId, Date.now() + 30000); // 30s cooldown
      console.warn(`[LLMGateway] Circuit breaker TRIPPED for provider '${providerId}'. Circuit is now OPEN for 30s.`);
    }
  }

  /**
   * Record successful execution.
   */
  private recordSuccess(providerId: string, latency: number): void {
    let health = HEALTH_REGISTRY.get(providerId);
    if (!health) {
      health = { providerId, status: 'healthy', lastSuccess: 0, consecutiveFailures: 0, averageLatency: 0 };
      HEALTH_REGISTRY.set(providerId, health);
    }

    health.lastSuccess = Date.now();
    health.consecutiveFailures = 0;
    health.status = 'healthy';
    health.averageLatency = health.averageLatency === 0 ? latency : (health.averageLatency * 0.8 + latency * 0.2);
  }

  /**
   * Execute prompt package request deterministically.
   */
  public async generate(request: GatewayRequest): Promise<GatewayResponse> {
    const requestId = crypto.randomUUID();
    console.log(`[LLMGateway] [${requestId}] Step: Request`);

    // 1. Check sum & validation
    this.validateChecksum(request);

    const pkg = request.promptPackage;
    if (pkg.isIncomplete) {
      throw new GatewayError('invalid_response', 'LLMGateway: Cannot execute. Prompt package is incomplete.');
    }

    // Required sections validation
    const requiredTypes = ['system', 'identity', 'personality', 'conversation', 'response_plan', 'instructions'];
    const hasAllRequired = requiredTypes.every(type => pkg.sections.some(s => s.type === type));
    if (!hasAllRequired) {
      throw new GatewayError('invalid_response', 'LLMGateway: Missing required prompt sections.');
    }

    console.log(`[LLMGateway] [${requestId}] Step: Prompt Validated`);

    // 2. Resolve Provider
    const capabilities = {
      supportsStreaming: pkg.providerHints?.supportsStreaming ?? true,
      supportsVision: pkg.providerHints?.supportsVision ?? false,
      supportsReasoning: pkg.providerHints?.supportsReasoning ?? false
    };

    const providers = this.resolver.resolveCandidates(capabilities, HEALTH_REGISTRY, request.providerId);
    let lastGatewayError: GatewayError | null = null;
    for (const provider of providers) {
      const providerId = provider.id;
      const config = llmConfig.providers[providerId];
      if (!config) {
        lastGatewayError = new GatewayError('unavailable', `LLMGateway: Missing configuration for provider '${providerId}'.`);
        continue;
      }

      if (provider.isConfigured && !provider.isConfigured()) {
        if (request.providerId) {
          throw new GatewayError('unauthorized', `LLMGateway: Provider '${providerId}' failed authentication or authorization (unconfigured or missing API credentials).`);
        }
        console.warn(`[LLMGateway] [${requestId}] Provider '${providerId}' is unconfigured (missing API credentials). Skipping to next candidate.`);
        lastGatewayError = new GatewayError('unauthorized', `LLMGateway: Provider '${providerId}' failed authentication or authorization (unconfigured or missing API credentials).`);
        continue;
      }

      const supportsReasoning = pkg.providerHints?.supportsReasoning ?? false;
      const targetModel = request.model || ((supportsReasoning && config.reasoningModel)
        ? config.reasoningModel
        : config.model);
      const expectedOutputTokens = request.maxTokens ?? config.maxTokens;
      const totalEstimatedTokens = pkg.estimatedTokens + expectedOutputTokens;
      if (totalEstimatedTokens > config.maxTokenLimit) {
        throw new GatewayError('invalid_response', `LLMGateway: Token budget exceeded. Estimated: ${totalEstimatedTokens}, Limit: ${config.maxTokenLimit}`);
      }

      try {
        this.checkCircuitBreaker(providerId);
      } catch (error: any) {
        lastGatewayError = this.mapError(error);
        console.warn(`[LLMGateway] [${requestId}] Circuit open for provider '${providerId}'. Skipping to next candidate.`);
        continue;
      }

      const maxRetries = config.retryCount || 3;
      const timeoutMs = config.timeoutMs || 5000;
      const startTime = Date.now();

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[LLMGateway] [${requestId}] Step: Request Started (provider=${providerId}, model=${targetModel}, attempt=${attempt}/${maxRetries}, estTokens=${pkg.estimatedTokens})`);
          const execPromise = provider.generate({
            promptPackage: pkg,
            temperature: request.temperature ?? config.temperature,
            maxTokens: expectedOutputTokens,
            model: targetModel
          });
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), timeoutMs);
          });
          const response = await Promise.race([execPromise, timeoutPromise]) as LLMResponse;
          const latency = Date.now() - startTime;
          this.recordSuccess(providerId, latency);

          return {
            requestId,
            text: response.text,
            metrics: {
              providerId,
              modelId: targetModel,
              finishReason: response.finishReason,
              promptTokens: response.promptTokens,
              completionTokens: response.completionTokens,
              totalTokens: response.promptTokens + response.completionTokens,
              latency,
              retries: attempt - 1,
              timeoutMs,
              gatewayVersion: 'v1.1.0'
            },
            streamed: false
          };
        } catch (error: any) {
          const mappedErr = this.mapError(error);
          lastGatewayError = mappedErr;
          console.warn(`[LLMGateway] [${requestId}] Step: Request Failed (provider=${providerId}, model=${targetModel}, attempt=${attempt}/${maxRetries}, error=${mappedErr.message}, status=failure)`);

          if (mappedErr.type === 'unauthorized') {
            this.recordFailure(providerId);
            if (request.providerId) {
              throw mappedErr;
            }
            console.warn(`[LLMGateway] [${requestId}] Provider '${providerId}' authentication failed. Skipping to next candidate.`);
            break;
          }

          if (!this.isRetryable(mappedErr) || attempt === maxRetries) {
            this.recordFailure(providerId);
            break;
          }
        }
      }
    }

    throw lastGatewayError || new GatewayError('unknown', 'LLMGateway: Every configured provider failed.');
  }
}
