import { PromptPackage, ProviderHints } from '../reflection/types';

export interface LLMRequest {
  promptPackage: PromptPackage;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMResponse {
  text: string;
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
}

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
}

export interface LLMProvider {
  id: string;
  validateCapabilities(capabilities: ProviderCapabilities): boolean;
  isConfigured?(): boolean;
  generate(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncGenerator<string, void, unknown>;
}

export interface GatewayRequest {
  promptPackage: PromptPackage;
  providerId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GatewayMetrics {
  providerId: string;
  modelId: string;
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latency: number;
  retries: number;
  timeoutMs: number;
  gatewayVersion: string;
  initialProvider?: string;
  continuationProvider?: string;
  continuationAttempted?: boolean;
  initialFinishReason?: string;
  finalFinishReason?: string;
  continuationCount?: number;
  finalResponseLength?: number;
}

export interface GatewayResponse {
  requestId: string;
  text: string;
  metrics: GatewayMetrics;
  streamed: boolean;
  executionMetadata?: Record<string, unknown>;
}

export interface GatewayHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastSuccess: number;
  consecutiveFailures: number;
  averageLatency: number;
}
