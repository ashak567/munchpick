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

    const provider = this.resolver.resolve(capabilities, HEALTH_REGISTRY, request.providerId);
    const providerId = provider.id;
    console.log(`[LLMGateway] [${requestId}] Step: Provider Selected (id=${providerId})`);

    // Circuit Breaker check
    this.checkCircuitBreaker(providerId);

    const config = llmConfig.providers[providerId];
    if (!config) {
      throw new GatewayError('unavailable', `LLMGateway: Missing configuration for provider '${providerId}'.`);
    }

    // 3. Token Budget Validation
    const expectedOutputTokens = request.maxTokens ?? config.maxTokens;
    const totalEstimatedTokens = pkg.estimatedTokens + expectedOutputTokens;

    if (totalEstimatedTokens > config.maxTokenLimit) {
      throw new GatewayError(
        'invalid_response',
        `LLMGateway: Token budget exceeded. Estimated: ${totalEstimatedTokens}, Limit: ${config.maxTokenLimit}`
      );
    }

    // 4. Request Execution with Resiliency Policies (Retry & Timeout)
    const maxRetries = config.retryCount || 3;
    const timeoutMs = config.timeoutMs || 5000;
    let attempt = 0;
    let lastGatewayError: GatewayError | null = null;
    const startTime = Date.now();

    while (attempt < maxRetries) {
      attempt++;
      try {
        console.log(`[LLMGateway] [${requestId}] Step: Provider Sent (attempt=${attempt}/${maxRetries})`);

        const execPromise = provider.generate({
          promptPackage: pkg,
          temperature: request.temperature ?? config.temperature,
          maxTokens: expectedOutputTokens
        });

        // Race execution against a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), timeoutMs);
        });

        const response = await Promise.race([execPromise, timeoutPromise]) as LLMResponse;
        const latency = Date.now() - startTime;

        console.log(`[LLMGateway] [${requestId}] Step: Provider Returned (latency=${latency}ms)`);

        // Record health success stats
        this.recordSuccess(providerId, latency);

        const metrics: GatewayMetrics = {
          providerId,
          modelId: config.model,
          finishReason: response.finishReason,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.promptTokens + response.completionTokens,
          latency,
          retries: attempt - 1,
          timeoutMs,
          gatewayVersion: 'v1.0.0'
        };

        console.log(`[LLMGateway] [${requestId}] Step: Completed`);

        return {
          requestId,
          text: response.text,
          metrics,
          streamed: false
        };
      } catch (err: any) {
        const mappedErr = this.mapError(err);
        lastGatewayError = mappedErr;

        console.warn(`[LLMGateway] [${requestId}] Attempt ${attempt} failed: ${mappedErr.message}`);

        // Only retry retryable errors
        if (!this.isRetryable(mappedErr)) {
          this.recordFailure(providerId);
          throw mappedErr;
        }

        // Record failure in health registry
        if (attempt >= maxRetries) {
          this.recordFailure(providerId);
        }
      }
    }

    throw lastGatewayError || new GatewayError('unknown', 'LLMGateway request failed.');
  }
}
