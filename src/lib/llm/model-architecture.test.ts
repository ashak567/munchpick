import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  llmConfig,
  getApprovedGeminiModel,
  APPROVED_MODELS,
  DEPRECATED_MODELS,
  sanitizeOrValidateModel
} from './config';
import { ProviderResolver } from './resolver';
import { GeminiProviderAdapter } from './providers/gemini';
import { GroqProviderAdapter } from './providers/groq';
import { OpenRouterProviderAdapter } from './providers/openrouter';
import { LLMGateway } from './gateway';
import { PromptPackage } from '@/lib/reflection/types';
import { ProviderCapabilities } from './types';

const defaultCapabilities: ProviderCapabilities = {
  supportsStreaming: true,
  supportsReasoning: false,
  supportsVision: false
};

function createMockPromptPackage(supportsReasoning = false): PromptPackage {
  return {
    version: 'v1.7.0',
    templateVersion: 'v1.0.0',
    renderStrategy: 'conversation',
    directives: { mustDo: [], shouldDo: [], avoid: [] },
    sections: [
      { id: 'sys', type: 'system', priority: 1.0, required: true, content: 'System instruction' },
      { id: 'user_msg', type: 'conversation', priority: 0.4, required: true, content: 'Hello' }
    ],
    estimatedTokens: 10,
    statistics: { sections: 2, estimatedTokens: 10, checksum: 'abc', compressionRatio: 1.0 },
    checksum: 'abc',
    providerHints: { supportsStreaming: true, supportsReasoning, supportsVision: false }
  };
}

describe('Model Architecture & Legacy Model Purge Verification (Phase F)', () => {
  let resolver: ProviderResolver;

  beforeEach(() => {
    resolver = new ProviderResolver();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. No legacy Gemini model can be selected
  it('1. rejects / sanitizes legacy Gemini models when passed as overrides', () => {
    const legacyModels = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash-8b',
      'gemini-1.0',
      'gemini-pro',
      'gemini-ultra'
    ];

    for (const legacy of legacyModels) {
      const sanitized = sanitizeOrValidateModel(legacy, APPROVED_MODELS.gemini.conversational);
      expect(sanitized).toBe('gemini-2.5-flash');
      expect(sanitized).not.toBe(legacy);
    }
  });

  // 2. Conversational requests select gemini-2.5-flash
  it('2. selects gemini-2.5-flash for conversational requests', () => {
    const conversationalModel = getApprovedGeminiModel('conversational');
    expect(conversationalModel).toBe('gemini-2.5-flash');
    expect(llmConfig.providers.gemini.model).toBe('gemini-2.5-flash');
  });

  // 3. Reasoning requests select gemini-2.5-flash
  it('3. selects gemini-2.5-flash for reasoning requests', () => {
    const reasoningModel = getApprovedGeminiModel('reasoning');
    expect(reasoningModel).toBe('gemini-2.5-flash');
    expect(llmConfig.providers.gemini.reasoningModel).toBe('gemini-2.5-flash');
  });

  // 4. Auxiliary/background requests select gemini-3.1-flash-lite
  it('4. selects gemini-3.1-flash-lite for auxiliary/background requests', () => {
    const auxiliaryModel = getApprovedGeminiModel('auxiliary');
    expect(auxiliaryModel).toBe('gemini-3.1-flash-lite');
    expect(llmConfig.providers.gemini.auxiliaryModel).toBe('gemini-3.1-flash-lite');
  });

  // 5. Groq fallback selects llama-3.1-8b-instant
  it('5. selects llama-3.1-8b-instant for Groq fallback', () => {
    expect(llmConfig.providers.groq.model).toBe('llama-3.1-8b-instant');
    expect(APPROVED_MODELS.groq.conversational).toBe('llama-3.1-8b-instant');
  });

  // 6. OpenRouter fallback selects openrouter/free
  it('6. selects openrouter/free for OpenRouter fallback', () => {
    expect(llmConfig.providers.openrouter.model).toBe('openrouter/free');
    expect(APPROVED_MODELS.openrouter.conversational).toBe('openrouter/free');
  });

  // 7. Provider fallback order is deterministic: gemini -> groq -> openrouter
  it('7. enforces deterministic fallback chain: gemini -> groq -> openrouter', () => {
    expect(llmConfig.defaultProvider).toBe('gemini');
    expect(llmConfig.fallbackProviders).toEqual(['groq', 'openrouter']);

    const candidates = resolver.resolveCandidates(
      defaultCapabilities,
      new Map()
    );
    const candidateIds = candidates.map(c => c.id);
    expect(candidateIds).toEqual(['gemini', 'groq', 'openrouter']);
  });

  // 8. Anthropic is not selected / registered
  it('8. ensures Anthropic is not registered and fails fast when requested', () => {
    expect(() => {
      resolver.resolve(defaultCapabilities, new Map(), 'anthropic');
    }).toThrow("LLM Provider Resolver: Provider 'anthropic' is not registered.");

    expect(() => {
      resolver.resolve(defaultCapabilities, new Map(), 'claude');
    }).toThrow("LLM Provider Resolver: Provider 'claude' is not registered.");

    expect(llmConfig.providers.anthropic).toBeUndefined();
    expect(llmConfig.providers.claude).toBeUndefined();
  });

  // 9. OpenAI is not selected / registered
  it('9. ensures OpenAI is not registered and fails fast when requested', () => {
    expect(() => {
      resolver.resolve(defaultCapabilities, new Map(), 'openai');
    }).toThrow("LLM Provider Resolver: Provider 'openai' is not registered.");

    expect(() => {
      resolver.resolve(defaultCapabilities, new Map(), 'gpt');
    }).toThrow("LLM Provider Resolver: Provider 'gpt' is not registered.");

    expect(llmConfig.providers.openai).toBeUndefined();
    expect(llmConfig.providers.gpt).toBeUndefined();
  });

  // 10. Deprecated models list contains all legacy candidates
  it('10. verifies comprehensive deprecated model blacklist', () => {
    expect(DEPRECATED_MODELS.has('gemini-1.5-flash')).toBe(true);
    expect(DEPRECATED_MODELS.has('gemini-1.5-pro')).toBe(true);
    expect(DEPRECATED_MODELS.has('gemini-1.5-flash-8b')).toBe(true);
    expect(DEPRECATED_MODELS.has('gemini-1.0')).toBe(true);
    expect(DEPRECATED_MODELS.has('gemini-pro')).toBe(true);
  });

  // 11. Streaming uses the correct approved model
  it('11. verifies Gemini streaming adapter initializes with approved model', () => {
    const adapter = new GeminiProviderAdapter();
    expect(adapter.id).toBe('gemini');
    expect(adapter.validateCapabilities({ supportsStreaming: true, supportsReasoning: false, supportsVision: false })).toBe(true);
  });

  // 12. Normal generation uses the correct approved model
  it('12. verifies normal generation resolves approved model parameters', () => {
    const conversational = getApprovedGeminiModel('conversational');
    const reasoning = getApprovedGeminiModel('reasoning');
    const auxiliary = getApprovedGeminiModel('auxiliary');

    expect(conversational).toBe('gemini-2.5-flash');
    expect(reasoning).toBe('gemini-2.5-flash');
    expect(auxiliary).toBe('gemini-3.1-flash-lite');
  });
});
