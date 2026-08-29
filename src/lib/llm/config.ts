import { serverEnv } from '@/lib/env';

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

const fallbackProviders = (serverEnv?.LLM_FALLBACK_PROVIDERS || 'groq,openrouter')
  .split(',')
  .map(provider => provider.trim().toLowerCase())
  .filter(Boolean);

export const llmConfig: LLMConfig = {
  defaultProvider: serverEnv?.LLM_DEFAULT_PROVIDER || 'gemini',
  fallbackProviders,
  providers: {
    gemini: {
      model: serverEnv?.GEMINI_MODEL || 'gemini-2.5-flash',
      reasoningModel: serverEnv?.GEMINI_REASONING_MODEL || 'gemini-2.5-flash',
      auxiliaryModel: serverEnv?.GEMINI_AUXILIARY_MODEL || 'gemini-3.1-flash-lite',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 1048576
    },
    groq: {
      model: serverEnv?.GROQ_MODEL || 'llama-3.1-8b-instant',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 2,
      maxTokenLimit: 131072
    },
    openrouter: {
      model: serverEnv?.OPENROUTER_MODEL || 'openrouter/free',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 7000,
      retryCount: 1,
      maxTokenLimit: 131072
    },
    anthropic: {
      model: serverEnv?.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      reasoningModel: serverEnv?.ANTHROPIC_REASONING_MODEL || 'claude-3-7-sonnet-20250219',
      auxiliaryModel: serverEnv?.ANTHROPIC_AUXILIARY_MODEL || 'claude-3-5-haiku-20241022',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 200000
    },
    claude: {
      model: serverEnv?.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      reasoningModel: serverEnv?.ANTHROPIC_REASONING_MODEL || 'claude-3-7-sonnet-20250219',
      auxiliaryModel: serverEnv?.ANTHROPIC_AUXILIARY_MODEL || 'claude-3-5-haiku-20241022',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 200000
    },
    gpt: {
      model: 'gpt-4o',
      reasoningModel: 'o1-mini',
      auxiliaryModel: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 128000
    },
    deepseek: {
      model: 'deepseek-chat',
      reasoningModel: 'deepseek-reasoner',
      auxiliaryModel: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 64000
    }
  }
};
