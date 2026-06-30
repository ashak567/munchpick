export interface ProviderConfig {
  model: string;
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
  defaultProvider: 'gemini',
  providers: {
    gemini: {
      model: 'gemini-3.1-flash',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 1048576
    },
    gpt: {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 128000
    },
    claude: {
      model: 'claude-3-5-sonnet',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 200000
    },
    deepseek: {
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 5000,
      retryCount: 3,
      maxTokenLimit: 64000
    }
  }
};
