import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { serverEnv } from '@/lib/env';
import * as engineModule from '@/lib/reflection/engine';

// Mock Supabase
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}));

// Mock context builder with simple functions
vi.mock('@/lib/context/builder', () => {
  return {
    analyzeTopics: () => Promise.resolve({ active_topics: [], intent_hints: [] }),
    MunchContextBuilder: class {
      buildContext() {
        return Promise.resolve({
          user_id: 'mock-user-id',
          user_input: 'Hello',
          options: [],
          chatHistory: [],
          profile_beliefs: [],
          relevant_memories: [],
          decision_history: []
        });
      }
    }
  };
});

describe('Chat API Route Handler - FR-009 Failure Tests', () => {
  const originalApiKey = serverEnv.GEMINI_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    serverEnv.GEMINI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('should return 500 when Gemini API key is missing or set to MOCK_KEY', async () => {
    serverEnv.GEMINI_API_KEY = 'MOCK_KEY';

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
});
