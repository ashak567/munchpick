import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  MunchContextBuilder,
  calculateTopicMatchScore,
  calculateRecencyWeight,
  getFallbackTopicAnalysis
} from './builder';
import { AgentObservation } from '../orchestrator/types';

// Mock GoogleGenerativeAI
const mockGenerateContent = vi.fn().mockResolvedValue({
  response: {
    text: () => JSON.stringify({
      active_topics: ['academic', 'exam', 'study', 'stress'],
      intent_hints: ['stressed about performance', 'needs focus']
    })
  }
});

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent
        };
      }
    }
  };
});

// Mock getProfile from HUPS
const mockBeliefs = [
  {
    id: 'b_stress',
    user_id: 'user_123',
    dimension: 'emotional_pattern',
    key: 'academic_stress',
    value: 'high',
    confidence: 0.9,
    evidence_count: 5,
    evidence_refs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'b_food',
    user_id: 'user_123',
    dimension: 'comfort',
    key: 'favorite_food',
    value: 'sushi',
    confidence: 0.85,
    evidence_count: 3,
    evidence_refs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'b_rel',
    user_id: 'user_123',
    dimension: 'relationship',
    key: 'trust_level',
    value: 'open',
    confidence: 0.95,
    evidence_count: 4,
    evidence_refs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'b_uncertain',
    user_id: 'user_123',
    dimension: 'growth',
    key: 'new_habit',
    value: 'early_rising',
    confidence: 0.35, // low confidence -> uncertainty
    evidence_count: 1,
    evidence_refs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

vi.mock('../hup/service', () => ({
  getProfile: vi.fn().mockImplementation(() => Promise.resolve(mockBeliefs))
}));

vi.mock('../nlu/service', () => ({
  nluEngine: {
    analyze: vi.fn().mockResolvedValue([])
  }
}));

// Mock Supabase Server helper
const mockMemoriesData = [
  {
    id: 'mem_1',
    user_id: 'user_123',
    memory_type: 'episodic',
    summary: 'User felt anxious during the math exam last month',
    confidence: 0.9,
    importance: 0.8,
    relevance_score: 1.0,
    created_at: new Date().toISOString(),
    last_referenced_at: new Date().toISOString()
  },
  {
    id: 'mem_2',
    user_id: 'user_123',
    memory_type: 'semantic',
    summary: 'User prefers sweet snacks like donuts when study fatigue sets in',
    confidence: 0.85,
    importance: 0.7,
    relevance_score: 1.0,
    created_at: new Date().toISOString(),
    last_referenced_at: new Date().toISOString()
  }
];

const mockDecisionsData = [
  {
    id: 'dec_123',
    selected_option: 'Sushi',
    category: 'Food',
    mascot: 'munch',
    importance: 'comfort',
    created_at: new Date().toISOString()
  }
];

const mockFeedbackData = [
  {
    decision_id: 'dec_123',
    rating: 'love'
  }
];

vi.mock('@/utils/supabase/server', () => {
  const mockSupabase = {
    from: vi.fn().mockImplementation((table) => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          if (table === 'decisions') {
            return Promise.resolve({ data: mockDecisionsData, error: null });
          }
          if (table === 'nickname_affinity') {
            return Promise.resolve({ data: [{ nickname: 'stargazer' }], error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
        in: vi.fn().mockImplementation(() => {
          if (table === 'feedback') {
            return Promise.resolve({ data: mockFeedbackData, error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
        single: vi.fn().mockImplementation(() => {
          if (table === 'users') {
            return Promise.resolve({ data: { name: 'Ash' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        then: (onfulfilled: any) => {
          if (table === 'user_memories') {
            return Promise.resolve({ data: mockMemoriesData, error: null }).then(onfulfilled);
          }
          if (table === 'users') {
            return Promise.resolve({ data: { name: 'Ash' }, error: null }).then(onfulfilled);
          }
          return Promise.resolve({ data: [], error: null }).then(onfulfilled);
        }
      };
      return builder;
    })
  };
  return {
    createClient: vi.fn(() => Promise.resolve(mockSupabase))
  };
});

// Mock Orchestrator Agents and shared pipeline execution
let mockSharedPipelineObservations: AgentObservation[] = [];

vi.mock('../orchestrator/agents', async (importOriginal) => {
  const original: any = await importOriginal();
  return {
    ...original,
    runSharedPipeline: vi.fn().mockImplementation(() => Promise.resolve(mockSharedPipelineObservations))
  };
});

describe('Munch Context Builder Tests', () => {
  beforeEach(() => {
    mockSharedPipelineObservations = [];
    vi.clearAllMocks();
  });

  describe('Topic Analysis Fallback', () => {
    it('should extract correct topics for academic stress', () => {
      const result = getFallbackTopicAnalysis('Stressed about my math test tomorrow', 'school');
      expect(result.active_topics).toContain('academic');
      expect(result.active_topics).toContain('exam');
      expect(result.active_topics).toContain('study');
      expect(result.active_topics).toContain('stress');
      expect(result.intent_hints[0]).toContain('stressed about performance');
    });

    it('should extract correct topics for food comfort', () => {
      const result = getFallbackTopicAnalysis('I want pizza because I am tired');
      expect(result.active_topics).toContain('food');
      expect(result.active_topics).toContain('eating');
      expect(result.active_topics).toContain('sleep');
      expect(result.intent_hints[0]).toContain('hunger');
    });
  });

  describe('Relevance Ranking & Recency Formulas', () => {
    it('should score match higher if text contains active topics', () => {
      const scoreMatch = calculateTopicMatchScore('I am stressed about my exam', ['exam', 'stress']);
      const scoreNoMatch = calculateTopicMatchScore('Eat sushi for dinner', ['exam', 'stress']);
      expect(scoreMatch).toBeGreaterThan(1.0);
      expect(scoreNoMatch).toBe(0);
    });

    it('should decay score exponentially based on age of record', () => {
      const nowWeight = calculateRecencyWeight(new Date().toISOString());
      const pastWeight = calculateRecencyWeight(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()); // 10 days ago
      expect(nowWeight).toBeCloseTo(1.0, 3);
      expect(pastWeight).toBeLessThan(1.0);
      expect(pastWeight).toBeCloseTo(Math.exp(-0.05 * 10), 3); // ~0.606
    });
  });

  describe('Context Package Building & Partitioning', () => {
    it('should build a context package and partition beliefs, memories, decisions correctly', async () => {
      const builder = new MunchContextBuilder();
      const context = await builder.buildContext({
        user_id: 'user_123',
        user_input: 'Exam prep is making me anxious and tired',
        options: ['Study session', 'Take a nap'],
        current_context: 'evening'
      });

      expect(context.user_id).toBe('user_123');
      expect(context.user_input).toBe('Exam prep is making me anxious and tired');
      expect(context.options).toEqual(['Study session', 'Take a nap']);

      // Relationship partitioning
      expect(context.relationship_signals).toHaveLength(1);
      expect(context.relationship_signals[0].key).toBe('trust_level');

      // Profile signals (excludes relationship and low-confidence items)
      expect(context.profile_signals.some(s => s.key === 'favorite_food')).toBe(true);
      expect(context.profile_signals.some(s => s.key === 'academic_stress')).toBe(true);
      expect(context.profile_signals.some(s => s.key === 'trust_level')).toBe(false);
      expect(context.profile_signals.some(s => s.key === 'new_habit')).toBe(false);

      // Uncertainty partitioning (low confidence < 0.5 mapped here)
      expect(context.uncertainties).toHaveLength(1);
      expect(context.uncertainties[0].key).toBe('new_habit');
      expect(context.uncertainties[0].confidence).toBe(0.35);

      // Memory ranking
      // "math exam" memory has topic overlap (exam, anxious) and should rank first
      expect(context.relevant_memories).toHaveLength(2);
      expect(context.relevant_memories[0].summary).toContain('math exam');

      // Decisions compression
      expect(context.relevant_decisions).toHaveLength(1);
      expect(context.relevant_decisions[0].selected_option).toBe('Sushi');
      expect(context.relevant_decisions[0].rating).toBe('love');
      expect(context.recent_context.summary_of_recent_interactions).toContain('Sushi');
    });

    it('should reuse precomputed topic_analysis and NOT call LLM when topic_analysis is provided', async () => {
      const builder = new MunchContextBuilder();
      mockGenerateContent.mockClear();

      const precomputedAnalysis = {
        active_topics: ['custom_topic_1', 'custom_topic_2'],
        intent_hints: ['custom_intent_hint']
      };

      const context = await builder.buildContext({
        user_id: 'user_123',
        user_input: 'Some input text',
        options: ['Opt A', 'Opt B'],
        topic_analysis: precomputedAnalysis
      });

      // Gemini generateContent should NOT have been called because topic_analysis was provided
      expect(mockGenerateContent).not.toHaveBeenCalled();

      // The returned context should contain the precomputed topics and intent hints
      expect(context.recent_context.active_topics).toEqual(['custom_topic_1', 'custom_topic_2']);
      expect(context.recent_context.intent_hints).toEqual(['custom_intent_hint']);
    });
  });

  describe('Full Builder Orchestration Pass', () => {
    it('should build context and coordinate with orchestrator agents', async () => {
      const builder = new MunchContextBuilder();
      mockSharedPipelineObservations = [
        {
          agent_name: 'Mascot Agent',
          type: 'mascot_recommendation',
          key: 'recommended_mascot',
          value: 'froggy',
          confidence: 0.9,
          reasoning: 'User is stressed'
        }
      ];

      const result = await builder.buildContextAndOrchestrate({
        user_id: 'user_123',
        user_input: 'stressed out',
        options: ['Rest', 'Work']
      });

      expect(result.context).toBeDefined();
      expect(result.observations).toHaveLength(1);
      expect(result.observations[0].value).toBe('froggy');
      expect(result.conflicts).toHaveLength(0);
    });
  });
});
