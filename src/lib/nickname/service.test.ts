import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  getRelationshipState,
  extractRuleBasedTokens,
  generateNicknameCandidates,
  selectNickname,
  updateNicknameAffinity,
  getGreetingName
} from './service';

// Mock variables
let mockDecisionsData: any[] = [];
let mockMemoriesData: any[] = [];
let mockBeliefsData: any[] = [];
let mockAffinitiesData: any[] = [];
const mockUserData = { id: 'user_123', name: 'Ash' };

let upsertedAffinities: any[] = [];
let updatedAffinityPayload: any = null;
let lastDeactivatedUser: string | null = null;
let lastActivatedId: string | null = null;

// Mock env
vi.mock('@/lib/env', () => ({
  serverEnv: {
    GEMINI_API_KEY: 'MOCK_KEY'
  }
}));

// Mock Google Generative AI
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () => JSON.stringify({ nicknames: ['stargazer', 'explorer', 'builder'] })
            }
          })
        };
      }
    }
  };
});

// Mock query builder
const mockQueryBuilder: any = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  update: vi.fn().mockImplementation((payload) => {
    updatedAffinityPayload = payload;
    return mockQueryBuilder;
  }),
  upsert: vi.fn().mockImplementation((payload) => {
    upsertedAffinities = payload;
    return Promise.resolve({ error: null });
  }),
  insert: vi.fn().mockReturnThis(),
  then: vi.fn()
};

vi.mock('@/utils/supabase/server', () => {
  const mockSupabase = {
    from: vi.fn().mockImplementation((table) => {
      // Configure .then behavior depending on table
      mockQueryBuilder.then = (onfulfilled: any) => {
        if (table === 'decisions') {
          return Promise.resolve({ data: mockDecisionsData, error: null }).then(onfulfilled);
        }
        if (table === 'user_memories') {
          return Promise.resolve({ data: mockMemoriesData, error: null }).then(onfulfilled);
        }
        if (table === 'user_beliefs') {
          return Promise.resolve({ data: mockBeliefsData, error: null }).then(onfulfilled);
        }
        if (table === 'nickname_affinity') {
          if (mockQueryBuilder.isSingle) {
            mockQueryBuilder.isSingle = false;
            const singleRec = mockAffinitiesData.find(a => a.nickname === mockQueryBuilder.targetNickname);
            return Promise.resolve({ data: singleRec || null, error: null }).then(onfulfilled);
          }
          return Promise.resolve({ data: mockAffinitiesData, error: null }).then(onfulfilled);
        }
        if (table === 'users') {
          return Promise.resolve({ data: mockUserData, error: null }).then(onfulfilled);
        }
        return Promise.resolve({ data: [], error: null }).then(onfulfilled);
      };

      // Configure helper triggers
      mockQueryBuilder.eq = (field: string, val: any) => {
        if (table === 'nickname_affinity') {
          if (field === 'nickname') {
            mockQueryBuilder.targetNickname = val;
          }
          if (field === 'user_id') {
            lastDeactivatedUser = val;
          }
          if (field === 'id') {
            lastActivatedId = val;
          }
        }
        return mockQueryBuilder;
      };

      mockQueryBuilder.single = () => {
        mockQueryBuilder.isSingle = true;
        return mockQueryBuilder;
      };

      return mockQueryBuilder;
    })
  };

  return {
    createClient: vi.fn(() => Promise.resolve(mockSupabase))
  };
});

describe('Nickname Engine Service Tests', () => {
  beforeEach(() => {
    mockDecisionsData = [];
    mockMemoriesData = [];
    mockBeliefsData = [];
    mockAffinitiesData = [];
    upsertedAffinities = [];
    updatedAffinityPayload = null;
    lastDeactivatedUser = null;
    lastActivatedId = null;
    vi.clearAllMocks();
  });

  describe('Relationship Score Mapping', () => {
    it('should correctly calculate Score and Level = "new" for 0 decisions', async () => {
      const state = await getRelationshipState('user_123');
      expect(state.score).toBe(0);
      expect(state.level).toBe('new');
    });

    it('should calculate Level = "familiar" for a moderate active history', async () => {
      // 5 decisions spread over 3 unique days, 2 memories
      mockDecisionsData = [
        { created_at: '2026-06-21T10:00:00Z' },
        { created_at: '2026-06-21T14:00:00Z' },
        { created_at: '2026-06-22T10:00:00Z' },
        { created_at: '2026-06-23T10:00:00Z' },
        { created_at: '2026-06-23T12:00:00Z' }
      ];
      mockMemoriesData = [{ id: 'm1' }, { id: 'm2' }];

      const state = await getRelationshipState('user_123');
      // Score = (5 * 2) + (2 * 5) + (3 * 3) + (2 * 4) = 10 + 10 + 9 + 8 = 37
      expect(state.score).toBe(37);
      expect(state.level).toBe('familiar');
    });

    it('should calculate Level = "trusted" for higher activity', async () => {
      // 10 decisions over 6 days, 6 memories
      mockDecisionsData = [
        { created_at: '2026-06-15T10:00:00Z' },
        { created_at: '2026-06-16T10:00:00Z' },
        { created_at: '2026-06-17T10:00:00Z' },
        { created_at: '2026-06-18T10:00:00Z' },
        { created_at: '2026-06-19T10:00:00Z' },
        { created_at: '2026-06-20T10:00:00Z' },
        { created_at: '2026-06-20T12:00:00Z' },
        { created_at: '2026-06-20T14:00:00Z' },
        { created_at: '2026-06-20T16:00:00Z' },
        { created_at: '2026-06-20T18:00:00Z' }
      ];
      mockMemoriesData = Array(6).fill({ id: 'm' });

      const state = await getRelationshipState('user_123');
      // Score = (10 * 2) + (6 * 5) + (6 * 3) + (5 * 4) = 20 + 30 + 18 + 20 = 88
      expect(state.score).toBe(88);
      expect(state.level).toBe('trusted');
    });
  });

  describe('Rule-Based Token Extraction (Hallucination Safeguards)', () => {
    it('should extract tokens only if evidence count >= 3 or confidence >= 0.7', async () => {
      mockBeliefsData = [
        {
          dimension: 'interests',
          key: 'cooking',
          value: 'baking cakes',
          confidence: 0.8,
          evidence_count: 1
        },
        {
          dimension: 'values',
          key: 'creativity',
          value: 'artistic expression',
          confidence: 0.4,
          evidence_count: 4
        },
        {
          dimension: 'interests',
          key: 'reading',
          value: 'sci-fi novels',
          confidence: 0.5,
          evidence_count: 1 // Weak evidence, should be filtered out
        }
      ];

      const tokens = await extractRuleBasedTokens('user_123');
      expect(tokens).toContain('builder'); // cooking maps to builder
      expect(tokens).toContain('dreamer'); // creativity maps to dreamer
      expect(tokens).not.toContain('thinker'); // sci-fi / reading fails because of weak evidence
    });
  });

  describe('Selection with Cooldown Penalty', () => {
    it('should select nickname avoiding the cooldown list', async () => {
      mockAffinitiesData = [
        {
          id: 'aff_1',
          nickname: 'stargazer',
          times_used: 1,
          comfort_score: 8.0,
          user_reaction: null,
          is_active: false,
          last_used_at: new Date().toISOString()
        },
        {
          id: 'aff_2',
          nickname: 'builder',
          times_used: 2,
          comfort_score: 5.0,
          user_reaction: null,
          is_active: false,
          last_used_at: new Date().toISOString()
        },
        {
          id: 'aff_3',
          nickname: 'dreamer',
          times_used: 0,
          comfort_score: 4.5,
          user_reaction: null,
          is_active: false,
          last_used_at: new Date().toISOString()
        }
      ];

      // stargazer is in cooldown (used in recent decision)
      mockDecisionsData = [
        { nickname_snapshot: 'stargazer', created_at: new Date().toISOString() }
      ];

      const selected = await selectNickname('user_123');
      // stargazer score drops from 8.0 to ~3.0 due to cooldown penalty (-5.0).
      // builder (comfort_score 5.0) should be selected instead.
      expect(selected).toBe('builder');
      expect(updatedAffinityPayload.is_active).toBe(true);
      expect(lastActivatedId).toBe('aff_2');
    });

    it('should select the cooldown nickname if all others have a much lower score', async () => {
      mockAffinitiesData = [
        {
          id: 'aff_1',
          nickname: 'stargazer',
          times_used: 5,
          comfort_score: 9.0,
          user_reaction: null,
          is_active: false,
          last_used_at: new Date().toISOString()
        },
        {
          id: 'aff_2',
          nickname: 'thinker',
          times_used: 0,
          comfort_score: 2.0,
          user_reaction: null,
          is_active: false,
          last_used_at: new Date().toISOString()
        }
      ];

      mockDecisionsData = [
        { nickname_snapshot: 'stargazer', created_at: new Date().toISOString() }
      ];

      const selected = await selectNickname('user_123');
      // stargazer score: 9.0 - 5.0 = 4.0. thinker score: 2.0.
      // stargazer should still be chosen despite the cooldown.
      expect(selected).toBe('stargazer');
    });
  });

  describe('Affinity Update Rules', () => {
    it('should adjust and clamp comfort scores based on user reaction', async () => {
      mockAffinitiesData = [
        {
          id: 'aff_1',
          nickname: 'stargazer',
          comfort_score: 8.5,
          user_reaction: null
        }
      ];

      await updateNicknameAffinity('user_123', 'stargazer', 'love');
      expect(updatedAffinityPayload.comfort_score).toBe(10.0); // Clamped to max 10.0
      expect(updatedAffinityPayload.user_reaction).toBe('love');

      // Test dislike
      mockAffinitiesData[0].comfort_score = 1.0;
      await updateNicknameAffinity('user_123', 'stargazer', 'dislike');
      expect(updatedAffinityPayload.comfort_score).toBe(0.0); // Clamped to min 0.0
      expect(updatedAffinityPayload.user_reaction).toBe('dislike');
    });
  });
});
