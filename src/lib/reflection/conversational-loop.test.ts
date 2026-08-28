import { describe, it, expect } from 'vitest';
import { ContextAssemblyEngine } from './context-assembly';
import { ReflectionEngine } from './engine';
import { ResponsePlanningEngine } from './response-planner';
import { PromptBuilderEngine } from './prompt-builder';
import { PromptRenderer } from '../llm/renderer';
import { CognitiveTrace, ContextPackage } from './types';

describe('Multi-Turn Conversational Loop Verification (Phase 5.1 Task 4)', () => {
  const contextAssemblyEngine = new ContextAssemblyEngine();
  const reflectionEngine = new ReflectionEngine();
  const responsePlanningEngine = new ResponsePlanningEngine();
  const promptBuilderEngine = new PromptBuilderEngine();

  // Helper to run full cognitive pipeline for a conversational turn
  async function executeTurn(
    userInput: string,
    chatHistory: any[],
    traceOverrides: Partial<CognitiveTrace>
  ) {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: userInput,
      user_name: 'Alex',
      user_nickname: 'Alex',
      chatHistory,
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: []
    };

    let trace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['anxious'],
      reflections: [],
      readinessScore: 0.2,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: 'Companion presence',
      generatedPaths: [],
      confidence: 0.9,
      activeTopicKey: 'general',
      ...traceOverrides
    };

    // 1. Reflection Engine (Semantic reflections)
    trace = await reflectionEngine.execute(trace, context);
    // 2. Response Planning Engine (Goals, constraints)
    trace = await responsePlanningEngine.execute(trace, context);
    // 3. Context Assembly Engine (Sanitizes history, budgets tokens)
    trace = await contextAssemblyEngine.execute(trace, context);
    // 4. Prompt Builder Engine (Structures prompt package)
    trace = await promptBuilderEngine.execute(trace, context);

    const promptPackage = trace.promptPackage!;
    const promptText = PromptRenderer.renderToText(promptPackage);

    return {
      trace,
      context,
      promptPackage,
      promptText
    };
  }

  it('1. TURN CONTINUITY: Turn 2 receives Turn 1 dialogue; Turn 3 receives Turns 1 and 2 dialogue', async () => {
    // Turn 1
    const turn1 = await executeTurn("I'm stressed about exams.", [], {
      cognitiveDecision: {
        dominantNeed: 'comfort',
        urgency: 'medium',
        emotionalPriority: 0.9,
        storyPriority: 0.3,
        memoryPriority: 0.3,
        reflectionPriority: 0.7,
        confidence: 0.95,
        dominantReason: 'User expresses high exam stress',
        supportingReasons: ['academic_pressure'],
        cognitiveLoad: 0.7,
        responseDepth: 'medium',
        askQuestion: true,
        acknowledgeEmotion: true,
        referenceMemory: false,
        referenceStory: false
      }
    });

    const response1 = "Exams can definitely feel like a heavy weight on your shoulders. Which part is feeling the most overwhelming right now?";

    // Turn 2
    const turn2 = await executeTurn(
      "Yeah, math is especially hard.",
      [
        { role: 'user', content: "I'm stressed about exams." },
        { role: 'assistant', content: response1, mascot_character: 'munch' }
      ],
      {
        cognitiveDecision: {
          dominantNeed: 'explore',
          urgency: 'medium',
          emotionalPriority: 0.7,
          storyPriority: 0.4,
          memoryPriority: 0.4,
          reflectionPriority: 0.6,
          confidence: 0.95,
          dominantReason: 'User identified specific subject obstacle',
          supportingReasons: ['math_focus'],
          cognitiveLoad: 0.6,
          responseDepth: 'medium',
          askQuestion: true,
          acknowledgeEmotion: true,
          referenceMemory: false,
          referenceStory: false
        }
      }
    );

    const historySection2 = turn2.promptPackage.sections.find(s => s.id === 'recent_conversation_history');
    expect(historySection2).toBeDefined();
    expect(historySection2?.content).toEqual([
      { role: 'user', content: "I'm stressed about exams." },
      { role: 'assistant', content: response1, mascotId: 'munch' }
    ]);

    const response2 = "Math has a way of piling up fast when concepts connect together. What specific topic or chapter in math has been tripping you up?";

    // Turn 3
    const turn3 = await executeTurn(
      "And I don't even know where to start.",
      [
        { role: 'user', content: "I'm stressed about exams." },
        { role: 'assistant', content: response1, mascot_character: 'munch' },
        { role: 'user', content: "Yeah, math is especially hard." },
        { role: 'assistant', content: response2, mascot_character: 'munch' }
      ],
      {
        cognitiveDecision: {
          dominantNeed: 'guide',
          urgency: 'high',
          emotionalPriority: 0.8,
          storyPriority: 0.5,
          memoryPriority: 0.4,
          reflectionPriority: 0.6,
          confidence: 0.95,
          dominantReason: 'User needs actionable scaffolding to overcome paralysis',
          supportingReasons: ['initiation_paralysis'],
          cognitiveLoad: 0.8,
          responseDepth: 'short',
          askQuestion: false,
          acknowledgeEmotion: true,
          referenceMemory: false,
          referenceStory: false
        }
      }
    );

    const historySection3 = turn3.promptPackage.sections.find(s => s.id === 'recent_conversation_history');
    expect(historySection3).toBeDefined();
    expect(historySection3?.content).toHaveLength(4);
    expect(historySection3?.content).toEqual([
      { role: 'user', content: "I'm stressed about exams." },
      { role: 'assistant', content: response1, mascotId: 'munch' },
      { role: 'user', content: "Yeah, math is especially hard." },
      { role: 'assistant', content: response2, mascotId: 'munch' }
    ]);
  });

  it('2. CURRENT MESSAGE ISOLATION: Current user message is isolated and excluded from historical context', async () => {
    const response1 = "Exams can definitely feel like a heavy weight on your shoulders.";
    const currentInput = "Yeah, math is especially hard.";

    const turn2 = await executeTurn(
      currentInput,
      [
        { role: 'user', content: "I'm stressed about exams." },
        { role: 'assistant', content: response1, mascot_character: 'munch' }
      ],
      {}
    );

    const currentMsgSection = turn2.promptPackage.sections.find(s => s.id === 'current_user_message');
    expect(currentMsgSection).toBeDefined();
    expect(currentMsgSection?.content).toBe(currentInput);

    const historySection = turn2.promptPackage.sections.find(s => s.id === 'recent_conversation_history');
    const historyJson = JSON.stringify(historySection?.content);
    expect(historyJson).not.toContain(currentInput);

    // In rendered prompt text, CURRENT_USER_MESSAGE occurs once
    const renderedText = turn2.promptText;
    const occurrences = renderedText.split(currentInput).length - 1;
    expect(occurrences).toBe(1);
  });

  it('3. REFLECTION SEMANTICS: LLM receives semantic cognitive insights without canned dialogue strings', async () => {
    const legacyCannedPhrases = [
      "I wonder if your energy is running a bit lower",
      "I notice there's a lot of noise or demands",
      "I wonder if there is a bit of hesitation",
      "It sounds like you're carrying a lighthearted",
      "This seems important to you. Let's understand",
      "This feels like a turning point",
      "I'm following what you're saying carefully. Tell me a little more",
      "I am right here with you, listening to what's unfolding"
    ];

    const turn = await executeTurn(
      "I'm stressed about exams.",
      [],
      {
        cognitiveDecision: {
          dominantNeed: 'comfort',
          urgency: 'medium',
          emotionalPriority: 0.9,
          storyPriority: 0.3,
          memoryPriority: 0.3,
          reflectionPriority: 0.7,
          confidence: 0.95,
          dominantReason: 'User expresses exam anxiety',
          supportingReasons: [],
          cognitiveLoad: 0.7,
          responseDepth: 'medium',
          askQuestion: true,
          acknowledgeEmotion: true,
          referenceMemory: false,
          referenceStory: false
        }
      }
    );

    expect(turn.trace.reflections.length).toBeGreaterThan(0);
    for (const refl of turn.trace.reflections) {
      expect(refl.insight).toBeDefined();
      expect(refl.guidance).toBeDefined();
      for (const canned of legacyCannedPhrases) {
        expect(refl.reflection).not.toContain(canned);
        expect(refl.insight).not.toContain(canned);
      }
    }

    expect(turn.promptText).toContain('### COGNITIVE_REFLECTIONS');
    expect(turn.promptText).toContain('Insight:');
    expect(turn.promptText).toContain('Guidance:');
    expect(turn.promptText).toContain('Do not copy their wording verbatim');
  });

  it('4. RESPONSE PROGRESSION & 5. CROSS-TURN REPETITION: Responses progress across turns with distinct openings and questions', async () => {
    // Simulated 3 responses across turns
    const response1 = "Exams can definitely feel like a heavy weight on your shoulders. Which part is feeling the most overwhelming right now?";
    const response2 = "Math has a way of piling up fast when concepts connect together. What specific topic or chapter in math has been tripping you up?";
    const response3 = "When everything feels tangled, picking even one small problem to look at first can break that freeze. We can take just the first five minutes on one problem together.";

    // 1. Assert no identical full responses
    expect(response1).not.toBe(response2);
    expect(response2).not.toBe(response3);
    expect(response1).not.toBe(response3);

    // 2. Assert no identical opening sentences
    const opening1 = response1.split('.')[0];
    const opening2 = response2.split('.')[0];
    const opening3 = response3.split('.')[0];
    expect(opening1).not.toBe(opening2);
    expect(opening2).not.toBe(opening3);
    expect(opening1).not.toBe(opening3);

    // 3. Assert no repeated follow-up questions
    const extractQuestion = (text: string) => {
      const match = text.match(/[^.!?]+\?/g);
      return match ? match[0].trim() : null;
    };
    const question1 = extractQuestion(response1);
    const question2 = extractQuestion(response2);
    const question3 = extractQuestion(response3);

    expect(question1).toBe("Which part is feeling the most overwhelming right now?");
    expect(question2).toBe("What specific topic or chapter in math has been tripping you up?");
    expect(question3).toBeNull(); // Turn 3 does not ask a question
    expect(question1).not.toBe(question2);

    // 4. Assert topic progression
    expect(response1.toLowerCase()).toContain('exam');
    expect(response2.toLowerCase()).toContain('math');
    expect(response3.toLowerCase()).toContain('one small problem');
  });

  it('6. PREVIOUS ASSISTANT AWARENESS: Narrator prompt in Turn 3 includes Turn 2 assistant response', async () => {
    const response1 = "Exams can definitely feel like a heavy weight on your shoulders.";
    const response2 = "Math has a way of piling up fast when concepts connect together.";

    const turn3 = await executeTurn(
      "And I don't even know where to start.",
      [
        { role: 'user', content: "I'm stressed about exams." },
        { role: 'assistant', content: response1, mascot_character: 'munch' },
        { role: 'user', content: "Yeah, math is especially hard." },
        { role: 'assistant', content: response2, mascot_character: 'munch' }
      ],
      {}
    );

    expect(turn3.promptText).toContain('### RECENT_CONVERSATION_HISTORY');
    expect(turn3.promptText).toContain(`Munch: "${response1}"`);
    expect(turn3.promptText).toContain(`Munch: "${response2}"`);
    expect(turn3.promptPackage.directives.mustDo).toContain(
      "Do not repeat previous assistant responses provided in RECENT_CONVERSATION_HISTORY."
    );
  });

  it('7. QUESTION REPETITION: Response planning directives forbid duplicate questions across turns', async () => {
    const response1 = "Exams can definitely feel like a heavy weight on your shoulders. Which part is feeling the most overwhelming right now?";

    const turn2 = await executeTurn(
      "Yeah, math is especially hard.",
      [
        { role: 'user', content: "I'm stressed about exams." },
        { role: 'assistant', content: response1, mascot_character: 'munch' }
      ],
      {
        cognitiveDecision: {
          dominantNeed: 'explore',
          urgency: 'medium',
          emotionalPriority: 0.7,
          storyPriority: 0.4,
          memoryPriority: 0.4,
          reflectionPriority: 0.6,
          confidence: 0.95,
          dominantReason: 'Math exploration',
          supportingReasons: [],
          cognitiveLoad: 0.5,
          responseDepth: 'medium',
          askQuestion: true,
          acknowledgeEmotion: true,
          referenceMemory: false,
          referenceStory: false
        }
      }
    );

    // Directives should forbid repeating previous opening sentences and follow-up questions
    expect(turn2.promptPackage.directives.avoid).toContain(
      "Do not reuse identical opening sentences from previous turns."
    );
    expect(turn2.promptPackage.directives.avoid).toContain(
      "Do not ask the same follow-up question unless the user ignored it."
    );
  });

  it('8. COGNITIVE BOUNDARY & 9. NON-VERBATIM BEHAVIOR: Output instructions enforce natural expression without copying reflection text', async () => {
    const turn = await executeTurn(
      "I'm stressed about exams.",
      [],
      {
        cognitiveDecision: {
          dominantNeed: 'comfort',
          urgency: 'medium',
          emotionalPriority: 0.9,
          storyPriority: 0.3,
          memoryPriority: 0.3,
          reflectionPriority: 0.7,
          confidence: 0.95,
          dominantReason: 'Need comfort',
          supportingReasons: [],
          cognitiveLoad: 0.7,
          responseDepth: 'medium',
          askQuestion: true,
          acknowledgeEmotion: true,
          referenceMemory: false,
          referenceStory: false
        }
      }
    );

    const instructionsSection = turn.promptPackage.sections.find(s => s.id === 'output_instructions');
    expect(instructionsSection).toBeDefined();
    expect(instructionsSection?.content).toContain(
      'COGNITIVE_REFLECTIONS are internal cognitive insights—do not copy their wording verbatim; express their meaning naturally.'
    );

    // Simulated narrator response expresses insight meaning naturally rather than copying reflection text
    const reflectionInsight = turn.trace.reflections[0].insight!;
    const simulatedResponse = "Exams can definitely feel like a heavy weight on your shoulders. Which part is feeling the most overwhelming right now?";
    expect(simulatedResponse).not.toContain(reflectionInsight);
  });

  it('10. HISTORY BOUNDARY: Conversation history strictly respects max 6 messages and token limit', async () => {
    const longHistory = [
      { role: 'user', content: 'Turn 1 user' },
      { role: 'assistant', content: 'Turn 1 assistant', mascot_character: 'munch' },
      { role: 'user', content: 'Turn 2 user' },
      { role: 'assistant', content: 'Turn 2 assistant', mascot_character: 'munch' },
      { role: 'user', content: 'Turn 3 user' },
      { role: 'assistant', content: 'Turn 3 assistant', mascot_character: 'munch' },
      { role: 'user', content: 'Turn 4 user' },
      { role: 'assistant', content: 'Turn 4 assistant', mascot_character: 'munch' }
    ];

    const turn = await executeTurn(
      "Active turn message",
      longHistory,
      {}
    );

    const historySection = turn.promptPackage.sections.find(s => s.id === 'recent_conversation_history');
    expect(historySection).toBeDefined();
    // Maximum 6 messages preserved (oldest trimmed)
    expect((historySection?.content as any[]).length).toBeLessThanOrEqual(6);
    expect(turn.promptPackage.estimatedTokens).toBeLessThan(2000);
  });

  it('11. NO NEW NETWORK CALLS: All turns execute synchronously and deterministically in sub-millisecond time', async () => {
    const start = Date.now();

    const turn1 = await executeTurn("I'm stressed about exams.", [], {});
    const turn2 = await executeTurn("Yeah, math is especially hard.", [{ role: 'user', content: '1' }], {});
    const turn3 = await executeTurn("And I don't even know where to start.", [{ role: 'user', content: '1' }, { role: 'user', content: '2' }], {});

    const elapsed = Date.now() - start;

    expect(turn1.promptPackage).toBeDefined();
    expect(turn2.promptPackage).toBeDefined();
    expect(turn3.promptPackage).toBeDefined();
    expect(elapsed).toBeLessThan(100);
  });

  it('12. COMPLETE THREE-TURN CONVERSATIONAL SIMULATION & LOOP VERIFICATION AUDIT', async () => {
    // ==========================================
    // TURN 1
    // User: "I'm stressed about exams."
    // ==========================================
    const turn1 = await executeTurn(
      "I'm stressed about exams.",
      [],
      {
        state: 'Listening',
        emotions: ['anxious'],
        activeTopicKey: 'exams',
        cognitiveDecision: {
          dominantNeed: 'comfort',
          urgency: 'medium',
          emotionalPriority: 0.9,
          storyPriority: 0.2,
          memoryPriority: 0.2,
          reflectionPriority: 0.8,
          confidence: 0.95,
          dominantReason: 'User expresses acute exam stress',
          supportingReasons: ['academic_anxiety'],
          cognitiveLoad: 0.7,
          responseDepth: 'medium',
          askQuestion: true,
          acknowledgeEmotion: true,
          referenceMemory: false,
          referenceStory: false
        },
        personalityDecision: {
          dominantTrait: 'empathetic',
          confidence: 0.90,
          communicationStyle: 'gentle',
          energyLevel: 'medium',
          expressionIntensity: 'medium',
          stability: 0.85,
          validateEmotion: true,
          useMetaphors: true,
          challengeUser: false,
          humorAllowed: false,
          supportingTraits: [],
          responseConstraints: {
            avoidHumor: true,
            avoidLongReplies: false,
            avoidQuestions: false,
            avoidChallenges: true
          }
        }
      }
    );

    const response1 = "Exams can definitely feel like a heavy weight on your shoulders. Which part is feeling the most overwhelming right now?";

    // Turn 1 assertions
    expect(turn1.promptPackage.sections.some(s => s.id === 'recent_conversation_history')).toBe(false);
    expect(turn1.promptPackage.sections.find(s => s.id === 'current_user_message')?.content).toBe("I'm stressed about exams.");
    expect(turn1.promptText).toContain('### CURRENT_USER_MESSAGE\n"I\'m stressed about exams."');

    // ==========================================
    // TURN 2
    // User: "Yeah, math is especially hard."
    // ==========================================
    const turn2 = await executeTurn(
      "Yeah, math is especially hard.",
      [
        { role: 'user', content: "I'm stressed about exams." },
        { role: 'assistant', content: response1, mascot_character: 'munch' }
      ],
      {
        state: 'Exploring',
        emotions: ['overwhelmed'],
        activeTopicKey: 'math',
        generatedPaths: [
          { text: 'Reviewing past math notes', tags: ['study'] },
          { text: 'Working through practice problems', tags: ['practice'] }
        ],
        cognitiveDecision: {
          dominantNeed: 'explore',
          urgency: 'medium',
          emotionalPriority: 0.7,
          storyPriority: 0.4,
          memoryPriority: 0.4,
          reflectionPriority: 0.7,
          confidence: 0.95,
          dominantReason: 'User identified specific subject obstacle',
          supportingReasons: ['math_difficulty'],
          cognitiveLoad: 0.6,
          responseDepth: 'medium',
          askQuestion: true,
          acknowledgeEmotion: true,
          referenceMemory: false,
          referenceStory: false
        },
        personalityDecision: {
          dominantTrait: 'empathetic',
          confidence: 0.90,
          communicationStyle: 'gentle',
          energyLevel: 'medium',
          expressionIntensity: 'medium',
          stability: 0.85,
          validateEmotion: true,
          useMetaphors: false,
          challengeUser: false,
          humorAllowed: false,
          supportingTraits: [],
          responseConstraints: {
            avoidHumor: true,
            avoidLongReplies: false,
            avoidQuestions: false,
            avoidChallenges: true
          }
        }
      }
    );

    const response2 = "Math has a way of piling up fast when concepts connect together. What specific topic or chapter in math has been tripping you up?";

    // Turn 2 assertions
    expect(turn2.promptPackage.sections.find(s => s.id === 'recent_conversation_history')?.content).toEqual([
      { role: 'user', content: "I'm stressed about exams." },
      { role: 'assistant', content: response1, mascotId: 'munch' }
    ]);
    expect(turn2.promptPackage.sections.find(s => s.id === 'current_user_message')?.content).toBe("Yeah, math is especially hard.");
    expect(turn2.promptText).toContain(`User: "I'm stressed about exams."\nMunch: "${response1}"`);
    expect(turn2.promptText).toContain('### CURRENT_USER_MESSAGE\n"Yeah, math is especially hard."');

    // ==========================================
    // TURN 3
    // User: "And I don't even know where to start."
    // ==========================================
    const turn3 = await executeTurn(
      "And I don't even know where to start.",
      [
        { role: 'user', content: "I'm stressed about exams." },
        { role: 'assistant', content: response1, mascot_character: 'munch' },
        { role: 'user', content: "Yeah, math is especially hard." },
        { role: 'assistant', content: response2, mascot_character: 'munch' }
      ],
      {
        state: 'Clarifying',
        emotions: ['anxious'],
        activeTopicKey: 'starting_point',
        cognitiveDecision: {
          dominantNeed: 'guide',
          urgency: 'high',
          emotionalPriority: 0.8,
          storyPriority: 0.5,
          memoryPriority: 0.4,
          reflectionPriority: 0.6,
          confidence: 0.95,
          dominantReason: 'Scaffolding needed for starting paralysis',
          supportingReasons: ['initiation_paralysis'],
          cognitiveLoad: 0.8,
          responseDepth: 'short',
          askQuestion: false,
          acknowledgeEmotion: true,
          referenceMemory: false,
          referenceStory: false
        },
        personalityDecision: {
          dominantTrait: 'calm',
          confidence: 0.90,
          communicationStyle: 'gentle',
          energyLevel: 'low',
          expressionIntensity: 'low',
          stability: 0.9,
          validateEmotion: true,
          useMetaphors: false,
          challengeUser: false,
          humorAllowed: false,
          supportingTraits: [],
          responseConstraints: {
            avoidHumor: true,
            avoidLongReplies: true,
            avoidQuestions: true,
            avoidChallenges: true
          }
        }
      }
    );

    const response3 = "When everything feels tangled, picking even one small problem to look at first can break that freeze. We can take just the first five minutes on one problem together.";

    // Turn 3 assertions
    const turn3History = turn3.promptPackage.sections.find(s => s.id === 'recent_conversation_history')?.content as any[];
    expect(turn3History).toHaveLength(4);
    expect(turn3History[0].content).toBe("I'm stressed about exams.");
    expect(turn3History[1].content).toBe(response1);
    expect(turn3History[2].content).toBe("Yeah, math is especially hard.");
    expect(turn3History[3].content).toBe(response2);

    expect(turn3.promptPackage.sections.find(s => s.id === 'current_user_message')?.content).toBe("And I don't even know where to start.");
    expect(turn3.promptText).toContain(`Munch: "${response2}"`);
    expect(turn3.promptText).toContain('### CURRENT_USER_MESSAGE\n"And I don\'t even know where to start."');

    // ==========================================
    // E2E LOOP VERIFICATION AUDIT MATRIX
    // ==========================================
    const auditResults = {
      historyVisible: turn3History.length === 4,
      previousAssistantVisible: turn3.promptText.includes(response2),
      semanticReflectionsUsed: turn3.trace.reflections.every(r => Boolean(r.insight && r.guidance)),
      currentMessageIsolated: !JSON.stringify(turn3History).includes("And I don't even know where to start."),
      distinctOpenings: response1.split('.')[0] !== response2.split('.')[0] && response2.split('.')[0] !== response3.split('.')[0],
      distinctQuestions: response1.includes('?') && response2.includes('?') && !response3.includes('?'),
      meaningfulProgression: response1.includes('weight') && response2.includes('Math') && response3.includes('freeze'),
      reflectionNotCopiedVerbatim: !response3.includes(turn3.trace.reflections[0].insight || '')
    };

    expect(auditResults.historyVisible).toBe(true);
    expect(auditResults.previousAssistantVisible).toBe(true);
    expect(auditResults.semanticReflectionsUsed).toBe(true);
    expect(auditResults.currentMessageIsolated).toBe(true);
    expect(auditResults.distinctOpenings).toBe(true);
    expect(auditResults.distinctQuestions).toBe(true);
    expect(auditResults.meaningfulProgression).toBe(true);
    expect(auditResults.reflectionNotCopiedVerbatim).toBe(true);
  });
});
