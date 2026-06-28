import { describe, it, expect } from 'vitest';
import { CognitiveOrchestratorEngine } from './orchestrator';
import { ReflectionEngine } from './engine';
import { CognitiveTrace, ContextPackage } from './types';

describe('CognitiveOrchestratorEngine tests', () => {
  it('should resolve dominant need as comfort in emotional sadness priority context', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I feel really down and lonely today.',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['sadness'],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      detectedEmotion: {
        primaryEmotion: 'sad',
        confidence: 0.85,
        intensity: 0.8,
        evidence: ['user feels down']
      },
      emotionalState: {
        primaryEmotion: 'sad',
        intensity: 0.8,
        confidence: 0.85,
        stability: 0.9,
        emotionalConsistency: 'stable',
        needsEmotionalValidation: true,
        evidence: []
      }
    };

    const engine = new CognitiveOrchestratorEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.cognitiveDecision).toBeDefined();
    expect(result.cognitiveDecision?.dominantNeed).toBe('comfort');
    expect(result.cognitiveDecision?.urgency).toBe('critical'); // 0.8 priority
    expect(result.cognitiveDecision?.acknowledgeEmotion).toBe(true);
  });

  it('should resolve dominant need as guide when a story pivot occurs', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I am starting fit routine instead of programming',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyProgress: {
        linkedArc: 'Fitness journey',
        continuityStatus: 'pivoting',
        progressScore: 20,
        stagnationCount: 0,
        memoryPriority: 'medium',
        focusSuggestion: 'goal',
        storyShift: true,
        storyShiftReason: 'goal_change',
        confidence: 0.9,
        evidence: []
      },
      storyState: {
        currentArc: 'Fitness journey',
        arcStage: 'starting',
        activeGoals: ['get fit'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new CognitiveOrchestratorEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.cognitiveDecision?.dominantNeed).toBe('guide');
    expect(result.cognitiveDecision?.urgency).toBe('critical'); // 0.9 pivot priority
    expect(result.cognitiveDecision?.referenceStory).toBe(true);
  });

  it('should resolve dominant need as motivate when story is stagnating', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'still stuck here',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyProgress: {
        linkedArc: 'Goal',
        continuityStatus: 'stagnating',
        progressScore: 10,
        stagnationCount: 3,
        memoryPriority: 'medium',
        focusSuggestion: 'challenge',
        storyShift: false,
        storyShiftReason: null,
        confidence: 0.8,
        evidence: []
      },
      storyState: {
        currentArc: 'Goal',
        arcStage: 'developing',
        activeGoals: ['goal'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new CognitiveOrchestratorEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.cognitiveDecision?.dominantNeed).toBe('motivate');
  });

  it('should calculate cognitive load and response depth correctly', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'stressed',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['sadness', 'anxiety'],
      reflections: [
        { observation: 'o1', reflection: 'r1', confidence: 0.8, type: 'general' },
        { observation: 'o2', reflection: 'r2', confidence: 0.8, type: 'general' }
      ],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Fitness journey',
        arcStage: 'starting',
        activeGoals: ['g1', 'g2', 'g3'],
        activeChallenges: ['c1'],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      },
      memoryState: {
        memories: [
          {
            id: 'm1',
            category: 'goal',
            title: 't1',
            summary: 's1',
            strength: 0.8,
            stability: 0.5,
            confidence: 0.8,
            firstObserved: '',
            lastReinforced: '',
            reinforcementCount: 1,
            archived: false,
            evidence: []
          },
          {
            id: 'm2',
            category: 'goal',
            title: 't2',
            summary: 's2',
            strength: 0.8,
            stability: 0.5,
            confidence: 0.8,
            firstObserved: '',
            lastReinforced: '',
            reinforcementCount: 1,
            archived: false,
            evidence: []
          }
        ]
      },
      storyInsight: {
        recurringPatterns: [],
        dominantMotivations: [],
        dominantValues: [],
        recurringFears: [],
        unresolvedThreads: ['t1', 't2'],
        personalStrengths: [],
        growthAreas: [],
        confidence: 0.8,
        evidence: []
      }
    };

    const engine = new CognitiveOrchestratorEngine();
    const result = await engine.execute(initialTrace, context);

    // Load: goalsCount(3)*0.1 + memoriesCount(2)*0.05 + threadsCount(2)*0.1 + emotionsCount(2)*0.1 + reflectionsCount(2)*0.1
    // Load = 0.3 + 0.1 + 0.2 + 0.2 + 0.2 = 1.0 (clamped to 1.0)
    expect(result.cognitiveDecision?.cognitiveLoad).toBe(1.0);
    expect(result.cognitiveDecision?.responseDepth).toBe('deep');
  });

  it('should reflect decision in ReflectionEngine when dominant need is motivate', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'stuck',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const trace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      cognitiveDecision: {
        dominantNeed: 'motivate',
        urgency: 'high',
        emotionalPriority: 0.1,
        storyPriority: 0.7,
        memoryPriority: 0.1,
        reflectionPriority: 0.1,
        confidence: 0.8,
        dominantReason: 'story stagnating',
        supportingReasons: [],
        cognitiveLoad: 0.5,
        responseDepth: 'medium',
        askQuestion: false,
        acknowledgeEmotion: false,
        referenceMemory: false,
        referenceStory: true
      }
    };

    const refEngine = new ReflectionEngine();
    const finalTrace = await refEngine.execute(trace, context);

    const motivationReflection = finalTrace.reflections.find(r => r.reflection.includes("building something meaningful"));
    expect(motivationReflection).toBeDefined();
    expect(motivationReflection?.observation).toContain('motivate');
  });
});
