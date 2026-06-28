import { vi, describe, it, expect } from 'vitest';
import {
  NluEnginePlugin,
  EmotionEnginePlugin,
  MascotSpecialistEngine,
  ReflectionEngine,
  runCognitivePipeline
} from './engine';
import { DecisionReadinessEngine } from './readiness';
import { MascotCharacter, MascotExpression } from '@/components/Mascot';
import { EmotionalStateEngine } from '../emotion/state';
import { EmotionRegulationEngine } from '../emotion/regulation';
import { EmotionDynamicsEngine } from '../emotion/dynamics';
import { CognitiveTrace, ContextPackage } from './types';

// Mock serverEnv
vi.mock('@/lib/env', () => ({
  serverEnv: {
    GEMINI_API_KEY: 'test-key'
  }
}));

// Mock Supabase server helper
vi.mock('@/utils/supabase/server', () => {
  const mockSupabase = {
    from: vi.fn().mockImplementation(() => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      };
    })
  };
  return {
    createClient: vi.fn(() => Promise.resolve(mockSupabase))
  };
});

// Mock GoogleGenerativeAI to prevent actual API calls
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () => JSON.stringify({
                paths: [
                  { text: 'Order Pizza', tags: ['comfort', 'easy'] },
                  { text: 'Make a Salad', tags: ['healthy', 'fresh'] }
                ],
                certainties: [
                  { certainty_level: 'absolute', key_doubts: [], confidence: 0.9, evidence: 'I don\'t know' }
                ],
                readiness_signals: [
                  { readiness_state: 'ready_to_decide', confidence: 0.9, evidence: 'order pizza' }
                ]
              })
            }
          })
        };
      }
    }
  };
});

describe('Cognitive Reflected Engine System', () => {
  it('should run the cognitive pipeline and determine correct mascot, threshold, and readiness', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I am tired and don\'t know whether to order pizza or make a salad',
      user_name: 'Friend',
      user_nickname: 'Friend',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general'
    };

    const pipeline = [
      new NluEnginePlugin(),
      new EmotionEnginePlugin(),
      new EmotionalStateEngine(),
      new EmotionRegulationEngine(),
      new EmotionDynamicsEngine(),
      new ReflectionEngine(),
      new MascotSpecialistEngine(),
      new DecisionReadinessEngine()
    ];

    const finalTrace = await runCognitivePipeline(pipeline, initialTrace, context);

    // Verify mascot selection based on tiredness
    expect(finalTrace.emotions).toContain('tired');
    expect(finalTrace.mascotCharacter).toBe('dobby'); // tired maps to encourage -> dobby
    expect(finalTrace.mascotExpression).toBe('wry'); // Pandy/Dobby tired = wry

    // Verify paths are merged in trace
    expect(finalTrace.generatedPaths).toHaveLength(2);
    expect(finalTrace.generatedPaths[0].text).toBe('Order Pizza');

    // Verify reflections are produced
    expect(finalTrace.reflections.length).toBeGreaterThan(0);
    const emotionRefl = finalTrace.reflections.find(r => r.type === 'emotion');
    expect(emotionRefl).toBeDefined();
    expect(emotionRefl?.reflection).toContain('energy is running a bit lower');

    // Verify adaptive threshold (Food category: low-stakes -> 0.50 threshold)
    expect(finalTrace.readinessThreshold).toBe(0.50);

    // Verify transition to Emerging Paths (as score should satisfy threshold)
    expect(finalTrace.state).toBe('Emerging Paths');
  });

  it('should adapt threshold for high-stakes career inputs', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I want to quit my job and move to a new country',
      user_name: 'Friend',
      user_nickname: 'Friend',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general'
    };

    const pipeline = [
      new NluEnginePlugin(),
      new DecisionReadinessEngine()
    ];

    const finalTrace = await runCognitivePipeline(pipeline, initialTrace, context);

    // High stakes job/quit keywords: 0.80 threshold
    expect(finalTrace.readinessThreshold).toBe(0.80);
  });

  it('should prevent recursion if the pipeline is already running', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'test',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      __runningPipeline: true
    };
    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general'
    };

    await expect(runCognitivePipeline([], initialTrace, context)).rejects.toThrow('Recursive pipeline call detected');
  });

  it('should skip duplicate engines', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'test',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: []
    };
    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general'
    };

    let runCount = 0;
    const dummyEngine = {
      name: 'Dummy Engine',
      execute: async (trace: CognitiveTrace) => {
        runCount++;
        return trace;
      }
    };

    await runCognitivePipeline([dummyEngine, dummyEngine], initialTrace, context);
    expect(runCount).toBe(1);
    expect(context.pipelineExecutionLogs).toContainEqual(
      expect.objectContaining({
        engineName: 'Dummy Engine',
        status: 'skipped',
        error: expect.stringContaining('already executed')
      })
    );
  });

  it('should enforce timeouts per engine and continue', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'test',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: []
    };
    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general'
    };

    const slowEngine = {
      name: 'Slow Engine',
      execute: async (trace: CognitiveTrace) => {
        // Sleep 4000ms (exceeds 3000ms engine timeout)
        await new Promise(resolve => setTimeout(resolve, 4000));
        return { ...trace, mascotReason: 'slow updated' };
      }
    };

    const fastEngine = {
      name: 'Fast Engine',
      execute: async (trace: CognitiveTrace) => {
        return { ...trace, mascotReason: 'fast updated' };
      }
    };

    const finalTrace = await runCognitivePipeline([slowEngine, fastEngine], initialTrace, context);
    // Slow engine failed/timed out, fast engine executed and updated the trace
    expect(finalTrace.mascotReason).toBe('fast updated');
    expect(context.pipelineExecutionLogs).toContainEqual(
      expect.objectContaining({
        engineName: 'Slow Engine',
        status: 'failed',
        error: expect.stringContaining('timed out')
      })
    );
    expect(context.pipelineExecutionLogs).toContainEqual(
      expect.objectContaining({
        engineName: 'Fast Engine',
        status: 'success'
      })
    );
  }, 10000); // 10s test timeout

  it('should break reflection loop when consecutive count exceeds 3', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'some input',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      consecutiveReflectionCount: 3 // already reflected 3 times
    };

    const initialTrace: CognitiveTrace = {
      state: 'Clarifying',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general'
    };

    // NLU returns ambiguity, which would normally transition nextState to Clarifying
    context.observations = [
      {
        agent_name: 'NLU Agent',
        type: 'nlu',
        key: 'ambiguities',
        value: [{ phrase: 'vague', confidence: 0.9 }],
        confidence: 0.9,
        reasoning: ''
      }
    ];

    const engine = new DecisionReadinessEngine();
    const finalTrace = await engine.execute(initialTrace, context);

    // Normally it transitions to Clarifying due to ambiguities.
    // Since consecutiveCount = 3, it should transition to Exploring and reset count to 0.
    expect(finalTrace.state).toBe('Exploring');
    expect(context.consecutiveReflectionCount).toBe(0);
  });
});
