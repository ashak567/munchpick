import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';

import { POST as postChat } from './chat/route';
import { POST as postTable } from './table/route';
import { POST as postDecisions } from './decisions/route';
import { POST as postJournal } from './journal/route';
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

// Spy on LLM Gateway to ensure rejected requests NEVER reach LLM
export const mockLLMGenerate = vi.fn().mockResolvedValue({ text: 'LLM generated output' });

vi.mock('@/lib/llm/gateway', () => ({
  LLMGateway: class {
    generate(...args: any[]) {
      return mockLLMGenerate(...args);
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

vi.mock('@/utils/gemini', () => ({
  classifyOptions: vi.fn().mockResolvedValue({ category: 'Food', options: [{ text: 'Pizza', tags: ['comfort'], weight: 1 }] }),
  generateReinforcementWithReasoning: vi.fn().mockResolvedValue({ reasoning: 'Great', encouragement: 'Enjoy', mascot: 'munch' }),
  generateReinforcement: vi.fn().mockResolvedValue({ reasoning: 'Great', encouragement: 'Enjoy', mascot: 'munch' })
}));

describe('Targeted Rate Limiting Verification Suite', () => {
  const USER_A = 'user-alpha-111';
  const USER_B = 'user-beta-222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockUser = (userId: string) => {
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } })
      },
      from: vi.fn((table: string) => {
        const query: any = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.order = vi.fn().mockReturnValue(query);
        query.limit = vi.fn().mockResolvedValue({ data: [{ id: 'chat-1', user_id: userId, metadata: {} }] });
        query.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'chat-1', user_id: userId, metadata: {} } });
        query.single = vi.fn().mockResolvedValue({ data: { id: 'chat-1', user_id: userId, metadata: {} } });
        query.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'item-1', user_id: userId } })
          })
        });
        return query;
      })
    });
  };

  it('1. Request below limit is allowed (HTTP 200)', async () => {
    const testUser = 'user-under-limit-' + Date.now();
    setupMockUser(testUser);

    const req = new NextRequest('http://localhost:3000/api/table', {
      method: 'POST',
      body: JSON.stringify({ userMessage: 'Hello under limit' })
    });

    const res = await postTable(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('2. Request exceeding limit returns HTTP 429 with Retry-After and rate limit headers', async () => {
    const testUser = 'user-flood-table-' + Date.now();
    setupMockUser(testUser);

    // Table limit is 10 requests per minute
    for (let i = 0; i < 10; i++) {
      const req = new NextRequest('http://localhost:3000/api/table', {
        method: 'POST',
        body: JSON.stringify({ userMessage: `Turn ${i}` })
      });
      const res = await postTable(req);
      expect(res.status).toBe(200);
    }

    // 11th request MUST be rejected with HTTP 429
    const burstReq = new NextRequest('http://localhost:3000/api/table', {
      method: 'POST',
      body: JSON.stringify({ userMessage: 'Turn 11 (Exceeded)' })
    });
    const burstRes = await postTable(burstReq);
    expect(burstRes.status).toBe(429);
    
    const body = await burstRes.json();
    expect(body.error).toContain('Too many requests');
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(burstRes.headers.get('Retry-After')).toBeDefined();
    expect(burstRes.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(burstRes.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('3. Rejected request does NOT reach LLM provider', async () => {
    const testUser = 'user-llm-block-' + Date.now();
    setupMockUser(testUser);

    // Drain journal limit (10 per minute)
    for (let i = 0; i < 10; i++) {
      await checkRateLimit('journal', testUser);
    }

    mockLLMGenerate.mockClear();

    // Now send request to journal route
    const req = new NextRequest('http://localhost:3000/api/journal', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Journal', content: 'Should be blocked' })
    });
    const res = await postJournal(req);

    expect(res.status).toBe(429);
    // Verified: LLM Gateway was NOT called
    expect(mockLLMGenerate).not.toHaveBeenCalled();
  });

  it("4. User A's rate limit exhaustion does NOT block User B (User Isolation)", async () => {
    const userA = 'user-isolated-a-' + Date.now();
    const userB = 'user-isolated-b-' + Date.now();

    // Exhaust User A's decisions limit (15 req/min)
    for (let i = 0; i < 15; i++) {
      await checkRateLimit('decisions', userA);
    }

    const checkA = await checkRateLimit('decisions', userA);
    expect(checkA.success).toBe(false);

    // User B should still have full quota
    const checkB = await checkRateLimit('decisions', userB);
    expect(checkB.success).toBe(true);
    expect(checkB.remaining).toBe(14);
  });

  it('5. Client-supplied userId in body cannot bypass server-authenticated limiter', async () => {
    const serverAuthenticatedUser = 'server-user-real-' + Date.now();
    setupMockUser(serverAuthenticatedUser);

    // Exhaust real authenticated user limit
    for (let i = 0; i < 20; i++) {
      await checkRateLimit('chat', serverAuthenticatedUser);
    }

    // Attacker tries sending spoofed userId: 'fake-victim-id' in request body
    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: 'I am trying to spoof userId',
        userId: 'fake-victim-id-to-bypass'
      })
    });

    const res = await postChat(req);
    // Limiter used server-authenticated ID and rejected request
    expect(res.status).toBe(429);
  });

  it('6. Different expensive endpoints enforce their respective configured limits', async () => {
    const testUser = 'user-limits-check-' + Date.now();

    // Check distinct limits
    const chatCheck = await checkRateLimit('chat', testUser);
    expect(chatCheck.limit).toBe(20);

    const speculativeCheck = await checkRateLimit('speculative', testUser);
    expect(speculativeCheck.limit).toBe(40);

    const tableCheck = await checkRateLimit('table', testUser);
    expect(tableCheck.limit).toBe(10);

    const decisionsCheck = await checkRateLimit('decisions', testUser);
    expect(decisionsCheck.limit).toBe(15);

    const journalCheck = await checkRateLimit('journal', testUser);
    expect(journalCheck.limit).toBe(10);
  });
});
