import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { serverEnv } from '@/lib/env';
import * as engineModule from '@/lib/reflection/engine';

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: vi.fn((fn: () => any) => {
      if (typeof fn === 'function') {
        Promise.resolve().then(() => fn()).catch(() => {});
      }
    })
  };
});

// Mock Supabase
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}));

// Spies for context builder and topic analysis
export const mockAnalyzeTopics = vi.fn().mockResolvedValue({
  active_topics: ['food', 'lunch'],
  intent_hints: ['hungry', 'casual decision']
});

export const mockBuildContext = vi.fn().mockImplementation((params) => {
  return Promise.resolve({
    user_id: params.user_id || 'mock-user-id',
    user_input: params.user_input || 'Hello',
    options: params.options || [],
    chatHistory: [],
    profile_beliefs: [],
    relevant_memories: [],
    decision_history: [],
    recent_context: {
      active_topics: params.topic_analysis?.active_topics || [],
      intent_hints: params.topic_analysis?.intent_hints || []
    }
  });
});

// Mock context builder module
vi.mock('@/lib/context/builder', () => {
  return {
    analyzeTopics: (...args: any[]) => mockAnalyzeTopics(...args),
    MunchContextBuilder: class {
      buildContext(...args: any[]) {
        return mockBuildContext(...args);
      }
    }
  };
});

function getValidPromptPackage(currentMessage: string) {
  return {
    version: 'v1.7.0',
    templateVersion: 'v1.0.0',
    sections: [
      { id: 'system_guidelines', type: 'system', priority: 1, required: true, content: 'System' },
      { id: 'mascot_identity_munch', type: 'identity', priority: 0.9, required: true, content: { mascotId: 'munch' } },
      { id: 'personality_guidelines', type: 'personality', priority: 0.8, required: true, content: { dominantTrait: 'calm' } },
      { id: 'current_user_message', type: 'conversation', priority: 0.4, required: true, content: currentMessage },
      { id: 'response_plan', type: 'response_plan', priority: 0.3, required: true, content: { responseGoal: 'reflect' } },
      { id: 'output_instructions', type: 'instructions', priority: 0.2, required: true, content: 'Respond directly.' }
    ],
    estimatedTokens: 30,
    providerHints: { supportsStreaming: true, supportsVision: false, supportsReasoning: false },
    checksum: 'test-checksum',
    directives: { mustDo: [], shouldDo: [], avoid: [] },
    statistics: { sections: 6, estimatedTokens: 30, checksum: 'test-checksum', compressionRatio: 1 },
    renderStrategy: 'conversation'
  } as any;
}

function getMockGatewayResponse(text: string) {
  return {
    requestId: 'test-request-id',
    text,
    streamed: false,
    metrics: {
      providerId: 'gemini', modelId: 'gemini-1.5-flash', finishReason: 'stop',
      promptTokens: 10, completionTokens: 10, totalTokens: 20, latency: 1,
      retries: 0, timeoutMs: 5000, gatewayVersion: 'v1.0.0'
    }
  } as any;
}

describe('Chat API Route Handler - FR-009 Failure Tests', () => {
  const originalApiKey = serverEnv.GEMINI_API_KEY;
  const originalGroqKey = serverEnv.GROQ_API_KEY;
  const originalOpenRouterKey = serverEnv.OPENROUTER_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    mockAnalyzeTopics.mockResolvedValue({
      active_topics: [],
      intent_hints: []
    });
    mockBuildContext.mockImplementation((params) => {
      return Promise.resolve({
        user_id: params?.user_id || 'mock-user-id',
        user_input: params?.user_input || 'Hello',
        options: params?.options || [],
        chatHistory: [],
        profile_beliefs: [],
        relevant_memories: [],
        decision_history: [],
        recent_context: {
          active_topics: params?.topic_analysis?.active_topics || [],
          intent_hints: params?.topic_analysis?.intent_hints || []
        }
      });
    });
  });

  afterEach(() => {
    serverEnv.GEMINI_API_KEY = originalApiKey;
    serverEnv.GROQ_API_KEY = originalGroqKey;
    serverEnv.OPENROUTER_API_KEY = originalOpenRouterKey;
    vi.restoreAllMocks();
  });

  it('should return 500 when Gemini API key is missing or set to MOCK_KEY', async () => {
    serverEnv.GEMINI_API_KEY = 'MOCK_KEY';
    serverEnv.GROQ_API_KEY = 'MOCK_KEY';
    serverEnv.OPENROUTER_API_KEY = 'MOCK_KEY';

    // Mock Supabase Auth and DB queries
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null })
      },
      from: vi.fn().mockImplementation((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{
                id: 'mock-chat-id',
                state: 'Listening',
                metadata: {
                  primaryMascot: 'munch',
                  lastMascot: 'munch'
                }
              }],
              error: null
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'mock-chat-id',
                state: 'Listening',
                metadata: {
                  primaryMascot: 'munch',
                  lastMascot: 'munch'
                }
              },
              error: null
            }),
            update: vi.fn().mockReturnThis()
          };
        }
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'mock-msg-id', sender: 'user', content: 'hello' },
              error: null
            }),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: '1', sender: 'mascot', content: 'hi', nlu_metadata: {} }],
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null })
        };
      })
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ content: 'hello' })
    });

    const response = await POST(req);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toContain('authentication or authorization');
  });

  it('should return 500 when promptPackage is missing from cognitive trace', async () => {
    // Spy and mock runCognitivePipeline to return a trace without promptPackage
    vi.spyOn(engineModule, 'runCognitivePipeline').mockResolvedValue({
      state: 'Exploring',
      emotions: [],
      reflections: [],
      readinessScore: 0.0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      promptPackage: undefined // Explicitly missing promptPackage
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null })
      },
      from: vi.fn().mockImplementation((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'mock-chat-id', state: 'Listening', metadata: { primaryMascot: 'munch', lastMascot: 'munch' } }],
              error: null
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'mock-chat-id', state: 'Listening', metadata: { primaryMascot: 'munch', lastMascot: 'munch' } },
              error: null
            })
          };
        }
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'mock-msg-id', sender: 'user', content: 'hello' },
              error: null
            }),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null })
        };
      })
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ content: 'hello' })
    });

    const response = await POST(req);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toContain('Prompt package is missing');
  });

  it('should invoke analyzeTopics exactly once and reuse the result in buildContext', async () => {
    mockAnalyzeTopics.mockClear();
    mockBuildContext.mockClear();

    const expectedTopicAnalysis = {
      active_topics: ['food', 'lunch'],
      intent_hints: ['hungry', 'casual decision']
    };
    mockAnalyzeTopics.mockResolvedValueOnce(expectedTopicAnalysis);

    // Mock runCognitivePipeline to return valid response with promptPackage
    vi.spyOn(engineModule, 'runCognitivePipeline').mockResolvedValue({
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0.0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'food',
      promptPackage: {
        version: 'v1.7.0',
        templateVersion: 'v1.0.0',
        sections: [
          { id: 'system_guidelines', type: 'system', priority: 1.0, required: true, content: 'You are an internal natural language renderer for Munch.' },
          { id: 'mascot_identity_munch', type: 'identity', priority: 0.9, required: true, content: { mascotId: 'munch', identity: 'Understanding' } },
          { id: 'personality_guidelines', type: 'personality', priority: 0.8, required: true, content: { dominantTrait: 'empathetic' } },
          { id: 'conversation_history', type: 'conversation', priority: 0.4, required: true, content: 'Hello' },
          { id: 'response_plan', type: 'response_plan', priority: 0.3, required: true, content: { responseGoal: 'reflect' } },
          { id: 'output_instructions', type: 'instructions', priority: 0.2, required: true, content: 'Respond kindly.' }
        ],
        estimatedTokens: 50,
        providerHints: { supportsStreaming: true, supportsVision: false, supportsReasoning: false },
        checksum: '1074e50882e36b802672fa998a44ec1c8caec9ae75691ea06eb6bb6eb3a7c645',
        directives: { mustDo: [], shouldDo: [], avoid: [] },
        statistics: { sections: 6, estimatedTokens: 50, checksum: '1074e50882e36b802672fa998a44ec1c8caec9ae75691ea06eb6bb6eb3a7c645', compressionRatio: 1.0 },
        renderStrategy: 'conversation'
      }
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null })
      },
      from: vi.fn().mockImplementation((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'mock-chat-id', state: 'Listening', metadata: { primaryMascot: 'munch', lastMascot: 'munch' } }],
              error: null
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'mock-chat-id', state: 'Listening', metadata: { primaryMascot: 'munch', lastMascot: 'munch' } },
              error: null
            }),
            update: vi.fn().mockReturnThis()
          };
        }
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'mock-msg-id', sender: 'user', content: 'What food should I eat?' },
              error: null
            }),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          update: vi.fn().mockReturnThis()
        };
      })
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ content: 'What food should I eat?' })
    });

    // Mock LLMGateway generate to avoid external API calls
    const { LLMGateway } = await import('@/lib/llm/gateway');
    vi.spyOn(LLMGateway.prototype, 'generate').mockResolvedValue({
      requestId: 'test-req-id',
      text: 'I hear you are looking for some comfort food.',
      streamed: false,
      metrics: {
        providerId: 'gemini',
        modelId: 'gemini-1.5-flash',
        finishReason: 'stop',
        promptTokens: 50,
        completionTokens: 15,
        totalTokens: 65,
        latency: 80,
        retries: 0,
        timeoutMs: 5000,
        gatewayVersion: 'v1.0.0'
      }
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    // 1. Assert analyzeTopics was called EXACTLY ONCE
    expect(mockAnalyzeTopics).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeTopics).toHaveBeenCalledWith('What food should I eat?');

    // 2. Assert buildContext was called with the precomputed topic_analysis
    expect(mockBuildContext).toHaveBeenCalledTimes(1);
    expect(mockBuildContext).toHaveBeenCalledWith(
      expect.objectContaining({
        user_input: 'What food should I eat?',
        topic_analysis: expectedTopicAnalysis
      })
    );
  });

  it('passes the persisted previous assistant response into the current turn history', async () => {
    const priorUserMessage = 'I am stressed about exams.';
    const priorAssistantResponse = 'That sounds heavy. Which subject is taking the most energy right now?';
    const currentUserMessage = 'Math is especially hard.';
    const capturedHistories: any[][] = [];

    vi.spyOn(engineModule, 'runCognitivePipeline').mockImplementation(async (_pipeline, trace, context) => {
      capturedHistories.push(context.chatHistory || []);
      return {
        ...trace,
        state: 'Exploring',
        promptPackage: getValidPromptPackage(currentUserMessage)
      } as any;
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null })
      },
      from: vi.fn().mockImplementation((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'mock-chat-id', state: 'Listening', metadata: { primaryMascot: 'munch', lastMascot: 'munch' } }],
              error: null
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'mock-chat-id', state: 'Listening', metadata: { primaryMascot: 'munch', lastMascot: 'munch' } },
              error: null
            }),
            update: vi.fn().mockReturnThis()
          };
        }
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'persisted-message' }, error: null }),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              // The database query is newest first; the route must restore chronological order.
              data: [
                { sender: 'user', content: currentUserMessage },
                { sender: 'mascot', content: priorAssistantResponse, mascot_character: 'munch' },
                { sender: 'user', content: priorUserMessage }
              ],
              error: null
            })
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: {}, error: null }) };
      })
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    const { LLMGateway } = await import('@/lib/llm/gateway');
    vi.spyOn(LLMGateway.prototype, 'generate').mockResolvedValue(getMockGatewayResponse('Math can feel especially difficult when each topic builds on the last.'));

    const response = await POST(new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ content: currentUserMessage })
    }));

    expect(response.status).toBe(200);
    expect(capturedHistories).toHaveLength(1);
    expect(capturedHistories[0]).toEqual([
      { sender: 'user', content: priorUserMessage },
      { sender: 'mascot', content: priorAssistantResponse, mascot_character: 'munch' },
      { sender: 'user', content: currentUserMessage }
    ]);
  });

  it('should schedule conversation summary in after() when messageCount reaches 20 without altering 200 response', async () => {
    vi.spyOn(engineModule, 'runCognitivePipeline').mockResolvedValue({
      state: 'Listening',
      emotions: [],
      reflections: [],
      generatedPaths: [],
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      readinessScore: 0.8,
      readinessThreshold: 0.65,
      confidence: 1.0,
      activeTopicKey: 'general',
      promptPackage: {
        version: 'v1.7.0',
        templateVersion: 'v1.0.0',
        sections: [
          { id: 'system_guidelines', type: 'system', priority: 1.0, required: true, content: 'System' },
          { id: 'mascot_identity_munch', type: 'identity', priority: 0.9, required: true, content: { mascotId: 'munch' } },
          { id: 'personality_guidelines', type: 'personality', priority: 0.8, required: true, content: { trait: 'gentle' } },
          { id: 'conversation_history', type: 'conversation', priority: 0.4, required: true, content: 'Hello' },
          { id: 'response_plan', type: 'response_plan', priority: 0.3, required: true, content: { plan: 'reflect' } },
          { id: 'output_instructions', type: 'instructions', priority: 0.2, required: true, content: 'Respond' }
        ],
        estimatedTokens: 50,
        providerHints: { supportsStreaming: true, supportsVision: false, supportsReasoning: false },
        checksum: '6e2163b827cb63e7c39050d24e0310fa096df3f24208a0d01d4a13d8a4e09849',
        directives: { mustDo: [], shouldDo: [], avoid: [] },
        statistics: { sections: 6, estimatedTokens: 50, checksum: '6e2163b827cb63e7c39050d24e0310fa096df3f24208a0d01d4a13d8a4e09849', compressionRatio: 1.0 },
        renderStrategy: 'conversation'
      }
    });

    const twentyMessages = Array.from({ length: 20 }, (_, i) => ({
      id: `msg-${i}`,
      sender: i % 2 === 0 ? 'user' : 'mascot',
      content: `Message ${i}`,
      created_at: new Date().toISOString()
    }));

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null })
      },
      from: vi.fn().mockImplementation((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'mock-chat-id', state: 'Listening', metadata: { primaryMascot: 'munch' } }],
              error: null
            }),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'mock-chat-id', state: 'Listening', metadata: { primaryMascot: 'munch' } },
              error: null
            }),
            update: vi.fn().mockReturnThis()
          };
        }
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'mock-msg-new', sender: 'user', content: 'Tell me more.' },
              error: null
            }),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: twentyMessages, error: null })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          update: vi.fn().mockReturnThis()
        };
      })
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { LLMGateway } = await import('@/lib/llm/gateway');
    vi.spyOn(LLMGateway.prototype, 'generate').mockResolvedValue({
      requestId: 'test-req-20',
      text: 'I am here for you.',
      streamed: false,
      metrics: {
        providerId: 'gemini',
        modelId: 'gemini-1.5-flash',
        finishReason: 'stop',
        promptTokens: 50,
        completionTokens: 10,
        totalTokens: 60,
        latency: 50,
        retries: 0,
        timeoutMs: 5000,
        gatewayVersion: 'v1.0.0'
      }
    });

    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({ content: 'Tell me more.' })
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.message).toBeDefined();
    expect(body.state).toBe('Listening');
  });
});
