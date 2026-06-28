import { describe, it, expect } from 'vitest';
import { ResponsePlanningEngine } from './response-planner';
import { CognitiveTrace, ContextPackage, CognitiveDecision, PersonalityDecision } from './types';

function makeTrace(overrides: Partial<CognitiveTrace> = {}): CognitiveTrace {
  return {
    state: 'Listening',
    emotions: [],
    reflections: [],
    readinessScore: 0,
    readinessThreshold: 0.65,
    mascotCharacter: 'munch',
    mascotExpression: 'idle',
    mascotReason: '',
    generatedPaths: [],
    confidence: 0.8,
    activeTopicKey: 'general',
    ...overrides
  };
}

function makeContext(overrides: Partial<ContextPackage> = {}): ContextPackage {
  return {
    user_id: 'test-user',
    user_input: 'test input',
    options: [],
    profile_beliefs: [],
    relevant_memories: [],
    decision_history: [],
    ...overrides
  };
}

function makeDecision(overrides: Partial<CognitiveDecision> = {}): CognitiveDecision {
  return {
    dominantNeed: 'listen',
    urgency: 'low',
    emotionalPriority: 0.1,
    storyPriority: 0.1,
    memoryPriority: 0.1,
    reflectionPriority: 0.1,
    confidence: 0.8,
    dominantReason: 'Default',
    supportingReasons: [],
    cognitiveLoad: 0.3,
    responseDepth: 'medium',
    askQuestion: false,
    acknowledgeEmotion: false,
    referenceMemory: false,
    referenceStory: false,
    ...overrides
  };
}

function makePersonality(overrides: Partial<PersonalityDecision> = {}): PersonalityDecision {
  return {
    dominantTrait: 'empathetic',
    communicationStyle: 'gentle',
    energyLevel: 'medium',
    expressionIntensity: 'medium',
    humorAllowed: false,
    useMetaphors: false,
    validateEmotion: true,
    challengeUser: false,
    confidence: 0.8,
    stability: 0.7,
    supportingTraits: [],
    responseConstraints: {
      avoidHumor: true,
      avoidLongReplies: false,
      avoidQuestions: false,
      avoidChallenges: true
    },
    ...overrides
  };
}

describe('Response Planning Engine', () => {
  const engine = new ResponsePlanningEngine();

  it('should select correct response goal based on cognitive decision', async () => {
    const comfortTrace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'comfort' }),
      personalityDecision: makePersonality()
    });
    const result = await engine.execute(comfortTrace, makeContext());
    expect(result.responsePlan).toBeDefined();
    expect(result.responsePlan!.responseGoal).toBe('comfort');

    const guideTrace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'guide' }),
      personalityDecision: makePersonality()
    });
    const guideResult = await engine.execute(guideTrace, makeContext());
    expect(guideResult.responsePlan!.responseGoal).toBe('guide');

    const celebrateTrace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'celebrate' }),
      personalityDecision: makePersonality()
    });
    const celebrateResult = await engine.execute(celebrateTrace, makeContext());
    expect(celebrateResult.responsePlan!.responseGoal).toBe('celebrate');

    const motivateTrace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'motivate' }),
      personalityDecision: makePersonality()
    });
    const motivateResult = await engine.execute(motivateTrace, makeContext());
    expect(motivateResult.responsePlan!.responseGoal).toBe('encourage');
  });

  it('should prioritize primary and secondary topics', async () => {
    const trace = makeTrace({
      activeTopicKey: 'career',
      cognitiveDecision: makeDecision(),
      personalityDecision: makePersonality(),
      storyState: {
        events: [],
        arcs: [],
        activeGoals: ['career', 'health', 'relationships'],
        confidence: 0.8
      } as any
    });
    const result = await engine.execute(trace, makeContext());
    expect(result.responsePlan!.primaryTopic).toBe('career');
    expect(result.responsePlan!.secondaryTopics).toContain('health');
    expect(result.responsePlan!.secondaryTopics).toContain('relationships');
    // Primary topic should NOT appear in secondary
    expect(result.responsePlan!.secondaryTopics).not.toContain('career');
  });

  it('should plan sections with correct ordering and required flags', async () => {
    // Comfort goal should have: opening, acknowledgement, reflection, closing
    const trace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'comfort', acknowledgeEmotion: true }),
      personalityDecision: makePersonality()
    });
    const result = await engine.execute(trace, makeContext());
    const plan = result.responsePlan!;
    const sectionTypes = plan.sections.map(s => s.type);

    expect(sectionTypes).toContain('opening');
    expect(sectionTypes).toContain('acknowledgement');
    expect(sectionTypes).toContain('closing');

    // Opening and closing must be required
    expect(plan.sections.find(s => s.type === 'opening')!.required).toBe(true);
    expect(plan.sections.find(s => s.type === 'closing')!.required).toBe(true);

    // Acknowledgement should be required for comfort goal
    expect(plan.sections.find(s => s.type === 'acknowledgement')!.required).toBe(true);
  });

  it('should plan required and forbidden references correctly', async () => {
    const trace = makeTrace({
      cognitiveDecision: makeDecision({
        referenceStory: true,
        referenceMemory: false,
        acknowledgeEmotion: true
      }),
      personalityDecision: makePersonality({ responseConstraints: { avoidHumor: true, avoidLongReplies: false, avoidQuestions: false, avoidChallenges: false } })
    });
    const result = await engine.execute(trace, makeContext());
    const plan = result.responsePlan!;

    // Required references
    expect(plan.requiredReferences.story).toBe(true);
    expect(plan.requiredReferences.memory).toBe(false);
    expect(plan.requiredReferences.emotion).toBe(true);

    // Forbidden humor from personality constraints
    expect(plan.forbiddenReferences.humor).toBe(true);
  });

  it('should plan questions correctly based on constraints', async () => {
    // Questions allowed, medium depth
    const trace = makeTrace({
      cognitiveDecision: makeDecision({ askQuestion: true, responseDepth: 'medium' }),
      personalityDecision: makePersonality({ responseConstraints: { avoidHumor: false, avoidLongReplies: false, avoidQuestions: false, avoidChallenges: false } })
    });
    const result = await engine.execute(trace, makeContext());
    expect(result.responsePlan!.maxQuestions).toBe(1);

    // Questions forbidden by personality
    const noQTrace = makeTrace({
      cognitiveDecision: makeDecision({ askQuestion: true, responseDepth: 'deep' }),
      personalityDecision: makePersonality({ responseConstraints: { avoidHumor: false, avoidLongReplies: false, avoidQuestions: true, avoidChallenges: false } })
    });
    const noQResult = await engine.execute(noQTrace, makeContext());
    expect(noQResult.responsePlan!.maxQuestions).toBe(0);
  });

  it('should generate transition hints', async () => {
    const trace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'guide' }),
      personalityDecision: makePersonality()
    });
    const result = await engine.execute(trace, makeContext());
    expect(result.responsePlan!.transitionHints.length).toBeGreaterThan(0);
  });

  it('should limit section count based on response depth', async () => {
    // Short depth → max 3 sections
    const shortTrace = makeTrace({
      cognitiveDecision: makeDecision({ responseDepth: 'short' }),
      personalityDecision: makePersonality()
    });
    const shortResult = await engine.execute(shortTrace, makeContext());
    expect(shortResult.responsePlan!.sections.length).toBeLessThanOrEqual(3);

    // Deep depth → up to 8 sections
    const deepTrace = makeTrace({
      cognitiveDecision: makeDecision({ responseDepth: 'deep', dominantNeed: 'guide' }),
      personalityDecision: makePersonality()
    });
    const deepResult = await engine.execute(deepTrace, makeContext());
    expect(deepResult.responsePlan!.sections.length).toBeLessThanOrEqual(8);
  });

  it('should select appropriate ending style per goal', async () => {
    const comfortTrace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'comfort' }),
      personalityDecision: makePersonality()
    });
    const comfortResult = await engine.execute(comfortTrace, makeContext());
    expect(comfortResult.responsePlan!.endingStyle).toBe('warm');

    const guideTrace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'guide' }),
      personalityDecision: makePersonality()
    });
    const guideResult = await engine.execute(guideTrace, makeContext());
    expect(guideResult.responsePlan!.endingStyle).toBe('encouraging');
  });

  it('should be deterministic for identical cognitive inputs', async () => {
    const trace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'comfort', responseDepth: 'medium' }),
      personalityDecision: makePersonality(),
      emotions: ['sadness']
    });
    const ctx = makeContext();

    const result1 = await engine.execute(JSON.parse(JSON.stringify(trace)), { ...ctx });
    const result2 = await engine.execute(JSON.parse(JSON.stringify(trace)), { ...ctx });

    expect(result1.responsePlan).toEqual(result2.responsePlan);
  });

  it('should forbid humor for comfort goal even if personality allows it', async () => {
    const trace = makeTrace({
      cognitiveDecision: makeDecision({ dominantNeed: 'comfort' }),
      personalityDecision: makePersonality({
        humorAllowed: true,
        responseConstraints: { avoidHumor: false, avoidLongReplies: false, avoidQuestions: false, avoidChallenges: false }
      })
    });
    const result = await engine.execute(trace, makeContext());
    expect(result.responsePlan!.forbiddenReferences.humor).toBe(true);
  });

  it('should calculate plan confidence from upstream signals', async () => {
    const trace = makeTrace({
      cognitiveDecision: makeDecision({ confidence: 0.6 }),
      personalityDecision: makePersonality({ confidence: 0.9 }),
      storyProgress: {
        continuityStatus: 'progressing',
        storyShift: false,
        linkedArc: 'career',
        confidence: 0.7,
        sessionContribution: ''
      } as any
    });
    const result = await engine.execute(trace, makeContext());
    // Confidence should be the minimum of all upstream signals
    expect(result.responsePlan!.confidence).toBe(0.6);
  });
});
