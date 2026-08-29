import { serverEnv } from '@/lib/env';

export type ModelRole = 'conversational' | 'reasoning' | 'auxiliary';

export interface ProviderConfig {
  model: string;
  reasoningModel?: string;
  auxiliaryModel?: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retryCount: number;
  maxTokenLimit: number;
}

export interface LLMConfig {
  defaultProvider: string;
  fallbackProviders: string[];
  providers: Record<string, ProviderConfig>;
}

export const APPROVED_MODELS = {
  gemini: {
    conversational: 'gemini-2.5-flash',
    reasoning: 'gemini-2.5-flash',
    auxiliary: 'gemini-3.1-flash-lite'
  },
  groq: {
    conversational: 'llama-3.1-8b-instant'
  },
  openrouter: {
    conversational: 'openrouter/free'
  }
} as const;

export const DEPRECATED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
  'gemini-1.0',
  'gemini-pro',
  'gemini-1.0-pro',
  'gemini-ultra',
  'claude-3-5-sonnet-20241022',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-haiku-20241022',
  'gpt-4o',
  'gpt-4o-mini',
  'o1-mini',
  'deepseek-chat',
  'deepseek-reasoner'
]);

export function sanitizeOrValidateModel(
  modelInput: string | undefined,
  fallback: string
): string {
  if (!modelInput || typeof modelInput !== 'string') return fallback;
  const trimmed = modelInput.trim();
  if (DEPRECATED_MODELS.has(trimmed.toLowerCase())) {
    console.warn(`[LLMConfig] Deprecated model '${trimmed}' detected. Sanitizing to approved fallback '${fallback}'.`);
    return fallback;
  }
  return trimmed;
}

export function getApprovedGeminiModel(role: ModelRole = 'conversational'): string {
  const gemini = llmConfig?.providers?.gemini;
  if (role === 'reasoning') {
    return sanitizeOrValidateModel(gemini?.reasoningModel, APPROVED_MODELS.gemini.reasoning);
  }
  if (role === 'auxiliary') {
    return sanitizeOrValidateModel(gemini?.auxiliaryModel, APPROVED_MODELS.gemini.auxiliary);
  }
  return sanitizeOrValidateModel(gemini?.model, APPROVED_MODELS.gemini.conversational);
}

const fallbackProviders = (serverEnv?.LLM_FALLBACK_PROVIDERS || 'groq,openrouter')
  .split(',')
  .map(provider => provider.trim().toLowerCase())
  .filter(Boolean);

export const llmConfig: LLMConfig = {
  defaultProvider: serverEnv?.LLM_DEFAULT_PROVIDER || 'gemini',
  fallbackProviders,
  providers: {
    gemini: {
      model: sanitizeOrValidateModel(serverEnv?.GEMINI_MODEL, APPROVED_MODELS.gemini.conversational),
      reasoningModel: sanitizeOrValidateModel(serverEnv?.GEMINI_REASONING_MODEL, APPROVED_MODELS.gemini.reasoning),
      auxiliaryModel: sanitizeOrValidateModel(serverEnv?.GEMINI_AUXILIARY_MODEL, APPROVED_MODELS.gemini.auxiliary),
      temperature: 0.7,
      maxTokens: 800,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 1048576
    },
    groq: {
      model: sanitizeOrValidateModel(serverEnv?.GROQ_MODEL, APPROVED_MODELS.groq.conversational),
      temperature: 0.7,
      maxTokens: 800,
      timeoutMs: 5000,
      retryCount: 2,
      maxTokenLimit: 131072
    },
    openrouter: {
      model: sanitizeOrValidateModel(serverEnv?.OPENROUTER_MODEL, APPROVED_MODELS.openrouter.conversational),
      temperature: 0.7,
      maxTokens: 800,
      timeoutMs: 7000,
      retryCount: 1,
      maxTokenLimit: 131072
    }
  }
};
