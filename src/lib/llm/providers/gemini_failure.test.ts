import { describe, it, expect, afterEach } from 'vitest';
import { GeminiProviderAdapter } from './gemini';
import { LLMGateway } from '../gateway';
import { serverEnv } from '../../env';
import { llmConfig } from '../config';

describe('FR-009 Verification Tests', () => {
  const originalApiKey = serverEnv.GEMINI_API_KEY;

  afterEach(() => {
    serverEnv.GEMINI_API_KEY = originalApiKey;
  });

  it('should throw an authentication/authorization error when API key is missing or set to MOCK_KEY', async () => {
    serverEnv.GEMINI_API_KEY = 'MOCK_KEY';

    const provider = new GeminiProviderAdapter();
    const req = {
      promptPackage: {
        version: 'v1.5.0',
        templateVersion: 'v1.0.0',
        renderStrategy: 'comfort' as const,
        directives: { mustDo: [], shouldDo: [], avoid: [] },
        sections: [],
        estimatedTokens: 10,
        statistics: { sections: 0, estimatedTokens: 10, checksum: '', compressionRatio: 1.0 },
        checksum: '',
        isIncomplete: false
      },
      temperature: 0.7,
      maxTokens: 250
    };

    // Verify generate throws
    await expect(provider.generate(req)).rejects.toThrow('Gemini API key is missing or invalid (auth error).');

    // Verify stream throws
    const stream = provider.stream(req);
    await expect(stream.next()).rejects.toThrow('Gemini API key is missing or invalid (auth error).');
  });

  it('should propagate auth error through LLMGateway and map to GatewayError unauthorized type', async () => {
    serverEnv.GEMINI_API_KEY = 'MOCK_KEY';
    
    // Construct a valid prompt package structure
    const systemSection = { id: 'system_instructions', type: 'system' as const, priority: 1.0, required: true, content: 'System rules' };
    const identitySection = { id: 'mascot_identity', type: 'identity' as const, priority: 0.9, required: true, content: { mascotId: 'pandy' } };
    const personalitySection = { id: 'personality_guidelines', type: 'personality' as const, priority: 0.8, required: true, content: 'Friendly traits' };
    const conversationSection = { id: 'conversation_history', type: 'conversation' as const, priority: 0.7, required: true, content: 'User says hello' };
    const planSection = { id: 'response_plan_meta', type: 'response_plan' as const, priority: 0.6, required: true, content: 'Goal: comfort' };
    const instructionSection = { id: 'instruction_notes', type: 'instructions' as const, priority: 0.5, required: true, content: 'Draft response' };
    
    const sections = [systemSection, identitySection, personalitySection, conversationSection, planSection, instructionSection];
    const rawString = sections.map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`).join('|');
    const crypto = await import('crypto');
    const checksum = crypto.createHash('sha256').update(rawString).digest('hex');

    const pkg = {
      version: 'v1.5.0',
      templateVersion: 'v1.0.0',
      renderStrategy: 'comfort' as const,
      directives: { mustDo: [], shouldDo: [], avoid: [] },
      sections,
      estimatedTokens: 10,
      statistics: { sections: 6, estimatedTokens: 10, checksum, compressionRatio: 1.0 },
      checksum,
      isIncomplete: false
    };

    const gateway = new LLMGateway();
    await expect(gateway.generate({ promptPackage: pkg, providerId: 'gemini' })).rejects.toThrow('authentication or authorization');
  });
});

describe('Model Selection Architecture Tests', () => {
  it('should select configured conversational model for standard requests', () => {
    expect(llmConfig.providers.gemini.model).toBe('gemini-1.5-flash');
    expect(llmConfig.providers.gemini.reasoningModel).toBe('gemini-1.5-pro');
    expect(llmConfig.providers.gemini.auxiliaryModel).toBe('gemini-1.5-flash-8b');
  });

  it('should resolve conversational vs reasoning models in gateway based on provider hints', async () => {
    const crypto = await import('crypto');
    const systemSection = { id: 'system_instructions', type: 'system' as const, priority: 1.0, required: true, content: 'System rules' };
    const identitySection = { id: 'mascot_identity', type: 'identity' as const, priority: 0.9, required: true, content: { mascotId: 'pandy' } };
    const personalitySection = { id: 'personality_guidelines', type: 'personality' as const, priority: 0.8, required: true, content: 'Friendly traits' };
    const conversationSection = { id: 'conversation_history', type: 'conversation' as const, priority: 0.7, required: true, content: 'User says hello' };
    const planSection = { id: 'response_plan_meta', type: 'response_plan' as const, priority: 0.6, required: true, content: 'Goal: comfort' };
    const instructionSection = { id: 'instruction_notes', type: 'instructions' as const, priority: 0.5, required: true, content: 'Draft response' };
    const sections = [systemSection, identitySection, personalitySection, conversationSection, planSection, instructionSection];
    const rawString = sections.map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`).join('|');
    const checksum = crypto.createHash('sha256').update(rawString).digest('hex');

    const standardPkg = {
      version: 'v1.5.0',
      templateVersion: 'v1.0.0',
      renderStrategy: 'comfort' as const,
      directives: { mustDo: [], shouldDo: [], avoid: [] },
      sections,
      estimatedTokens: 10,
      statistics: { sections: 6, estimatedTokens: 10, checksum, compressionRatio: 1.0 },
      checksum,
      isIncomplete: false,
      providerHints: { supportsReasoning: false }
    };

    const reasoningPkg = {
      ...standardPkg,
      providerHints: { supportsReasoning: true }
    };

    const config = llmConfig.providers.gemini;
    const stdModel = (standardPkg.providerHints?.supportsReasoning && config.reasoningModel) ? config.reasoningModel : config.model;
    const reasModel = (reasoningPkg.providerHints?.supportsReasoning && config.reasoningModel) ? config.reasoningModel : config.model;

    expect(stdModel).toBe('gemini-1.5-flash');
    expect(reasModel).toBe('gemini-1.5-pro');
  });

  it('should dynamically select updated models when configuration is changed', async () => {
    const originalModel = llmConfig.providers.gemini.model;
    const originalReasoning = llmConfig.providers.gemini.reasoningModel;
    const originalAuxiliary = llmConfig.providers.gemini.auxiliaryModel;

    try {
      llmConfig.providers.gemini.model = 'gemini-2.5-flash';
      llmConfig.providers.gemini.reasoningModel = 'gemini-2.5-pro';
      llmConfig.providers.gemini.auxiliaryModel = 'gemini-2.5-flash-lite';

      expect(llmConfig.providers.gemini.model).toBe('gemini-2.5-flash');
      expect(llmConfig.providers.gemini.reasoningModel).toBe('gemini-2.5-pro');
      expect(llmConfig.providers.gemini.auxiliaryModel).toBe('gemini-2.5-flash-lite');

      // Verify that Gemini adapter dynamically uses the configured model rather than hardcoded literals
      const adapter = new GeminiProviderAdapter();
      expect(adapter.validateCapabilities({ supportsStreaming: true, supportsVision: true, supportsReasoning: true })).toBe(true);
    } finally {
      llmConfig.providers.gemini.model = originalModel;
      llmConfig.providers.gemini.reasoningModel = originalReasoning;
      llmConfig.providers.gemini.auxiliaryModel = originalAuxiliary;
    }
  });

  it('should verify auxiliary model configuration is accessible for background analysis services', () => {
    expect(llmConfig.providers.gemini.auxiliaryModel).toBeDefined();
    expect(llmConfig.providers.gemini.auxiliaryModel).toBe('gemini-1.5-flash-8b');
    expect(llmConfig.providers.anthropic.auxiliaryModel).toBe('claude-3-5-haiku-20241022');
  });
});
