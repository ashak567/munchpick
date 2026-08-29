import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { LLMGateway, GatewayError } from './gateway';
import { PromptPackage, PromptSection } from '../reflection/types';
import { GatewayRequest, LLMProvider, LLMRequest, LLMResponse } from './types';
import { ProviderResolver } from './resolver';
import { llmConfig } from './config';

// Helper to construct a valid prompt package
function getValidPromptPackage(): PromptPackage {
  const sections: PromptSection[] = [
    { id: 'system_instructions', type: 'system', priority: 1.0, required: true, content: 'System rules' },
    { id: 'mascot_identity', type: 'identity', priority: 0.9, required: true, content: { mascotId: 'pandy' } },
    { id: 'personality_guidelines', type: 'personality', priority: 0.8, required: true, content: 'Friendly traits' },
    { id: 'conversation_history', type: 'conversation', priority: 0.7, required: true, content: 'User says hello' },
    { id: 'response_plan_meta', type: 'response_plan', priority: 0.6, required: true, content: 'Goal: comfort' },
    { id: 'instruction_notes', type: 'instructions', priority: 0.5, required: true, content: 'Draft response' }
  ];

  const rawString = sections
    .map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`)
    .join('|');
  const checksum = crypto.createHash('sha256').update(rawString).digest('hex');

  return {
    version: 'v1.5.0',
    templateVersion: 'v1.0.0',
    renderStrategy: 'comfort',
    directives: { mustDo: ['Be warm'], shouldDo: [], avoid: [] },
    sections,
    estimatedTokens: 50,
    statistics: { sections: sections.length, estimatedTokens: 50, checksum, compressionRatio: 1.0 },
    checksum,
    isIncomplete: false
  };
}

class MockLLMProvider implements LLMProvider {
  constructor(
    public id: string,
    private mockGenerate: (req: LLMRequest) => Promise<LLMResponse>,
    private configured: boolean = true
  ) {}

  public validateCapabilities(): boolean {
    return true;
  }

  public isConfigured(): boolean {
    return this.configured;
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    return this.mockGenerate(request);
  }

  public async *stream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    yield 'stream chunk';
  }
}

describe('LLM Gateway Engine Tests', () => {
  let gateway: LLMGateway;

  beforeEach(() => {
    gateway = new LLMGateway();
    const mockConfig = {
      model: 'mock-model',
      temperature: 0.7,
      maxTokens: 250,
      timeoutMs: 1000,
      retryCount: 3,
      maxTokenLimit: 100000
    };
    llmConfig.providers['mock-success'] = mockConfig;
    llmConfig.providers['mock-flaky'] = mockConfig;
    llmConfig.providers['mock-auth-fail'] = mockConfig;
    llmConfig.providers['mock-circuit'] = mockConfig;
  });

  it('should validate checksum and pass on complete, valid packages', async () => {
    const pkg = getValidPromptPackage();
    const request: GatewayRequest = {
      promptPackage: pkg,
      providerId: 'mock-success'
    };

    // Register a mock success provider
    const successProvider = new MockLLMProvider('mock-success', async () => ({
      text: 'Mock response text',
      finishReason: 'stop',
      promptTokens: 10,
      completionTokens: 15
    }));

    (gateway as any).resolver.registerProvider(successProvider);

    const response = await gateway.generate(request);
    expect(response.requestId).toBeDefined();
    expect(response.text).toBe('Mock response text');
    expect(response.metrics.providerId).toBe('mock-success');
    expect(response.metrics.totalTokens).toBe(25);
  });

  it('should reject requests early if prompt checksum validation fails', async () => {
    const pkg = getValidPromptPackage();
    pkg.checksum = 'invalid-checksum'; // Corrupt the checksum

    const request: GatewayRequest = { promptPackage: pkg };

    await expect(gateway.generate(request)).rejects.toThrow('checksum validation failed');
  });

  it('should reject requests early if required sections are missing', async () => {
    const pkg = getValidPromptPackage();
    // Remove the system section
    pkg.sections = pkg.sections.filter(s => s.type !== 'system');
    
    // Recompute checksum for this altered sections array to bypass checksum check but trigger missing section check
    const rawString = pkg.sections
      .map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`)
      .join('|');
    pkg.checksum = crypto.createHash('sha256').update(rawString).digest('hex');

    const request: GatewayRequest = { promptPackage: pkg };

    await expect(gateway.generate(request)).rejects.toThrow('Missing required prompt sections');
  });

  it('should reject requests early if token budget is exceeded', async () => {
    const pkg = getValidPromptPackage();
    // Huge estimated token size that exceeds model limits
    pkg.statistics.estimatedTokens = 1500000;
    pkg.estimatedTokens = 1500000;

    const request: GatewayRequest = {
      promptPackage: pkg,
      providerId: 'gemini' // Gemini max limits is 1,048,576
    };

    await expect(gateway.generate(request)).rejects.toThrow('Token budget exceeded');
  });

  it('should handle retries on retryable errors (timeout, unavailable) and eventually complete', async () => {
    const pkg = getValidPromptPackage();
    let callCount = 0;

    // Fail first 2 times with timeout, then succeed
    const flakyProvider = new MockLLMProvider('mock-flaky', async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('deadline exceeded (timeout)');
      }
      return {
        text: 'Third time is the charm!',
        finishReason: 'stop',
        promptTokens: 10,
        completionTokens: 20
      };
    });

    (gateway as any).resolver.registerProvider(flakyProvider);

    const response = await gateway.generate({
      promptPackage: pkg,
      providerId: 'mock-flaky'
    });

    expect(response.text).toBe('Third time is the charm!');
    expect(response.metrics.retries).toBe(2);
  });

  it('should use the next configured provider when the primary provider is unavailable (503)', async () => {
    const originalDefaultProvider = llmConfig.defaultProvider;
    const originalFallbackProviders = llmConfig.fallbackProviders;
    llmConfig.defaultProvider = 'mock-primary';
    llmConfig.fallbackProviders = ['mock-fallback'];
    llmConfig.providers['mock-primary'] = { ...llmConfig.providers['mock-success'], retryCount: 1 };
    llmConfig.providers['mock-fallback'] = { ...llmConfig.providers['mock-success'], retryCount: 1 };

    try {
      (gateway as any).resolver.registerProvider(new MockLLMProvider('mock-primary', async () => {
        throw new Error('503 Service Unavailable');
      }));
      (gateway as any).resolver.registerProvider(new MockLLMProvider('mock-fallback', async () => ({
        text: 'Fallback response',
        finishReason: 'stop',
        promptTokens: 8,
        completionTokens: 3
      })));

      const response = await gateway.generate({ promptPackage: getValidPromptPackage() });
      expect(response.text).toBe('Fallback response');
      expect(response.metrics.providerId).toBe('mock-fallback');
    } finally {
      llmConfig.defaultProvider = originalDefaultProvider;
      llmConfig.fallbackProviders = originalFallbackProviders;
    }
  });

  it('should cascade through full fallback chain (Primary 429 -> Fallback1 429 -> Fallback2 200)', async () => {
    const originalDefaultProvider = llmConfig.defaultProvider;
    const originalFallbackProviders = llmConfig.fallbackProviders;
    llmConfig.defaultProvider = 'chain-gemini';
    llmConfig.fallbackProviders = ['chain-groq', 'chain-openrouter'];
    llmConfig.providers['chain-gemini'] = { ...llmConfig.providers['mock-success'], model: 'gemini-2.5-flash', retryCount: 1 };
    llmConfig.providers['chain-groq'] = { ...llmConfig.providers['mock-success'], model: 'llama-3.1-8b-instant', retryCount: 1 };
    llmConfig.providers['chain-openrouter'] = { ...llmConfig.providers['mock-success'], model: 'openrouter/free', retryCount: 1 };

    let geminiCalled = false;
    let groqCalled = false;
    let openrouterCalled = false;

    try {
      (gateway as any).resolver.registerProvider(new MockLLMProvider('chain-gemini', async () => {
        geminiCalled = true;
        throw new Error('429 Rate limit exceeded');
      }));
      (gateway as any).resolver.registerProvider(new MockLLMProvider('chain-groq', async () => {
        groqCalled = true;
        throw new Error('429 Too Many Requests');
      }));
      (gateway as any).resolver.registerProvider(new MockLLMProvider('chain-openrouter', async () => {
        openrouterCalled = true;
        return {
          text: 'OpenRouter resilient response',
          finishReason: 'stop',
          promptTokens: 12,
          completionTokens: 6
        };
      }));

      const response = await gateway.generate({ promptPackage: getValidPromptPackage() });
      expect(geminiCalled).toBe(true);
      expect(groqCalled).toBe(true);
      expect(openrouterCalled).toBe(true);
      expect(response.text).toBe('OpenRouter resilient response');
      expect(response.metrics.providerId).toBe('chain-openrouter');
      expect(response.metrics.modelId).toBe('openrouter/free');
    } finally {
      llmConfig.defaultProvider = originalDefaultProvider;
      llmConfig.fallbackProviders = originalFallbackProviders;
    }
  });

  it('should skip unconfigured providers with missing API keys and continue down the chain', async () => {
    const originalDefaultProvider = llmConfig.defaultProvider;
    const originalFallbackProviders = llmConfig.fallbackProviders;
    llmConfig.defaultProvider = 'skip-gemini';
    llmConfig.fallbackProviders = ['skip-groq-nokey', 'skip-openrouter'];
    llmConfig.providers['skip-gemini'] = { ...llmConfig.providers['mock-success'], retryCount: 1 };
    llmConfig.providers['skip-groq-nokey'] = { ...llmConfig.providers['mock-success'], retryCount: 1 };
    llmConfig.providers['skip-openrouter'] = { ...llmConfig.providers['mock-success'], retryCount: 1 };

    let groqCalled = false;

    try {
      (gateway as any).resolver.registerProvider(new MockLLMProvider('skip-gemini', async () => {
        throw new Error('429 Rate limited');
      }));
      // Groq has no configured API credentials
      (gateway as any).resolver.registerProvider(new MockLLMProvider('skip-groq-nokey', async () => {
        groqCalled = true;
        throw new Error('Groq API key is missing or invalid (auth error).');
      }, false));
      (gateway as any).resolver.registerProvider(new MockLLMProvider('skip-openrouter', async () => ({
        text: 'Recovered via OpenRouter',
        finishReason: 'stop',
        promptTokens: 10,
        completionTokens: 4
      }), true));

      const response = await gateway.generate({ promptPackage: getValidPromptPackage() });
      expect(response.text).toBe('Recovered via OpenRouter');
      expect(response.metrics.providerId).toBe('skip-openrouter');
      expect(groqCalled).toBe(false); // Unconfigured provider was skipped without invocation
    } finally {
      llmConfig.defaultProvider = originalDefaultProvider;
      llmConfig.fallbackProviders = originalFallbackProviders;
    }
  });

  it('should throw typed GatewayError when all configured providers in chain fail', async () => {
    const originalDefaultProvider = llmConfig.defaultProvider;
    const originalFallbackProviders = llmConfig.fallbackProviders;
    llmConfig.defaultProvider = 'all-fail-1';
    llmConfig.fallbackProviders = ['all-fail-2'];
    llmConfig.providers['all-fail-1'] = { ...llmConfig.providers['mock-success'], retryCount: 1 };
    llmConfig.providers['all-fail-2'] = { ...llmConfig.providers['mock-success'], retryCount: 1 };

    try {
      (gateway as any).resolver.registerProvider(new MockLLMProvider('all-fail-1', async () => {
        throw new Error('503 Service Unavailable');
      }));
      (gateway as any).resolver.registerProvider(new MockLLMProvider('all-fail-2', async () => {
        throw new Error('504 Gateway Timeout');
      }));

      await expect(gateway.generate({ promptPackage: getValidPromptPackage() })).rejects.toThrow(GatewayError);
    } finally {
      llmConfig.defaultProvider = originalDefaultProvider;
      llmConfig.fallbackProviders = originalFallbackProviders;
    }
  });

  it('should fail fast without retries on explicit provider request non-retryable errors (auth errors)', async () => {
    const pkg = getValidPromptPackage();
    let callCount = 0;

    const authErrorProvider = new MockLLMProvider('mock-auth-fail', async () => {
      callCount++;
      throw new Error('API key is invalid or unauthorized');
    });

    (gateway as any).resolver.registerProvider(authErrorProvider);

    await expect(
      gateway.generate({
        promptPackage: pkg,
        providerId: 'mock-auth-fail'
      })
    ).rejects.toThrow('authentication or authorization');

    // Call count should be exactly 1, since auth errors on explicit provider requests are not retryable
    expect(callCount).toBe(1);
  });

  it('should open the Circuit Breaker after 3 consecutive failures and fail fast on subsequent calls', async () => {
    const pkg = getValidPromptPackage();
    
    const failProvider = new MockLLMProvider('mock-circuit', async () => {
      throw new Error('timeout error');
    });

    (gateway as any).resolver.registerProvider(failProvider);

    // Call 1: Will retry 3 times (all fail) and record 1 provider failure event (consecutiveFailures=1)
    await expect(gateway.generate({ promptPackage: pkg, providerId: 'mock-circuit' })).rejects.toThrow();

    // Call 2: Retry 3 times again, fails (consecutiveFailures=2)
    await expect(gateway.generate({ promptPackage: pkg, providerId: 'mock-circuit' })).rejects.toThrow();

    // Call 3: Retry 3 times again, fails (consecutiveFailures=3 -> Trips breaker)
    await expect(gateway.generate({ promptPackage: pkg, providerId: 'mock-circuit' })).rejects.toThrow();

    // Call 4: Breaker is open. Should throw immediately without calling generator
    let callTriggered = false;
    const testProvider = new MockLLMProvider('mock-circuit', async () => {
      callTriggered = true;
      return { text: 'Success', finishReason: 'stop', promptTokens: 0, completionTokens: 0 };
    });
    (gateway as any).resolver.registerProvider(testProvider);

    await expect(gateway.generate({ promptPackage: pkg, providerId: 'mock-circuit' })).rejects.toThrow(
      'Circuit open for provider'
    );
    expect(callTriggered).toBe(false);
  });
});
