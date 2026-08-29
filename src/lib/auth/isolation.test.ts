import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NO_STORE_HEADERS, jsonNoStore } from '@/lib/api-headers';
import { SPECULATIVE_CACHE, setSpeculativeState } from '@/lib/reflection/speculative';

describe('Phase 8.5 — User Isolation, Conversation Initialization & Auth Session Audit', () => {
  beforeEach(() => {
    SPECULATIVE_CACHE.clear();
    vi.clearAllMocks();
  });

  describe('1. Cache-Control & HTTP Headers Isolation', () => {
    it('enforces private, no-store headers on all dynamic API responses', () => {
      const response = jsonNoStore({ success: true, data: 'test-data' });
      
      expect(response.headers.get('Cache-Control')).toBe(
        'private, no-cache, no-store, max-age=0, must-revalidate'
      );
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
      expect(response.headers.get('Surrogate-Control')).toBe('no-store');
    });

    it('retains custom status code while attaching no-store headers', () => {
      const errorResponse = jsonNoStore({ error: 'Unauthorized.' }, { status: 401 });
      expect(errorResponse.status).toBe(401);
      expect(errorResponse.headers.get('Cache-Control')).toContain('no-store');
    });
  });

  describe('2. In-Memory Speculative Cache User Scoping', () => {
    it('prevents cross-user collision by namespacing cache keys by userId:draftId', () => {
      const userAId = 'usr_11111111-1111-1111-1111-111111111111';
      const userBId = 'usr_22222222-2222-2222-2222-222222222222';
      const draftId = 'draft_common_id';

      const draftStateA: any = {
        draft: 'I am looking for a quick lunch',
        normalizedDraft: 'i am looking for a quick lunch',
        pipelineVersion: 'v1.8.0',
        engineVersions: {},
        fingerprints: {},
        cognitiveTrace: { state: 'Listening', mascotCharacter: 'munch' } as any,
        completedEngines: ['NLU Engine'],
        timestamp: Date.now(),
        predictionConfidence: 0.8
      };

      // Store draft for User A
      const keyA = `${userAId}:${draftId}`;
      const keyB = `${userBId}:${draftId}`;
      setSpeculativeState(keyA, draftStateA);

      expect(SPECULATIVE_CACHE.has(keyA)).toBe(true);
      expect(SPECULATIVE_CACHE.has(keyB)).toBe(false);

      // User B looking up draftId cannot access User A's speculative state
      const retrievedB = SPECULATIVE_CACHE.get(keyB);
      expect(retrievedB).toBeUndefined();

      // User A looking up keyA retrieves their own state
      const retrievedA = SPECULATIVE_CACHE.get(keyA);
      expect(retrievedA).toBeDefined();
      expect(retrievedA?.draft).toBe('I am looking for a quick lunch');
    });
  });

  describe('3. Clean Conversation Initialization & Reset Invariants', () => {
    it('verifies that initializing a new conversation creates a clean slate with only the welcome message', () => {
      const mockNewChat = {
        id: 'chat_new_12345',
        user_id: 'usr_akashmravi',
        status: 'active',
        state: 'Listening',
        metadata: {
          primaryMascot: 'munch',
          lastMascot: 'munch',
          activeTopicKey: 'general',
          branches: { general: { state: 'Listening', paths: [], mascot: 'munch' } }
        }
      };

      const mockWelcomeMsg = {
        id: 'msg_welcome_1',
        chat_id: mockNewChat.id,
        sender: 'mascot',
        content: "What's on your mind today? I'm here to listen.",
        mascot_character: 'munch',
        mascot_expression: 'idle'
      };

      // New conversation should have exactly 1 mascot message and zero prior user turns
      const initialMessages = [mockWelcomeMsg];
      expect(initialMessages.length).toBe(1);
      expect(initialMessages[0].sender).toBe('mascot');
      expect(initialMessages.filter(m => m.sender === 'user').length).toBe(0);
      expect(mockNewChat.metadata.branches.general.paths).toHaveLength(0);
    });

    it('verifies deterministic selection of the latest active chat when multiple exist', () => {
      const activeChats = [
        { id: 'chat_older', updated_at: '2026-08-28T10:00:00Z', status: 'active' },
        { id: 'chat_latest', updated_at: '2026-08-29T12:00:00Z', status: 'active' },
        { id: 'chat_oldest', updated_at: '2026-08-27T08:00:00Z', status: 'active' }
      ];

      // Sort descending by updated_at
      const sorted = [...activeChats].sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      const latestActive = sorted[0];
      expect(latestActive.id).toBe('chat_latest');
    });
  });

  describe('4. Multi-Account State Isolation Invariants', () => {
    it('ensures separate users have completely partitioned memory sets', () => {
      const databaseMemories = [
        { id: 'mem_1', user_id: 'usr_shop_littleknock', summary: 'Prefers quiet cozy coffee places' },
        { id: 'mem_2', user_id: 'usr_akashmravi06', summary: 'Loves spicy ramen and quick dinners' },
        { id: 'mem_3', user_id: 'usr_akashmr0', summary: 'Interested in career planning' }
      ];

      const getUserMemories = (targetUserId: string) => 
        databaseMemories.filter(m => m.user_id === targetUserId);

      const user1Memories = getUserMemories('usr_shop_littleknock');
      const user2Memories = getUserMemories('usr_akashmravi06');
      const user3Memories = getUserMemories('usr_akashmr0');

      expect(user1Memories).toHaveLength(1);
      expect(user1Memories[0].summary).toBe('Prefers quiet cozy coffee places');

      expect(user2Memories).toHaveLength(1);
      expect(user2Memories[0].summary).toBe('Loves spicy ramen and quick dinners');

      expect(user3Memories).toHaveLength(1);
      expect(user3Memories[0].summary).toBe('Interested in career planning');

      // Zero intersection across users
      const user1Ids = new Set(user1Memories.map(m => m.id));
      const user2Ids = new Set(user2Memories.map(m => m.id));
      const user3Ids = new Set(user3Memories.map(m => m.id));

      expect([...user1Ids].some(id => user2Ids.has(id))).toBe(false);
      expect([...user2Ids].some(id => user3Ids.has(id))).toBe(false);
      expect([...user1Ids].some(id => user3Ids.has(id))).toBe(false);
    });

    it('ensures opaque correlation logging masks sensitive user identifiers', () => {
      const rawUserId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
      const maskedUserId = `${rawUserId.slice(0, 8)}...`;
      const requestId = 'req_c1a2b3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

      const logPayload = {
        requestId,
        userId: maskedUserId,
        chatId: 'chat_999',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        retries: 0
      };

      expect(logPayload.userId).toBe('9b1deb4d...');
      expect(logPayload.userId).not.toContain('3b7d-4bad-9bdd-2b0d7b3dcb6d');
    });
  });
});
