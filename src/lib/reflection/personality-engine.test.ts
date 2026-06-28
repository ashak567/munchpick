import { describe, it, expect } from 'vitest';
import { PersonalityEngine } from './personality';
import { ReflectionEngine } from './engine';
import { CognitiveTrace, ContextPackage, PersonalityDecision } from './types';

describe('PersonalityEngine tests', () => {
  it('should express dominant trait as empathetic and style as gentle in sadness / comfort context', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I feel really sad.',
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
      cognitiveDecision: {
        dominantNeed: 'comfort',
        urgency: 'high',
        emotionalPriority: 0.8,
        storyPriority: 0.1,
        memoryPriority: 0.1,
        reflectionPriority: 0.1,
        confidence: 0.8,
        dominantReason: 'comfort need',
        supportingReasons: [],
        cognitiveLoad: 0.2,
        responseDepth: 'short',
        askQuestion: false,
        acknowledgeEmotion: true,
        referenceMemory: false,
        referenceStory: false
      }
    };

    const engine = new PersonalityEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.personalityDecision).toBeDefined();
    expect(result.personalityDecision?.dominantTrait).toBe('empathetic');
    expect(result.personalityDecision?.communicationStyle).toBe('gentle');
    expect(result.personalityDecision?.energyLevel).toBe('low');
    expect(result.personalityDecision?.expressionIntensity).toBe('high'); // high urgency/sadness
    expect(result.personalityDecision?.responseConstraints.avoidChallenges).toBe(true); // comfort blocks challenges
    expect(result.personalityDecision?.responseConstraints.avoidHumor).toBe(true);
  });

  it('should express dominant trait as direct and style as direct in guide / pivot context', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'changing course now',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousPersonalityDecision: {
        dominantTrait: 'direct',
        communicationStyle: 'direct',
        energyLevel: 'medium',
        expressionIntensity: 'medium',
        humorAllowed: false,
        useMetaphors: false,
        validateEmotion: false,
        challengeUser: false,
        confidence: 0.8,
        stability: 0.5,
        supportingTraits: [],
        responseConstraints: {
          avoidHumor: true,
          avoidLongReplies: false,
          avoidQuestions: false,
          avoidChallenges: false
        }
      }
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
        linkedArc: 'Fitness',
        continuityStatus: 'stagnating',
        progressScore: 20,
        stagnationCount: 0,
        memoryPriority: 'medium',
        focusSuggestion: 'goal',
        storyShift: true,
        storyShiftReason: 'goal_change',
        confidence: 0.9,
        evidence: []
      },
      cognitiveDecision: {
        dominantNeed: 'guide',
        urgency: 'high',
        emotionalPriority: 0.1,
        storyPriority: 0.9,
        memoryPriority: 0.1,
        reflectionPriority: 0.1,
        confidence: 0.8,
        dominantReason: 'story pivot',
        supportingReasons: [],
        cognitiveLoad: 0.3,
        responseDepth: 'short',
        askQuestion: true,
        acknowledgeEmotion: false,
        referenceMemory: false,
        referenceStory: true
      }
    };

    const engine = new PersonalityEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.personalityDecision?.dominantTrait).toBe('direct');
    expect(result.personalityDecision?.communicationStyle).toBe('direct');
    expect(result.personalityDecision?.challengeUser).toBe(true);
    expect(result.personalityDecision?.responseConstraints.avoidLongReplies).toBe(true); // low cognitive load (0.3)
  });

  it('should calculate stability score and apply trait momentum Carry-over with smoothed confidence', async () => {
    const prevDecision: PersonalityDecision = {
      dominantTrait: 'playful',
      communicationStyle: 'gentle',
      energyLevel: 'high',
      expressionIntensity: 'high',
      humorAllowed: true,
      useMetaphors: false,
      validateEmotion: false,
      challengeUser: false,
      confidence: 0.9,
      stability: 0.85,
      supportingTraits: [],
      responseConstraints: {
        avoidHumor: false,
        avoidLongReplies: false,
        avoidQuestions: false,
        avoidChallenges: false
      }
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'fun times',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousPersonalityDecision: prevDecision
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['joy'],
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
        dominantNeed: 'celebrate',
        urgency: 'low',
        emotionalPriority: 0.5,
        storyPriority: 0.1,
        memoryPriority: 0.1,
        reflectionPriority: 0.1,
        confidence: 0.8,
        dominantReason: 'joy',
        supportingReasons: [],
        cognitiveLoad: 0.1,
        responseDepth: 'short',
        askQuestion: false,
        acknowledgeEmotion: false,
        referenceMemory: false,
        referenceStory: false
      }
    };

    const engine = new PersonalityEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.personalityDecision?.dominantTrait).toBe('playful');
    expect(result.personalityDecision?.stability).toBe(1.0);
    // prev: 0.9. raw: agreement(1.0)*0.4 + storyConf(0.8)*0.3 + memoryConf(0.8)*0.3 = 0.88.
    // smoothed: 0.9 * 0.2 + 0.88 * 0.8 = 0.884.
    expect(result.personalityDecision?.confidence).toBeCloseTo(0.884, 3);
  });

  it('should reflect dominant trait in ReflectionEngine output reflections and NOT scan raw emotions', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'relaxed',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const trace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['sadness'], // Raw emotion present
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      personalityDecision: {
        dominantTrait: 'calm',
        communicationStyle: 'gentle',
        energyLevel: 'low',
        expressionIntensity: 'medium',
        humorAllowed: false,
        useMetaphors: false,
        validateEmotion: true,
        challengeUser: false,
        confidence: 0.95,
        stability: 0.85,
        supportingTraits: [],
        responseConstraints: {
          avoidHumor: true,
          avoidLongReplies: false,
          avoidQuestions: false,
          avoidChallenges: false
        }
      }
    };

    const refEngine = new ReflectionEngine();
    const finalTrace = await refEngine.execute(trace, context);

    const calmReflection = finalTrace.reflections.find(r => r.reflection.includes("take a deep breath"));
    expect(calmReflection).toBeDefined();
    expect(calmReflection?.observation).toContain('calm');

    // Confirm no raw emotions reflections were generated
    const rawEmotionReflection = finalTrace.reflections.find(r => r.reflection.includes("sad"));
    expect(rawEmotionReflection).toBeUndefined();
  });
});
