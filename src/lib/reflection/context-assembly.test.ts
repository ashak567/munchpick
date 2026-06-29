import { describe, it, expect } from 'vitest';
import {
  ContextAssemblyEngine,
  CONTEXT_PRIORITY_RULES,
  estimateTokens,
  compareSemanticItems,
  checkBlockSemanticOverlap,
  mergeBlocks
} from './context-assembly';
import { CognitiveTrace, ContextPackage } from './types';
import { resolveInvalidatedEngines, generateFingerprints, PIPELINE_VERSION } from './speculative';

describe('Context Assembly Engine Tests', () => {
  const engine = new ContextAssemblyEngine();

  const getBaseTrace = (): CognitiveTrace => ({
    state: 'Listening',
    emotions: ['happy'],
    reflections: [
      {
        observation: 'Observing something',
        reflection: 'Pondering paths',
        confidence: 0.8,
        type: 'general'
      }
    ],
    readinessScore: 0.5,
    readinessThreshold: 0.65,
    mascotCharacter: 'munch',
    mascotExpression: 'idle',
    mascotReason: 'Default Mascot',
    generatedPaths: [{ text: 'Path A', tags: ['a'] }],
    confidence: 0.9,
    activeTopicKey: 'topic_a',
    cognitiveDecision: {
      dominantNeed: 'comfort',
      urgency: 'low',
      emotionalPriority: 1,
      storyPriority: 1,
      memoryPriority: 1,
      reflectionPriority: 1,
      confidence: 0.95,
      dominantReason: 'Need comfort',
      supportingReasons: ['Supporting detail'],
      cognitiveLoad: 2,
      responseDepth: 'medium',
      askQuestion: false,
      acknowledgeEmotion: true,
      referenceMemory: false,
      referenceStory: false
    },
    personalityDecision: {
      dominantTrait: 'empathetic',
      communicationStyle: 'gentle',
      energyLevel: 'medium',
      expressionIntensity: 'medium',
      humorAllowed: false,
      useMetaphors: true,
      validateEmotion: true,
      challengeUser: false,
      confidence: 0.92,
      stability: 0.9,
      supportingTraits: [],
      responseConstraints: { avoidHumor: true, avoidLongReplies: false, avoidQuestions: false, avoidChallenges: false }
    },
    responsePlan: {
      responseGoal: 'comfort',
      primaryTopic: 'Topic A',
      secondaryTopics: [],
      sections: [{ type: 'opening', priority: 1, required: true }],
      requiredReferences: { story: false, memory: false, emotion: true },
      forbiddenReferences: { memory: true, story: true, humor: true },
      transitionHints: [],
      maxQuestions: 1,
      endingStyle: 'warm',
      confidence: 0.88
    }
  });

  const getBaseContext = (): ContextPackage => ({
    user_id: 'user_123',
    user_input: 'I am building Munch and it is going great!',
    options: [],
    profile_beliefs: [],
    relevant_memories: [],
    decision_history: []
  });

  it('should successfully compile all cognitive blocks into contextAssembly', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    const resultTrace = await engine.execute(trace, context);
    const assembly = resultTrace.contextAssembly;

    expect(assembly).toBeDefined();
    expect(assembly?.isIncomplete).toBe(false);
    expect(assembly?.blocks.length).toBeGreaterThan(3);

    // Verify ordering
    const orders = assembly?.blocks.map(b => b.category) || [];
    for (let i = 0; i < orders.length - 1; i++) {
      expect(CONTEXT_PRIORITY_RULES[orders[i]]).toBeGreaterThanOrEqual(CONTEXT_PRIORITY_RULES[orders[i + 1]]);
    }
  });

  it('should estimate tokens using the abstracted tokenizer function', () => {
    const text = 'Hello World';
    // Character length is 11, ceil(11/4) = 3
    expect(estimateTokens(text)).toBe(3);
  });

  it('should compare items semantically and resolve overlaps', () => {
    const item1 = { text: 'Building Munch', arc: 'Munch Development' };
    const item2 = { text: 'Building Munch', arc: 'Munch Development' };
    const item3 = { text: 'Creating a decision app', arc: 'Other Arc' };

    expect(compareSemanticItems(item1, item2)).toBe(1.0);
    expect(compareSemanticItems(item1, item3)).toBeLessThan(0.3);
  });

  it('should merge highly similar blocks into a single block with sourceIds aggregated', () => {
    const block1 = {
      id: 'story_state',
      category: 'story' as const,
      priority: CONTEXT_PRIORITY_RULES.story,
      importance: 'medium' as const,
      required: false,
      sourceIds: ['story_engine'],
      content: { events: [{ text: 'Building Munch', arc: 'Sprint 5' }] },
      estimatedTokens: 10
    };

    const block2 = {
      id: 'memory_state',
      category: 'memory' as const,
      priority: CONTEXT_PRIORITY_RULES.memory,
      importance: 'low' as const,
      required: false,
      sourceIds: ['memory_consolidation'],
      content: { memories: [{ text: 'Building Munch', arc: 'Sprint 5' }] },
      estimatedTokens: 8
    };

    expect(checkBlockSemanticOverlap(block1, block2)).toBe(true);

    const merged = mergeBlocks(block1, block2);
    expect(merged.sourceIds).toContain('story_engine');
    expect(merged.sourceIds).toContain('memory_consolidation');
    expect(merged.id).toBe('story_state_merged_memory_state');
    expect(merged.importance).toBe('medium'); // choosing higher importance ('medium' over 'low')
  });

  it('should perform smart trimming preserving required and critical blocks', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    // Set a very low token budget so trimming triggers
    context.assemblyTokenBudget = 10;

    const resultTrace = await engine.execute(trace, context);
    const assembly = resultTrace.contextAssembly;

    expect(assembly).toBeDefined();
    // Required blocks must still be kept
    const hasPlanning = assembly?.blocks.some(b => b.category === 'planning');
    const hasPersonality = assembly?.blocks.some(b => b.category === 'personality');
    expect(hasPlanning).toBe(true);
    expect(hasPersonality).toBe(true);
    expect(assembly?.trimmedBlocks.length).toBeGreaterThan(0);
  });

  it('should conservative aggregate confidence values', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    trace.confidence = 0.9;
    trace.cognitiveDecision!.confidence = 0.85;
    trace.personalityDecision!.confidence = 0.75;

    const resultTrace = await engine.execute(trace, context);
    expect(resultTrace.contextAssembly?.confidence).toBe(0.75); // minimum value
  });

  it('should mark assembly incomplete rather than injecting fake blocks if required data is missing', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    // Wipe required blocks data
    trace.responsePlan = undefined;
    trace.cognitiveDecision = undefined;
    trace.personalityDecision = undefined;

    const resultTrace = await engine.execute(trace, context);
    const assembly = resultTrace.contextAssembly;

    expect(assembly?.isIncomplete).toBe(true);
    // Ensure no fake blocks were generated/inserted
    const hasPlanning = assembly?.blocks.some(b => b.category === 'planning');
    expect(hasPlanning).toBe(false);
  });

  it('should deduce generation intents correctly', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    // Trace state Listening, dominantNeed comfort -> 'comfort'
    trace.cognitiveDecision!.dominantNeed = 'comfort';
    let resultTrace = await engine.execute(trace, context);
    expect(resultTrace.contextAssembly?.generationIntent).toBe('comfort');

    // DominantNeed celebrate -> 'celebration'
    trace.cognitiveDecision!.dominantNeed = 'celebrate';
    resultTrace = await engine.execute(trace, context);
    expect(resultTrace.contextAssembly?.generationIntent).toBe('celebration');

    // DominantNeed guide -> 'guidance'
    trace.cognitiveDecision!.dominantNeed = 'guide';
    resultTrace = await engine.execute(trace, context);
    expect(resultTrace.contextAssembly?.generationIntent).toBe('guidance');
  });

  it('should play nicely with speculative cache invalidation BFS & fingerprinting', () => {
    const trace = getBaseTrace();
    const fingerprints = generateFingerprints(trace);

    // Fingerprint map must include 'Context Assembly Engine'
    expect(fingerprints['Context Assembly Engine']).toBeDefined();

    // Invalidation resolves correctly
    const normMatches = resolveInvalidatedEngines('Hello', 'Hello');
    expect(normMatches.has('Context Assembly Engine')).toBe(true);
    expect(normMatches.has('Decision Readiness Engine')).toBe(true);
    expect(normMatches.has('Mascot Specialist')).toBe(true);

    expect(PIPELINE_VERSION).toBe('v1.8.0');
  });
});
