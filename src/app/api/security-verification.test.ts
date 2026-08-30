import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { jsonNoStore, NO_STORE_HEADERS } from '@/lib/api-headers';

// Import route handlers
import { GET as getChat, POST as postChat } from './chat/route';
import { GET as getChats, POST as postChats } from './chats/route';
import { POST as postTable } from './table/route';
import { GET as getJournal, POST as postJournal } from './journal/route';
import { PUT as putJournalId, DELETE as deleteJournalId } from './journal/[id]/route';
import { GET as getMemories } from './memories/route';
import { GET as getPreferences } from './preferences/route';
import { GET as getProfile } from './profile/route';
import { POST as postDecisions, GET as getDecisions, DELETE as deleteDecisions } from './decisions/route';
import { POST as postFeedback } from './feedback/route';
import { GET as getEnvelope, POST as postEnvelope } from './envelope/current/route';
import { GET as getNicknames, POST as postNicknames } from './nicknames/route';
import { POST as postSpeculative } from './chat/speculative/route';

// Mock Supabase
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn()
}));

// Mock Next.js after()
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

// Mock LLM Gateway and engines
vi.mock('@/lib/llm/gateway', () => ({
  LLMGateway: class {
    generate() {
      return Promise.resolve({ text: 'Controlled secure response' });
    }
  }
}));

vi.mock('@/lib/context/builder', () => ({
  analyzeTopics: vi.fn().mockResolvedValue({ active_topics: ['general'], intent_hints: [] }),
  MunchContextBuilder: class {
    buildContextAndOrchestrate() {
      return Promise.resolve({ observations: [], conflicts: [] });
    }
  }
}));

describe('Munch Pre-Launch Security Verification Suite', () => {

  // ==========================================
  // 1. AUTHENTICATION ENFORCEMENT TESTS
  // ==========================================
  describe('1. Authentication Enforcement (Unauthenticated Requests Reject with 401)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Simulate unauthenticated user
      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') })
        }
      });
    });

    it('GET /api/chat rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/chat');
      const res = await getChat(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized.');
    });

    it('POST /api/chat rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ content: 'Hello' })
      });
      const res = await postChat(req);
      expect(res.status).toBe(401);
    });

    it('GET /api/chats rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/chats');
      const res = await getChats(req);
      expect(res.status).toBe(401);
    });

    it('POST /api/chats rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/chats', { method: 'POST' });
      const res = await postChats(req);
      expect(res.status).toBe(401);
    });

    it('POST /api/table rejects unauthenticated request with 401 (Prevent LLM Abuse)', async () => {
      const req = new NextRequest('http://localhost:3000/api/table', {
        method: 'POST',
        body: JSON.stringify({ userMessage: 'Hello Table' })
      });
      const res = await postTable(req);
      expect(res.status).toBe(401);
    });

    it('GET /api/journal rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/journal');
      const res = await getJournal(req);
      expect(res.status).toBe(401);
    });

    it('POST /api/journal rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/journal', {
        method: 'POST',
        body: JSON.stringify({ title: 'My Thoughts', content: 'Secret thoughts' })
      });
      const res = await postJournal(req);
      expect(res.status).toBe(401);
    });

    it('PUT /api/journal/[id] rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/journal/j-1', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated', content: 'Updated' })
      });
      const res = await putJournalId(req, { params: Promise.resolve({ id: 'j-1' }) });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/journal/[id] rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/journal/j-1', { method: 'DELETE' });
      const res = await deleteJournalId(req, { params: Promise.resolve({ id: 'j-1' }) });
      expect(res.status).toBe(401);
    });

    it('GET /api/memories rejects unauthenticated request with 401', async () => {
      const res = await getMemories();
      expect(res.status).toBe(401);
    });

    it('GET /api/preferences rejects unauthenticated request with 401', async () => {
      const res = await getPreferences();
      expect(res.status).toBe(401);
    });

    it('GET /api/profile rejects unauthenticated request with 401', async () => {
      const res = await getProfile();
      expect(res.status).toBe(401);
    });

    it('POST /api/decisions rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/decisions', {
        method: 'POST',
        body: JSON.stringify({ options: ['Pizza', 'Sushi'] })
      });
      const res = await postDecisions(req);
      expect(res.status).toBe(401);
    });

    it('GET /api/envelope/current rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/envelope/current');
      const res = await getEnvelope(req);
      expect(res.status).toBe(401);
    });

    it('POST /api/feedback rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ decisionId: 'dec-1', rating: 'love' })
      });
      const res = await postFeedback(req);
      expect(res.status).toBe(401);
    });

    it('GET /api/nicknames rejects unauthenticated request with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/nicknames');
      const res = await getNicknames(req);
      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // 2. CROSS-USER / IDOR PROTECTION TESTS
  // ==========================================
  describe('2. Cross-User Isolation & IDOR Protection', () => {
    const USER_A_ID = 'user-aaa-111';
    const USER_B_ID = 'user-bbb-222';

    it('USER_B cannot access USER_A chat via chatId parameter (Scoped Query)', async () => {
      // Create a chainable mock query builder
      const createChainableQuery = () => {
        const query: any = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.order = vi.fn().mockReturnValue(query);
        query.limit = vi.fn().mockResolvedValue({ data: [] });
        query.maybeSingle = vi.fn().mockResolvedValue({ data: null });
        query.single = vi.fn().mockResolvedValue({ data: { id: 'chat-new-b', user_id: USER_B_ID } });
        query.insert = vi.fn().mockReturnValue(query);
        return query;
      };

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_B_ID } } })
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            const uQuery: any = {};
            uQuery.select = vi.fn().mockReturnValue(uQuery);
            uQuery.eq = vi.fn().mockReturnValue(uQuery);
            uQuery.maybeSingle = vi.fn().mockResolvedValue({ data: { preferred_mascot: 'munch' } });
            return uQuery;
          }
          return createChainableQuery();
        })
      });

      const req = new NextRequest(`http://localhost:3000/api/chat?chatId=user-a-chat-id`);
      const res = await getChat(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      // Chat returned is NOT USER_A's chat!
      expect(data.chat?.id).not.toBe('user-a-chat-id');
    });

    it('USER_B cannot submit feedback on USER_A decision (Returns 403 Forbidden)', async () => {
      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_B_ID } } })
        },
        from: vi.fn((table: string) => {
          if (table === 'decisions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn((col: string, val: string) => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'decision-user-a',
                    user_id: USER_A_ID, // Owned by USER_A
                    category: 'Food',
                    selected_option: 'Pizza'
                  },
                  error: null
                })
              }))
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          };
        })
      });

      const req = new NextRequest('http://localhost:3000/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ decisionId: 'decision-user-a', rating: 'love' })
      });
      const res = await postFeedback(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Access denied');
    });

    it('USER_B cannot modify USER_A speculative draft state (Namespaced keys)', async () => {
      // Mock Supabase
      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_B_ID } } })
        },
        from: vi.fn((table: string) => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string, val: string) => ({
            eq: vi.fn((col2: string, val2: string) => ({
              // When user_id is checked against USER_B_ID for USER_A's chatId, return null
              maybeSingle: vi.fn().mockResolvedValue({ data: null })
            }))
          }))
        }))
      });

      const req = new NextRequest('http://localhost:3000/api/chat/speculative', {
        method: 'POST',
        body: JSON.stringify({ draftId: 'draft-123', chatId: 'user-a-chat', partialText: 'I want' })
      });
      const res = await postSpeculative(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Chat not found.');
    });
  });

  // ==========================================
  // 3. INPUT VALIDATION BOUNDARY TESTS
  // ==========================================
  describe('3. Input Validation Boundary Conditions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'valid-user-id' } } })
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'entry-1' }, error: null })
            })
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { preferred_mascot: 'munch' } })
        }))
      });
    });

    it('Chat: rejects 0 characters (empty string) with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ content: '' })
      });
      const res = await postChat(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Content cannot be empty');
    });

    it('Chat: rejects oversized message of 4001 characters with 400', async () => {
      const oversizedText = 'A'.repeat(4001);
      const req = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ content: oversizedText })
      });
      const res = await postChat(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('exceeds maximum length of 4000');
    });

    it('Journal: rejects title over 200 characters with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/journal', {
        method: 'POST',
        body: JSON.stringify({
          title: 'T'.repeat(201),
          content: 'Valid content'
        })
      });
      const res = await postJournal(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Title exceeds maximum length of 200');
    });

    it('Journal: rejects content over 10,000 characters with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/journal', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Valid Title',
          content: 'C'.repeat(10001)
        })
      });
      const res = await postJournal(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Content exceeds maximum length of 10,000');
    });

    it('Table: rejects user message over 2,000 characters with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/table', {
        method: 'POST',
        body: JSON.stringify({
          userMessage: 'M'.repeat(2001)
        })
      });
      const res = await postTable(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Message exceeds maximum length of 2000');
    });
  });

  // ==========================================
  // 4. XSS PAYLOAD IMMUNITY TESTS
  // ==========================================
  describe('4. XSS Payload Immunity', () => {
    it('treats script tags and event handlers as pure string data', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")'
      ];

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-xss' } } })
        },
        from: vi.fn(() => ({
          insert: vi.fn((payload) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { ...payload, id: 'j-xss-1' }, error: null })
            })
          })),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { preferred_mascot: 'munch' } })
        }))
      });

      for (const payload of xssPayloads) {
        const req = new NextRequest('http://localhost:3000/api/journal', {
          method: 'POST',
          body: JSON.stringify({ title: 'XSS Test', content: payload })
        });
        const res = await postJournal(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        // Stored and returned as raw string, never executed
        expect(data.entry.content).toBe(payload);
      }
    }, 15000);
  });

  // ==========================================
  // 5. CACHE-CONTROL HEADERS TEST
  // ==========================================
  describe('5. Cache-Control Header Enforcement', () => {
    it('jsonNoStore applies strict private non-cacheable headers', () => {
      const res = jsonNoStore({ test: true });
      expect(res.headers.get('Cache-Control')).toBe('private, no-cache, no-store, max-age=0, must-revalidate');
      expect(res.headers.get('Pragma')).toBe('no-cache');
      expect(res.headers.get('Expires')).toBe('0');
      expect(res.headers.get('Surrogate-Control')).toBe('no-store');
    });
  });

  // ==========================================
  // 6. ERROR INFORMATION LEAKAGE TEST
  // ==========================================
  describe('6. Error Information Leakage Defense', () => {
    it('does not disclose stack traces or filesystem paths on unhandled errors', async () => {
      (createClient as any).mockImplementation(() => {
        throw new Error('C:\\Users\\Secrets\\Database.sqlite failed connect');
      });

      const req = new NextRequest('http://localhost:3000/api/chat');
      const res = await getChat(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      // Should return safe generic error message
      expect(data.error).toBeDefined();
      expect(JSON.stringify(data)).not.toContain('C:\\Users\\Secrets');
      expect(data.stack).toBeUndefined();
    });
  });

});
