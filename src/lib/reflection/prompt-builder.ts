import * as crypto from 'crypto';
import {
  CognitiveEngine,
  CognitiveTrace,
  ContextPackage,
  PromptSection,
  PromptSectionType,
  PromptPackage,
  PromptDirective,
  PromptStatistics,
  RenderStrategy,
  ProviderHints
} from './types';
import { estimateTokens } from './context-assembly';
import { MASCOT_SELF_IDENTITIES } from '../mascots/self-identity';
import { MascotCharacter } from '../mascots/registry';

/**
 * Prompt Builder Engine.
 * Formats trace outputs and context into a deterministic, provider-agnostic prompt package.
 */
export class PromptBuilderEngine implements CognitiveEngine {
  public name = 'Prompt Builder Engine';

  private generateChecksum(sections: PromptSection[]): string {
    const rawString = sections
      .map(s => {
        const contentStr = typeof s.content === 'string' ? s.content : JSON.stringify(s.content);
        return s.id + ':' + s.type + ':' + s.priority + ':' + contentStr;
      })
      .join('|');
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  private getRenderStrategy(trace: CognitiveTrace): RenderStrategy {
    const intent = trace.contextAssembly?.generationIntent || 'conversation';
    const validStrategies: RenderStrategy[] = [
      'conversation', 'comfort', 'guidance', 'reflection', 'celebration',
      'problem_solving', 'creative', 'planning', 'education', 'brainstorm'
    ];
    if (validStrategies.includes(intent as any)) {
      return intent as RenderStrategy;
    }
    return 'conversation';
  }

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const sections: PromptSection[] = [];

    // 1. System Section
    sections.push({
      id: 'system_guidelines',
      type: 'system',
      priority: 1.0,
      required: true,
      content: 'You are an internal natural language renderer for Munch. Your sole responsibility is to translate structural cognitive state decisions into natural language. Do not make choices, decisions, or introduce new reasoning.'
    });

    // 2. Identity Section
    const mascot = trace.mascotDecision;
    const charId = (mascot?.mascotId || context.active_mascot || 'munch') as MascotCharacter;
    const selfIdentity = MASCOT_SELF_IDENTITIES[charId] || MASCOT_SELF_IDENTITIES.munch;
    sections.push({
      id: 'mascot_identity_' + charId,
      type: 'identity',
      priority: 0.9,
      required: true,
      content: {
        mascotId: charId,
        displayName: selfIdentity.displayName,
        species: selfIdentity.species,
        aliases: selfIdentity.aliases,
        identity: mascot?.identity || `Warm companion ${selfIdentity.displayName}`,
        behavior: mascot?.behavior || selfIdentity.personality,
        speakingStyle: mascot?.speakingStyle || selfIdentity.speakingStyle,
        emotionalStyle: mascot?.emotionalStyle || selfIdentity.personality,
        interactionStyle: mascot?.interactionStyle || selfIdentity.conversationalRole,
        selfAwarenessPersona: selfIdentity.selfAwarenessPersona,
        selfAwarenessGuidance:
          "You have a distinct sense of self as this companion. When the user discusses you, your name, 'you', nicknames, or references building or troubleshooting you, respond naturally in first-person ('I', 'me', 'my', 'myself') in character. Never use 'I'm just an AI' or deny feelings.",
        voiceDetails: {
          vocabularyTheme: selfIdentity.voice.vocabulary,
          rhythmAndPacing: selfIdentity.voice.rhythmAndPacing,
          questionStyle: selfIdentity.voice.questionStyle,
          emotionalFraming: selfIdentity.voice.emotionalFraming,
          metaphorDomain: selfIdentity.voice.metaphorDomain,
          firstTurnStyleAnchor: selfIdentity.voice.firstTurnStyleAnchor,
          antiBleedRules: selfIdentity.voice.antiBleedRules
        }
      }
    });

    // 3. Personality Section
    const personality = trace.personalityDecision;
    if (personality) {
      sections.push({
        id: 'personality_guidelines',
        type: 'personality',
        priority: 0.8,
        required: true,
        content: {
          dominantTrait: personality.dominantTrait,
          communicationStyle: personality.communicationStyle,
          energyLevel: personality.energyLevel,
          expressionIntensity: personality.expressionIntensity
        }
      });
    }

    // 4. Story Section
    const storyBlock = trace.contextAssembly?.blocks.find(b => b.category === 'story');
    if (storyBlock) {
      sections.push({ id: 'story_context', type: 'story', priority: 0.7, required: false, content: storyBlock.content });
    }

    // 5. Memory Section
    const memoryBlock = trace.contextAssembly?.blocks.find(b => b.category === 'memory');
    if (memoryBlock) {
      sections.push({ id: 'memory_context', type: 'memory', priority: 0.6, required: false, content: memoryBlock.content });
    }

    // 6. Reflection/Context Section
    const reflectionBlock = trace.contextAssembly?.blocks.find(b => b.category === 'reflection');
    if (reflectionBlock) {
      sections.push({ id: 'cognitive_reflections', type: 'context', priority: 0.5, required: false, content: reflectionBlock.content });
    } else if (trace.reflections && trace.reflections.length > 0) {
      sections.push({ id: 'cognitive_reflections', type: 'context', priority: 0.5, required: false, content: { reflections: trace.reflections } });
    }

    // 7. Conversation Section
    const conversationBlock = trace.contextAssembly?.blocks.find(b => b.category === 'conversation');
    if (conversationBlock) {
      const recentHistory = conversationBlock.content?.recentHistory;
      if (Array.isArray(recentHistory) && recentHistory.length > 0) {
        sections.push({ id: 'recent_conversation_history', type: 'conversation', priority: 0.45, required: false, content: recentHistory });
      }
      const currentInput = typeof conversationBlock.content?.userInput === 'string'
        ? conversationBlock.content.userInput
        : (typeof context.user_input === 'string' ? context.user_input : '');
      sections.push({ id: 'current_user_message', type: 'conversation', priority: 0.40, required: true, content: currentInput });
    } else {
      const fallbackInput = typeof context?.user_input === 'string' ? context.user_input : '';
      sections.push({ id: 'current_user_message', type: 'conversation', priority: 0.40, required: true, content: fallbackInput });
    }

    // 8. Response Plan Section
    const plan = trace.responsePlan;
    if (plan) {
      sections.push({
        id: 'response_plan',
        type: 'response_plan',
        priority: 0.3,
        required: true,
        content: {
          responseGoal: plan.responseGoal,
          primaryTopic: plan.primaryTopic,
          secondaryTopics: plan.secondaryTopics,
          endingStyle: plan.endingStyle,
          maxQuestions: plan.maxQuestions
        }
      });
    }

    // 9. Forbidden Previous Responses Section (Hard anti-repetition guard)
    const recentAssistantResponses: string[] = (context.previousAssistantResponses || [])
      .filter((r: string) => r && r.trim().length > 0)
      .slice(-2);

    if (recentAssistantResponses.length > 0) {
      sections.push({
        id: 'forbidden_previous_responses',
        type: 'forbidden_responses',
        priority: 0.35,
        required: false,
        content: {
          instruction: 'Do not repeat, paraphrase too closely, or reuse the opening of any response listed below. Respond naturally to the CURRENT_USER_MESSAGE instead.',
          responses: recentAssistantResponses
        }
      });
    }

    // 10. Instructions Section
    sections.push({
      id: 'output_instructions',
      type: 'instructions',
      priority: 0.2,
      required: true,
      content: 'Construct the response strictly adhering to the response plan sections, personality guidelines, and active mascot speaking style. Respond directly to the CURRENT_USER_MESSAGE. If the user discusses you, your name, or your behavior/creation, acknowledge it with natural self-awareness in character. RECENT_CONVERSATION_HISTORY provides past dialogue context for continuity—use it to understand the ongoing conversation and avoid repeating previous assistant replies or questions. COGNITIVE_REFLECTIONS are internal cognitive insights—do not copy their wording verbatim; express their meaning naturally. FORBIDDEN_PREVIOUS_RESPONSES lists exact prior replies—never reproduce them. Do not leak internal tags, priorities, or cognitive scores in the output.'
    });

    // Sort by priority descending
    sections.sort((a, b) => b.priority - a.priority);

    // Build Directives
    const mustDo: string[] = [];
    const shouldDo: string[] = [];
    const avoid: string[] = [];

    if (personality) {
      if (personality.validateEmotion) mustDo.push("Validate the user's active emotion.");
      if (personality.useMetaphors) mustDo.push('Use metaphors to explain options where helpful.');
      if (personality.challengeUser) mustDo.push("Gently challenge the user's assumptions.");
      if (personality.humorAllowed === false) avoid.push('Avoid using humor or making jokes.');
      if (personality.responseConstraints?.avoidHumor) avoid.push('Do not use humor.');
      if (personality.responseConstraints?.avoidLongReplies) avoid.push('Avoid long-winded replies; keep sentences concise.');
      if (personality.responseConstraints?.avoidQuestions) avoid.push('Avoid asking questions.');
      if (personality.responseConstraints?.avoidChallenges) avoid.push('Avoid challenging the user.');
    }

    if (plan) {
      mustDo.push('Align response with target goal: ' + plan.responseGoal + '.');
      shouldDo.push('Incorporate ending style: ' + plan.endingStyle + '.');
      shouldDo.push('Keep the number of questions under the limit: ' + plan.maxQuestions + '.');
      if (plan.forbiddenReferences?.memory) avoid.push('Avoid repeating consolidated memories.');
      if (plan.forbiddenReferences?.story) avoid.push('Avoid references to past story arcs.');
      if (plan.forbiddenReferences?.humor) avoid.push('Avoid lighthearted humor.');
    }

    if (trace.retryHints) {
      const hints = trace.retryHints;
      if (hints.shorten) {
        mustDo.push('Keep output extremely brief (target 1 sentence, under 20 words).');
        avoid.push('Avoid long-winded paragraphs or elaborate descriptions.');
      }
      if (hints.removeHumor) avoid.push('Strictly avoid all jokes, humor, and lighthearted comments.');
      if (hints.reduceQuestions) avoid.push('Do not ask any questions.');
      if (hints.strengthenEmpathy) mustDo.push('Deliver extremely validating, supportive and comforting comments.');
      if (hints.improveFormatting) mustDo.push('Strictly output correct and properly balanced markdown block syntax.');
      if (hints.avoidRepetition) {
        mustDo.push('Write a substantively new answer that directly addresses the CURRENT_USER_MESSAGE.');
        avoid.push('Do not reuse an opening sentence, follow-up question, or response wording from RECENT_CONVERSATION_HISTORY.');
      }
    }

    if (mascot) {
      const selfIdentity = MASCOT_SELF_IDENTITIES[mascot.mascotId as MascotCharacter] || MASCOT_SELF_IDENTITIES.munch;
      mustDo.push(`Adhere strictly to ${selfIdentity.displayName}'s voice: ${selfIdentity.voice.rhythmAndPacing}`);
      avoid.push(selfIdentity.voice.antiBleedRules);
    }

    mustDo.push('Respond primarily to the CURRENT_USER_MESSAGE.');
    mustDo.push('Do not repeat previous assistant responses provided in RECENT_CONVERSATION_HISTORY.');
    mustDo.push('Express the semantic meaning of cognitive insights naturally without copying reflection wording verbatim.');
    shouldDo.push('When addressed directly or discussed, speak with authentic companion self-awareness in first-person.');
    avoid.push('Do not reuse identical opening sentences from previous turns.');
    avoid.push('Do not ask the same follow-up question unless the user ignored it.');
    avoid.push('Do not say "I am just an AI" or deny feelings and personality during companion conversation.');

    const directives: PromptDirective = { mustDo, shouldDo, avoid };

    const totalChars = sections.reduce((acc, s) => {
      const contentStr = typeof s.content === 'string' ? s.content : JSON.stringify(s.content);
      return acc + contentStr.length;
    }, 0);
    const estimatedTokens = estimateTokens(JSON.stringify(sections));
    const checksum = this.generateChecksum(sections);
    const compressionRatio = totalChars > 0 ? Number((estimatedTokens / (totalChars / 4)).toFixed(2)) : 1.0;

    const statistics: PromptStatistics = { sections: sections.length, estimatedTokens, checksum, compressionRatio };
    const renderStrategy = this.getRenderStrategy(trace);
    const providerHints: ProviderHints = trace.contextAssembly?.providerHints || {
      supportsStreaming: true,
      supportsVision: false,
      supportsReasoning: false
    };

    const promptPackage: PromptPackage = {
      version: 'v1.7.0',
      templateVersion: 'v1.0.0',
      sections,
      estimatedTokens,
      providerHints,
      checksum,
      directives,
      statistics,
      renderStrategy
    };

    // Validation (identity is optional; mascotDecision may be absent on new chats)
    const requiredTypes: PromptSectionType[] = ['system', 'personality', 'conversation', 'response_plan', 'instructions'];
    const missingType = requiredTypes.some(type => !sections.some(s => s.type === type));
    const hasDuplicates = new Set(sections.map(s => s.id)).size !== sections.length;
    const hasEmptySections = sections.some(s => {
      const contentStr = typeof s.content === 'string' ? s.content : JSON.stringify(s.content);
      return !contentStr.trim() || contentStr === '{}' || contentStr === '[]';
    });
    const reCalculatedChecksum = this.generateChecksum(sections);
    const checksumMismatch = checksum !== reCalculatedChecksum;

    if (missingType || hasDuplicates || hasEmptySections || checksumMismatch) {
      console.warn('[PromptBuilder] Validation warnings detected: missingRequired=' + missingType + ', duplicates=' + hasDuplicates + ', emptySections=' + hasEmptySections + ', checksumMismatch=' + checksumMismatch);
      promptPackage.isIncomplete = true;
    }

    return { ...trace, promptPackage };
  }
}
