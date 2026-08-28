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
import { PromptBuilderEngine } from './prompt-builder';
import { PromptRenderer } from '../llm/renderer';

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
    expect(emotionRefl?.reflection).toContain('energy appears depleted');

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

  describe('Semantic Reflection Engine Tests (Phase 5.1 Task 3)', () => {
    const getBaseContext = (): ContextPackage => ({
      user_id: 'user_123',
      user_input: 'I have so much work to do.',
      user_name: 'Alex',
      user_nickname: 'Alex',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: []
    });

    const getBaseTrace = (): CognitiveTrace => ({
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
    });

    const getCognitiveDecision = (dominantNeed: any) => ({
      dominantNeed,
      urgency: 'medium' as const,
      emotionalPriority: 0.8,
      storyPriority: 0.5,
      memoryPriority: 0.5,
      reflectionPriority: 0.5,
      confidence: 0.95,
      dominantReason: 'test reason',
      supportingReasons: [],
      cognitiveLoad: 0.5,
      responseDepth: 'medium' as const,
      askQuestion: false,
      acknowledgeEmotion: true,
      referenceMemory: false,
      referenceStory: false
    });

    const getPersonalityDecision = (dominantTrait: any) => ({
      dominantTrait,
      confidence: 0.90,
      energyLevel: 'medium' as const,
      communicationStyle: 'gentle' as const,
      expressionIntensity: 'medium' as const,
      stability: 0.8,
      validateEmotion: true,
      useMetaphors: false,
      challengeUser: false,
      humorAllowed: true,
      supportingTraits: [],
      responseConstraints: {
        avoidHumor: false,
        avoidLongReplies: false,
        avoidQuestions: false,
        avoidChallenges: false
      }
    });

    it('A. should NOT emit any legacy canned conversational dialogue strings', async () => {
      const engine = new ReflectionEngine();
      const legacyPhrases = [
        "I wonder if your energy is running a bit lower",
        "I notice there's a lot of noise or demands around you",
        "I wonder if there is a bit of hesitation",
        "It sounds like you're carrying a lighthearted",
        "It seems you are taking some gentle space",
        "I notice a bit of a shift or some conflicting feelings",
        "It feels like your mind has been working extra hard",
        "I wonder if you're feeling pulled in two different directions",
        "It seems like the path forward is still taking shape",
        "We've been circling around this for a little while",
        "This feels like an important turning point",
        "It is nice to see your efforts starting to pay off",
        "I've noticed you usually keep moving forward",
        "This challenge feels familiar compared to earlier",
        "You've stayed committed to this goal",
        "This seems important to you. Let's understand",
        "This is a wonderful step forward. Let's take a moment",
        "This feels like a turning point where you're shifting",
        "Even when progress feels slow, the effort",
        "I'm curious to explore more about what this means",
        "It is helpful to anchor back to what you've learned",
        "I'm following what you're saying carefully. Tell me a little more",
        "I've been following what you've shared, and I want to understand",
        "I'm really curious to learn more about what you're experiencing",
        "You are making steady progress, and I'm excited",
        "Let's take a deep breath. We can take this step by step",
        "That sounds like a fun adventure! I love seeing this",
        "Let's look at the facts and focus on what needs",
        "I feel very hopeful about the positive changes",
        "I am right here with you, listening to what's unfolding"
      ];

      // Test dominantNeed triggers
      const needs = ['comfort', 'celebrate', 'guide', 'motivate', 'explore', 'ground', 'listen'] as const;
      for (const need of needs) {
        const trace = getBaseTrace();
        trace.cognitiveDecision = getCognitiveDecision(need);
        const result = await engine.execute(trace, getBaseContext());
        for (const refl of result.reflections) {
          for (const phrase of legacyPhrases) {
            expect(refl.reflection).not.toContain(phrase);
            expect(refl.insight).not.toContain(phrase);
          }
        }
      }
    });

    it('B. should emit semantic reflection objects containing insight and guidance fields', async () => {
      const engine = new ReflectionEngine();
      const trace = getBaseTrace();
      trace.cognitiveDecision = getCognitiveDecision('comfort');

      const result = await engine.execute(trace, getBaseContext());
      expect(result.reflections.length).toBeGreaterThan(0);

      const reflection = result.reflections[0];
      expect(reflection.observation).toBeDefined();
      expect(reflection.insight).toBe("User's primary cognitive need is emotional comfort and validation.");
      expect(reflection.guidance).toBe("Provide compassionate presence and validate feelings before problem-solving.");
      expect(reflection.confidence).toBe(0.95);
      expect(reflection.type).toBe('general');
    });

    it('C. should preserve reflection confidence scores faithfully', async () => {
      const engine = new ReflectionEngine();
      const trace = getBaseTrace();
      trace.cognitiveDecision = getCognitiveDecision('motivate');

      const result = await engine.execute(trace, getBaseContext());
      const reflection = result.reflections.find(r => r.observation.includes('motivate'));
      expect(reflection).toBeDefined();
      expect(reflection?.confidence).toBe(0.95);
    });

    it('D. should enforce maximum 3 reflections limit by confidence ranking', async () => {
      const engine = new ReflectionEngine();
      const trace = getBaseTrace();

      // Trigger multiple reflection sources
      trace.cognitiveDecision = getCognitiveDecision('comfort');
      trace.personalityDecision = getPersonalityDecision('empathetic');
      trace.generatedPaths = [
        { text: 'Path A', tags: ['a'] },
        { text: 'Path B', tags: ['b'] }
      ];
      trace.storyProgress = {
        linkedArc: 'Studies',
        continuityStatus: 'stagnating',
        progressScore: 20,
        stagnationCount: 2,
        memoryPriority: 'medium',
        focusSuggestion: 'challenge',
        storyShift: false,
        storyShiftReason: null,
        confidence: 0.70,
        evidence: []
      };

      const result = await engine.execute(trace, getBaseContext());
      expect(result.reflections.length).toBeLessThanOrEqual(3);
    });

    it('E. should maintain existing dominantNeed behavior with semantic descriptions', async () => {
      const engine = new ReflectionEngine();

      const testCases = [
        { need: 'comfort', expectedInsight: 'comfort and validation' },
        { need: 'celebrate', expectedInsight: 'meaningful milestone' },
        { need: 'guide', expectedInsight: 'active guidance and structural direction' },
        { need: 'motivate', expectedInsight: 'encouragement and motivational reinforcement' },
        { need: 'explore', expectedInsight: 'open, exploratory phase' },
        { need: 'ground', expectedInsight: 'grounding back to core values' },
        { need: 'listen', expectedInsight: 'attentive, non-judgmental listening' }
      ] as const;

      for (const tc of testCases) {
        const trace = getBaseTrace();
        trace.cognitiveDecision = getCognitiveDecision(tc.need);
        const result = await engine.execute(trace, getBaseContext());
        const refl = result.reflections[0];
        expect(refl.insight).toContain(tc.expectedInsight);
        expect(refl.guidance).toBeDefined();
      }
    });

    it('F. should maintain existing dominantTrait behavior with semantic descriptions', async () => {
      const engine = new ReflectionEngine();

      const traits = [
        { trait: 'empathetic', expectedInsight: 'deep empathy' },
        { trait: 'curious', expectedInsight: 'curious inquiry' },
        { trait: 'encouraging', expectedInsight: 'uplifting encouragement' },
        { trait: 'calm', expectedInsight: 'calm, steady, grounded pacing' },
        { trait: 'direct', expectedInsight: 'clarity, conciseness' },
        { trait: 'optimistic', expectedInsight: 'positive outlook and hope' }
      ] as const;

      for (const t of traits) {
        const trace = getBaseTrace();
        trace.personalityDecision = getPersonalityDecision(t.trait);
        const result = await engine.execute(trace, getBaseContext());
        const refl = result.reflections.find(r => r.observation.includes(t.trait));
        expect(refl?.insight).toContain(t.expectedInsight);
        expect(refl?.guidance).toBeDefined();
      }
    });

    it('G. should represent story and path reflections as structured semantic insights', async () => {
      const engine = new ReflectionEngine();
      const trace = getBaseTrace();
      trace.generatedPaths = [
        { text: 'Option Alpha', tags: ['a'] },
        { text: 'Option Beta', tags: ['b'] }
      ];

      const result = await engine.execute(trace, getBaseContext());
      const pathRefl = result.reflections.find(r => r.type === 'path');
      expect(pathRefl).toBeDefined();
      expect(pathRefl?.insight).toContain('Option Alpha');
      expect(pathRefl?.insight).toContain('Option Beta');
      expect(pathRefl?.guidance).toBe('Frame the options clearly to support balanced evaluation.');
    });

    it('H. should render semantic reflections in PromptBuilder as internal insights', async () => {
      const promptBuilder = new PromptBuilderEngine();
      const trace = getBaseTrace();
      trace.reflections = [
        {
          observation: 'Orchestrator dominant need is "comfort".',
          insight: 'The user feels overwhelmed by competing academic deadlines.',
          guidance: 'Validate the feeling and help make the immediate problem smaller.',
          reflection: 'The user feels overwhelmed by competing academic deadlines.',
          confidence: 0.95,
          type: 'general'
        }
      ];

      const resultTrace = await promptBuilder.execute(trace, getBaseContext());
      const pkg = resultTrace.promptPackage!;
      const renderedText = PromptRenderer.renderToText(pkg);

      expect(renderedText).toContain('### COGNITIVE_REFLECTIONS');
      expect(renderedText).toContain('Insight:\nThe user feels overwhelmed by competing academic deadlines.');
      expect(renderedText).toContain('Guidance:\nValidate the feeling and help make the immediate problem smaller.');
    });

    it('I. should explicitly instruct the narrator not to copy reflection wording verbatim', async () => {
      const promptBuilder = new PromptBuilderEngine();
      const trace = getBaseTrace();
      trace.reflections = [
        {
          observation: 'Observation',
          insight: 'Insight text',
          guidance: 'Guidance text',
          reflection: 'Insight text',
          confidence: 0.9,
          type: 'general'
        }
      ];

      const resultTrace = await promptBuilder.execute(trace, getBaseContext());
      const pkg = resultTrace.promptPackage!;
      const renderedText = PromptRenderer.renderToText(pkg);

      // Section header notice
      expect(renderedText).toContain('Do not copy their wording verbatim');
      // Directives
      expect(pkg.directives.mustDo).toContain(
        'Express the semantic meaning of cognitive insights naturally without copying reflection wording verbatim.'
      );
    });

    it('J. should execute synchronously and deterministically without network/LLM calls', async () => {
      const engine = new ReflectionEngine();
      const trace = getBaseTrace();
      trace.cognitiveDecision = getCognitiveDecision('comfort');

      const start = Date.now();
      const result = await engine.execute(trace, getBaseContext());
      const duration = Date.now() - start;

      expect(result.reflections.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(20);
    });
  });
});

