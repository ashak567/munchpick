import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import { AnthropicProviderAdapter } from './anthropic';
import { GeminiProviderAdapter } from './gemini';
import { ProviderResolver } from '../resolver';
import { LLMGateway } from '../gateway';
import { PromptPackage, PromptSection } from '../../reflection/types';
import { serverEnv } from '../../env';

function getValidPromptPackage(supportsReasoning = false): PromptPackage {
  const sections: PromptSection[] = [
    { id: 'system_instructions', type: 'system', priority: 1.0, required: true, content: 'System rules' },
    { id: 'mascot_identity', type: 'identity', priority: 0.9, required: true, content: { mascotId: 'munch' } },
    { id: 'personality_guidelines', type: 'personality', priority: 0.8, required: true, content: 'Gentle and warm' },
    { id: 'conversation_history', type: 'conversation', priority: 0.7, required: true, content: 'User says hello' },
    { id: 'response_plan_meta', type: 'response_plan', priority: 0.6, required: true, content: 'Goal: comfort' },
    { id: 'instruction_notes', type: 'instructions', priority: 0.5, required: true, content: 'Draft response' }
  ];

  const rawString = sections
    .map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`)
    .join('|');
  const checksum = crypto.createHash('sha256').update(rawString).digest('hex');

  return {
    version: 'v1.7.0',
    templateVersion: 'v1.0.0',
    renderStrategy: 'conversation',
    directives: { mustDo: ['Be warm'], shouldDo: [], avoid: [] },
    sections,
    estimatedTokens: 50,
    statistics: { sections: sections.length, estimatedTokens: 50, checksum, compressionRatio: 1.0 },
    checksum,
    isIncomplete: false,
    providerHints: {
      supportsStreaming: true,
      supportsVision: false,
      supportsReasoning
    }
  };
}

describe('ProviderResolver Tests', () => {
  let resolver: ProviderResolver;

  beforeEach(() => {
    resolver = new ProviderResolver();
  });

  it('should resolve default provider (Gemini) when no providerId is specified', () => {
    const provider = resolver.resolve(
      { supportsStreaming: true, supportsVision: false, supportsReasoning: false },
      new Map()
    );
    expect(provider).toBeInstanceOf(GeminiProviderAdapter);
    expect(provider.id).toBe('gemini');
  });

  it('should resolve Anthropic provider when requested explicitly with anthropic or claude', () => {
    const anthropicProvider = resolver.resolve(
      { supportsStreaming: true, supportsVision: false, supportsReasoning: false },
      new Map(),
      'anthropic'
    );
    expect(anthropicProvider).toBeInstanceOf(AnthropicProviderAdapter);
    expect(anthropicProvider.id).toBe('anthropic');

    const claudeProvider = resolver.resolve(
      { supportsStreaming: true, supportsVision: false, supportsReasoning: false },
      new Map(),
      'claude'
    );
    expect(claudeProvider).toBeInstanceOf(AnthropicProviderAdapter);
  });

  it('should throw when an unregistered provider is requested', () => {
    expect(() =>
      resolver.resolve(
        { supportsStreaming: true, supportsVision: false, supportsReasoning: false },
        new Map(),
        'unknown-provider'
      )
    ).toThrow("LLM Provider Resolver: Provider 'unknown-provider' is not registered.");
  });

  it('should throw when a provider fails capability validation', () => {
    const mockProvider = {
      id: 'limited-provider',
      validateCapabilities: vi.fn().mockReturnValue(false),
      generate: vi.fn(),
      stream: vi.fn()
    };
    resolver.registerProvider(mockProvider);

    expect(() =>
      resolver.resolve(
        { supportsStreaming: true, supportsVision: true, supportsReasoning: true },
        new Map(),
        'limited-provider'
      )
    ).toThrow("LLM Provider Resolver: Provider 'limited-provider' does not support required capabilities.");
  });
});

describe('AnthropicProviderAdapter Unit Tests', () => {
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-12345';
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should validate capabilities for Anthropic correctly', () => {
    const adapter = new AnthropicProviderAdapter();
    expect(adapter.validateCapabilities({ supportsStreaming: true, supportsVision: true, supportsReasoning: true })).toBe(true);
    expect(adapter.validateCapabilities({ supportsStreaming: false, supportsVision: false, supportsReasoning: false })).toBe(true);
  });

  it('should throw an auth error when ANTHROPIC_API_KEY is missing or MOCK_KEY', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    if (serverEnv) {
      serverEnv.ANTHROPIC_API_KEY = undefined;
    }
    const adapter = new AnthropicProviderAdapter();
    const pkg = getValidPromptPackage();

    await expect(adapter.generate({ promptPackage: pkg })).rejects.toThrow(
      'Anthropic API key is missing or invalid (auth error).'
    );

    const stream = adapter.stream({ promptPackage: pkg });
    await expect(stream.next()).rejects.toThrow(
      'Anthropic API key is missing or invalid (auth error).'
    );
  });

  it('should format request and parse successful response in generate()', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello from Claude!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 42,
          output_tokens: 18
        }
      })
    });
    global.fetch = mockFetch;

    const adapter = new AnthropicProviderAdapter();
    const pkg = getValidPromptPackage();

    const response = await adapter.generate({
      promptPackage: pkg,
      temperature: 0.5,
      maxTokens: 150
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('sk-ant-test-key-12345');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-3-5-sonnet-20241022');
    expect(body.max_tokens).toBe(150);
    expect(body.temperature).toBe(0.5);
    expect(body.messages[0].role).toBe('user');

    expect(response.text).toBe('Hello from Claude!');
    expect(response.finishReason).toBe('stop');
    expect(response.promptTokens).toBe(42);
    expect(response.completionTokens).toBe(18);
  });

  it('should map 401/403 HTTP errors to authentication error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error": {"type": "authentication_error", "message": "invalid x-api-key"}}'
    });

    const adapter = new AnthropicProviderAdapter();
    const pkg = getValidPromptPackage();

    await expect(adapter.generate({ promptPackage: pkg })).rejects.toThrow(
      'Anthropic API key is missing or invalid (auth error).'
    );
  });

  it('should stream response chunks via SSE in stream()', async () => {
    const sseChunks = [
      'data: {"type": "message_start"}\n\n',
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello "}}\n\n',
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "from "}}\n\n',
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Anthropic!"}}\n\n',
      'data: [DONE]\n\n'
    ];

    const encoder = new TextEncoder();
    let index = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (index < sseChunks.length) {
          controller.enqueue(encoder.encode(sseChunks[index]));
          index++;
        } else {
          controller.close();
        }
      }
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream
    });

    const adapter = new AnthropicProviderAdapter();
    const pkg = getValidPromptPackage();

    const chunks: string[] = [];
    for await (const chunk of adapter.stream({ promptPackage: pkg })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello ', 'from ', 'Anthropic!']);
  });
});

describe('LLMGateway with Anthropic Adapter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-gateway';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should execute prompt package through LLMGateway using providerId: anthropic', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_gateway_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Gateway response from Claude.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 30, output_tokens: 15 }
      })
    });

    const gateway = new LLMGateway();
    const pkg = getValidPromptPackage();

    const response = await gateway.generate({
      promptPackage: pkg,
      providerId: 'anthropic'
    });

    expect(response.requestId).toBeDefined();
    expect(response.text).toBe('Gateway response from Claude.');
    expect(response.metrics.providerId).toBe('anthropic');
    expect(response.metrics.modelId).toBe('claude-3-5-sonnet-20241022');
    expect(response.metrics.promptTokens).toBe(30);
    expect(response.metrics.completionTokens).toBe(15);
  });
});
