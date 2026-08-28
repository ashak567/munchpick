import { describe, it, expect } from 'vitest';
import { PromptBuilderEngine } from './prompt-builder';
import { CognitiveTrace, ContextPackage } from './types';
import { resolveInvalidatedEngines, generateFingerprints, PIPELINE_VERSION } from './speculative';
import { PromptRenderer } from '../llm/renderer';

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

  describe('PromptBuilder Conversation Context Integration Tests (Phase 5.1 Task 2)', () => {
    it('A. should map recentHistory into RECENT_CONVERSATION_HISTORY section', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      trace.contextAssembly!.blocks = [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 10,
          sourceIds: ['nlu'],
          content: {
            userInput: 'And I do not know where to start.',
            recentHistory: [
              { role: 'user', content: "I'm stressed about exams." },
              { role: 'assistant', content: 'Exams can feel overwhelming.', mascotId: 'munch' }
            ]
          }
        }
      ];

      const resultTrace = await engine.execute(trace, context);
      const pkg = resultTrace.promptPackage!;

      const historySection = pkg.sections.find(s => s.id === 'recent_conversation_history');
      expect(historySection).toBeDefined();
      expect(historySection?.type).toBe('conversation');
      expect(historySection?.priority).toBe(0.45);
      expect(Array.isArray(historySection?.content)).toBe(true);
      expect(historySection?.content).toEqual([
        { role: 'user', content: "I'm stressed about exams." },
        { role: 'assistant', content: 'Exams can feel overwhelming.', mascotId: 'munch' }
      ]);
    });

    it('B. should render previous user and assistant messages clearly in PromptRenderer', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      trace.contextAssembly!.blocks = [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 10,
          sourceIds: ['nlu'],
          content: {
            userInput: 'And I do not know where to start.',
            recentHistory: [
              { role: 'user', content: "I'm stressed about exams." },
              { role: 'assistant', content: 'Exams can feel overwhelming.', mascotId: 'munch' }
            ]
          }
        }
      ];

      const resultTrace = await engine.execute(trace, context);
      const renderedText = PromptRenderer.renderToText(resultTrace.promptPackage!);

      expect(renderedText).toContain('### RECENT_CONVERSATION_HISTORY');
      expect(renderedText).toContain('User: "I\'m stressed about exams."');
      expect(renderedText).toContain('Munch: "Exams can feel overwhelming."');
    });

    it('C. should place current user message in separate CURRENT_USER_MESSAGE section', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      trace.contextAssembly!.blocks = [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 10,
          sourceIds: ['nlu'],
          content: {
            userInput: 'And I do not know where to start.',
            recentHistory: [
              { role: 'user', content: "I'm stressed about exams." }
            ]
          }
        }
      ];

      const resultTrace = await engine.execute(trace, context);
      const pkg = resultTrace.promptPackage!;

      const currentMsgSection = pkg.sections.find(s => s.id === 'current_user_message');
      expect(currentMsgSection).toBeDefined();
      expect(currentMsgSection?.type).toBe('conversation');
      expect(currentMsgSection?.priority).toBe(0.40);
      expect(currentMsgSection?.content).toBe('And I do not know where to start.');
    });

    it('D. should ensure the current message does not appear twice in the prompt package', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();
      const currentText = 'Only the active message here';

      trace.contextAssembly!.blocks = [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 10,
          sourceIds: ['nlu'],
          content: {
            userInput: currentText,
            recentHistory: [
              { role: 'user', content: 'Previous message 1' },
              { role: 'assistant', content: 'Previous message 2', mascotId: 'munch' }
            ]
          }
        }
      ];

      const resultTrace = await engine.execute(trace, context);
      const pkg = resultTrace.promptPackage!;

      const historySection = pkg.sections.find(s => s.id === 'recent_conversation_history');
      const historyStr = JSON.stringify(historySection?.content);
      expect(historyStr).not.toContain(currentText);

      const renderedText = PromptRenderer.renderToText(pkg);
      const currentOccurrences = renderedText.split(currentText).length - 1;
      // Should occur only once in the rendered output
      expect(currentOccurrences).toBe(1);
    });

    it('E. should handle empty or undefined recentHistory gracefully', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      trace.contextAssembly!.blocks = [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 10,
          sourceIds: ['nlu'],
          content: {
            userInput: 'Hello on turn 1'
          }
        }
      ];

      const resultTrace = await engine.execute(trace, context);
      const pkg = resultTrace.promptPackage!;

      expect(pkg.sections.some(s => s.id === 'recent_conversation_history')).toBe(false);
      const currentMsgSection = pkg.sections.find(s => s.id === 'current_user_message');
      expect(currentMsgSection).toBeDefined();
      expect(currentMsgSection?.content).toBe('Hello on turn 1');
    });

    it('F. should preserve mascot IDs when available and fallback to Assistant when not', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      trace.contextAssembly!.blocks = [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 10,
          sourceIds: ['nlu'],
          content: {
            userInput: 'Turn 3',
            recentHistory: [
              { role: 'assistant', content: 'Munch turn', mascotId: 'munch' },
              { role: 'assistant', content: 'Ollie turn', mascotId: 'ollie' },
              { role: 'assistant', content: 'Generic turn' }
            ]
          }
        }
      ];

      const resultTrace = await engine.execute(trace, context);
      const renderedText = PromptRenderer.renderToText(resultTrace.promptPackage!);

      expect(renderedText).toContain('Munch: "Munch turn"');
      expect(renderedText).toContain('Ollie: "Ollie turn"');
      expect(renderedText).toContain('Assistant: "Generic turn"');
    });

    it('G. should produce a valid SHA-256 checksum with new conversation sections', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      const resultTrace = await engine.execute(trace, context);
      const pkg = resultTrace.promptPackage!;

      expect(pkg.checksum).toBeDefined();
      expect(pkg.checksum.length).toBe(64);
    });

    it('H. should preserve all existing cognitive sections alongside conversation history', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      trace.contextAssembly!.blocks = [
        { id: 'personality_guidelines', category: 'personality', priority: 0.82, importance: 'high', required: true, estimatedTokens: 10, sourceIds: ['personality'], content: { dominantTrait: 'empathetic' } },
        { id: 'story_state', category: 'story', priority: 0.63, importance: 'medium', required: false, estimatedTokens: 10, sourceIds: ['story'], content: { activeArc: 'Exams' } },
        { id: 'memory_state', category: 'memory', priority: 0.58, importance: 'medium', required: false, estimatedTokens: 10, sourceIds: ['memory'], content: { memories: ['Passed math before'] } },
        { id: 'reflections', category: 'reflection', priority: 0.42, importance: 'medium', required: false, estimatedTokens: 10, sourceIds: ['reflection'], content: { reflections: ['Math is challenging'] } },
        { id: 'conversation_metadata', category: 'conversation', priority: 0.31, importance: 'medium', required: false, estimatedTokens: 10, sourceIds: ['nlu'], content: { userInput: 'Help', recentHistory: [{ role: 'user', content: 'Hi' }] } }
      ];

      const resultTrace = await engine.execute(trace, context);
      const types = resultTrace.promptPackage!.sections.map(s => s.type);

      expect(types).toContain('system');
      expect(types).toContain('identity');
      expect(types).toContain('personality');
      expect(types).toContain('story');
      expect(types).toContain('memory');
      expect(types).toContain('context');
      expect(types).toContain('conversation');
      expect(types).toContain('response_plan');
      expect(types).toContain('instructions');
    });

    it('I. should maintain token estimation with conversation history sections', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      trace.contextAssembly!.blocks = [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 20,
          sourceIds: ['nlu'],
          content: {
            userInput: 'Active prompt',
            recentHistory: [
              { role: 'user', content: 'First message' },
              { role: 'assistant', content: 'First reply', mascotId: 'munch' }
            ]
          }
        }
      ];

      const resultTrace = await engine.execute(trace, context);
      const pkg = resultTrace.promptPackage!;

      expect(pkg.estimatedTokens).toBeGreaterThan(0);
      expect(pkg.statistics.estimatedTokens).toBe(pkg.estimatedTokens);
    });

    it('J. should execute synchronously and deterministically without LLM calls', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      const start = Date.now();
      const resultTrace = await engine.execute(trace, context);
      const duration = Date.now() - start;

      expect(resultTrace.promptPackage).toBeDefined();
      expect(duration).toBeLessThan(50);
    });

    // MOST IMPORTANT TEST specified in Phase 5.1 Task 2 prompt
    it('MOST IMPORTANT TEST: should render exact multi-turn history and separate current user message', async () => {
      const trace = getBaseTrace();
      const context = getBaseContext();

      trace.contextAssembly!.blocks = [
        {
          id: 'conversation_metadata',
          category: 'conversation',
          priority: 0.31,
          importance: 'medium',
          required: false,
          estimatedTokens: 50,
          sourceIds: ['nlu'],
          content: {
            userInput: 'And I don\'t know where to start.',
            recentHistory: [
              { role: 'user', content: "I'm stressed about exams." },
              { role: 'assistant', content: 'Exams can feel overwhelming. Which subject is hardest?' },
              { role: 'user', content: 'Math is especially difficult.' },
              { role: 'assistant', content: "Let's look at what makes math feel difficult." }
            ]
          }
        }
      ];

      const resultTrace = await engine.execute(trace, context);
      const pkg = resultTrace.promptPackage!;
      const renderedText = PromptRenderer.renderToText(pkg);

      // 1. Must contain RECENT_CONVERSATION_HISTORY with the 4 previous messages
      expect(renderedText).toContain('### RECENT_CONVERSATION_HISTORY');
      expect(renderedText).toContain('User: "I\'m stressed about exams."');
      expect(renderedText).toContain('Assistant: "Exams can feel overwhelming. Which subject is hardest?"');
      expect(renderedText).toContain('User: "Math is especially difficult."');
      expect(renderedText).toContain('Assistant: "Let\'s look at what makes math feel difficult."');

      // 2. Must contain CURRENT_USER_MESSAGE with the current message
      expect(renderedText).toContain('### CURRENT_USER_MESSAGE');
      expect(renderedText).toContain('"And I don\'t know where to start."');

      // 3. Current message must occur only in the current user message section
      const occurrences = renderedText.split("And I don't know where to start.").length - 1;
      expect(occurrences).toBe(1);
    });
  });
});
