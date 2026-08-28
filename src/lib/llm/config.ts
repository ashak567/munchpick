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
  providers: Record<string, ProviderConfig>;
}

export const llmConfig: LLMConfig = {
  defaultProvider: serverEnv?.LLM_DEFAULT_PROVIDER || 'gemini',
  providers: {
    gemini: {
      model: serverEnv?.GEMINI_MODEL || 'gemini-1.5-flash',
      reasoningModel: serverEnv?.GEMINI_REASONING_MODEL || 'gemini-1.5-pro',
      auxiliaryModel: serverEnv?.GEMINI_AUXILIARY_MODEL || 'gemini-1.5-flash-8b',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 1048576
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
