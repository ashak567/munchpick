import { describe, it, expect } from 'vitest';
import { PromptBuilderEngine } from './prompt-builder';
import { CognitiveTrace, ContextPackage } from './types';
import { resolveInvalidatedEngines, generateFingerprints, PIPELINE_VERSION } from './speculative';

describe('Prompt Builder Engine Tests', () => {
  const engine = new PromptBuilderEngine();

  const getBaseTrace = (): CognitiveTrace => ({
    state: 'Listening',
    emotions: ['happy'],
    reflections: [],
    readinessScore: 0.5,
    readinessThreshold: 0.65,
    mascotCharacter: 'munch',
    mascotExpression: 'idle',
    mascotReason: 'Default Mascot',
    generatedPaths: [],
    confidence: 0.9,
    activeTopicKey: 'topic_a',
    contextAssembly: {
      blocks: [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 10,
          sourceIds: ['nlu'],
          content: { userInput: 'Hello Munch!' }
        }
      ],
      totalEstimatedTokens: 10,
      trimmedBlocks: [],
      duplicateBlocksMerged: 0,
      confidence: 0.9,
      pipelineVersion: 'v1.4.0',
      assemblyOrder: ['conversation'],
      isIncomplete: false,
      generationIntent: 'comfort',
      assemblyMetrics: { totalBlocks: 1, mergedBlocks: 0, trimmedBlocks: 0, skippedBlocks: 0, estimatedTokens: 10 },
      providerHints: { supportsStreaming: true, supportsVision: false, supportsReasoning: false }
    },
    mascotDecision: {
      mascotId: 'pandy',
      identity: 'Pandy the comfort guidance counselor panda.',
      behavior: 'Comfort-first validator.',
      speakingStyle: 'Soft, gentle, warm, and highly comforting.',
      emotionalStyle: 'Very warm, soothing, and deeply validating.',
      interactionStyle: 'Comfort-first, non-demanding, supportive presence.'
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
      responseConstraints: { avoidHumor: true, avoidLongReplies: true, avoidQuestions: false, avoidChallenges: false }
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
    user_input: 'Hello Munch!',
    options: [],
    profile_beliefs: [],
    relevant_memories: [],
    decision_history: []
  });

  it('should successfully build prompt package and faithfully transfer mascotDecision without deciding', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    const resultTrace = await engine.execute(trace, context);
    const pkg = resultTrace.promptPackage;

    expect(pkg).toBeDefined();
    expect(pkg?.version).toBe('v1.7.0');
    expect(pkg?.templateVersion).toBe('v1.0.0');

    // Confirm identity section exists and contains MascotDecision identity/speakingStyle directly
    const identitySection = pkg?.sections.find(s => s.type === 'identity');
    expect(identitySection).toBeDefined();
    const identityContent = identitySection?.content as any;
    expect(identityContent?.mascotId).toBe('pandy');
    expect(identityContent?.speakingStyle).toBe('Soft, gentle, warm, and highly comforting.');
    expect(identityContent?.emotionalStyle).toBe('Very warm, soothing, and deeply validating.');
    expect(identityContent?.interactionStyle).toBe('Comfort-first, non-demanding, supportive presence.');
  });

  it('should order prompt sections deterministically by priority descending', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    const resultTrace = await engine.execute(trace, context);
    const sections = resultTrace.promptPackage?.sections || [];

    expect(sections.length).toBeGreaterThan(3);
    for (let i = 0; i < sections.length - 1; i++) {
      expect(sections[i].priority).toBeGreaterThanOrEqual(sections[i + 1].priority);
    }
  });

  it('should exclude internal cognitive fields like confidence or priorities from section content', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    const resultTrace = await engine.execute(trace, context);
    const sections = resultTrace.promptPackage?.sections || [];

    for (const section of sections) {
      const contentStr = JSON.stringify(section.content);
      expect(contentStr).not.toContain('"confidence"');
      expect(contentStr).not.toContain('"priority"');
      expect(contentStr).not.toContain('"importance"');
      expect(contentStr).not.toContain('"fingerprints"');
    }
  });

  it('should build directives (mustDo, shouldDo, avoid) correctly', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    const resultTrace = await engine.execute(trace, context);
    const directives = resultTrace.promptPackage?.directives;

    expect(directives).toBeDefined();
    expect(directives?.mustDo).toContain('Validate the user\'s active emotion.');
    expect(directives?.avoid).toContain('Avoid using humor or making jokes.');
    expect(directives?.avoid).toContain('Avoid long-winded replies; keep sentences concise.');
  });

  it('should support structured JSON record payloads in section content', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    const resultTrace = await engine.execute(trace, context);
    const personalitySection = resultTrace.promptPackage?.sections.find(s => s.type === 'personality');

    expect(personalitySection?.content).toBeTypeOf('object');
    const content = personalitySection?.content as Record<string, any>;
    expect(content.dominantTrait).toBe('empathetic');
  });

  it('should produce a stable and identical checksum for identical traces', async () => {
    const trace1 = getBaseTrace();
    const trace2 = getBaseContext();

    const result1 = await engine.execute(trace1, trace2);
    const result2 = await engine.execute(trace1, trace2);

    expect(result1.promptPackage?.checksum).toBe(result2.promptPackage?.checksum);
    expect(result1.promptPackage?.checksum.length).toBe(64); // SHA-256 hex length
  });

  it('should populate statistics with estimated tokens and compression ratios', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    const resultTrace = await engine.execute(trace, context);
    const stats = resultTrace.promptPackage?.statistics;

    expect(stats?.sections).toBe(resultTrace.promptPackage?.sections.length);
    expect(stats?.estimatedTokens).toBeGreaterThan(0);
    expect(stats?.compressionRatio).toBeDefined();
  });

  it('should carry through renderStrategy and preserve providerHints', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    const resultTrace = await engine.execute(trace, context);
    const pkg = resultTrace.promptPackage;

    // renderStrategy mapped from trace.contextAssembly.generationIntent
    expect(pkg?.renderStrategy).toBe('comfort');
    expect(pkg?.providerHints?.supportsStreaming).toBe(true);
    expect(pkg?.providerHints?.supportsVision).toBe(false);
  });

  it('should validate package and degrade to isIncomplete = true if required sections are missing', async () => {
    const trace = getBaseTrace();
    const context = getBaseContext();

    // Wipe response plan to cause missing required section
    trace.responsePlan = undefined;

    const resultTrace = await engine.execute(trace, context);
    const pkg = resultTrace.promptPackage;

    expect(pkg?.isIncomplete).toBe(true);
    expect(pkg?.sections.some(s => s.type === 'response_plan')).toBe(false);
  });

  it('should play nicely with speculative cache BFS & fingerprinting', () => {
    const trace = getBaseTrace();
    const fingerprints = generateFingerprints(trace);

    // Fingerprint map must include 'Prompt Builder Engine'
    expect(fingerprints['Prompt Builder Engine']).toBeDefined();

    // Invalidation resolves correctly
    const normMatches = resolveInvalidatedEngines('Hello', 'Hello');
    expect(normMatches.has('Prompt Builder Engine')).toBe(true);
    expect(normMatches.has('Mascot Specialist')).toBe(true);

    expect(PIPELINE_VERSION).toBe('v1.8.0');
  });
});
