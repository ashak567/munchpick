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

/**
 * Prompt Builder Engine.
 * Formats trace outputs and context into a deterministic, provider-agnostic prompt package.
 */
export class PromptBuilderEngine implements CognitiveEngine {
  public name = 'Prompt Builder Engine';

  /**
   * Helper to compute a stable SHA-256 checksum of prompt sections.
   */
  private generateChecksum(sections: PromptSection[]): string {
    const rawString = sections
      .map(s => {
        const contentStr = typeof s.content === 'string' ? s.content : JSON.stringify(s.content);
        return `${s.id}:${s.type}:${s.priority}:${contentStr}`;
      })
      .join('|');
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  /**
   * Map Context Assembly's generationIntent to RenderStrategy.
   */
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

    // 2. Identity Section (Stupidly copy from mascotDecision)
    const mascot = trace.mascotDecision;
    if (mascot) {
      sections.push({
        id: `mascot_identity_${mascot.mascotId}`,
        type: 'identity',
        priority: 0.9,
        required: true,
        content: {
          mascotId: mascot.mascotId,
          identity: mascot.identity,
          behavior: mascot.behavior,
          speakingStyle: mascot.speakingStyle,
          emotionalStyle: mascot.emotionalStyle,
          interactionStyle: mascot.interactionStyle
        }
      });
    }

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

    // 4. Story Section (Consume from Context Assembly block)
    const storyBlock = trace.contextAssembly?.blocks.find(b => b.category === 'story');
    if (storyBlock) {
      sections.push({
        id: 'story_context',
        type: 'story',
        priority: 0.7,
        required: false,
        content: storyBlock.content
      });
    }

    // 5. Memory Section (Consume from Context Assembly block)
    const memoryBlock = trace.contextAssembly?.blocks.find(b => b.category === 'memory');
    if (memoryBlock) {
      sections.push({
        id: 'memory_context',
        type: 'memory',
        priority: 0.6,
        required: false,
        content: memoryBlock.content
      });
    }

    // 6. Context Section (From Context Assembly reflection / conversation blocks)
    const reflectionBlock = trace.contextAssembly?.blocks.find(b => b.category === 'reflection');
    if (reflectionBlock) {
      sections.push({
        id: 'reflection_context',
        type: 'context',
        priority: 0.5,
        required: false,
        content: reflectionBlock.content
      });
    }

    // 7. Conversation Section (Consume isolated conversation block from Context Assembly)
    const conversationBlock = trace.contextAssembly?.blocks.find(b => b.category === 'conversation');
    if (conversationBlock) {
      sections.push({
        id: 'conversation_history',
        type: 'conversation',
        priority: 0.4,
        required: true,
        content: conversationBlock.content
      });
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

    // 9. Instructions Section (Generic constraints and instructions)
    sections.push({
      id: 'output_instructions',
      type: 'instructions',
      priority: 0.2,
      required: true,
      content: 'Construct the response strictly adhering to the response plan sections, personality guidelines, and active mascot speaking style. Do not leak internal tags, priorities, or cognitive scores in the output.'
    });

    // Sort by priority descending
    sections.sort((a, b) => b.priority - a.priority);

    // Build Directives
    const mustDo: string[] = [];
    const shouldDo: string[] = [];
    const avoid: string[] = [];

    if (personality) {
      if (personality.validateEmotion) mustDo.push('Validate the user\'s active emotion.');
      if (personality.useMetaphors) mustDo.push('Use metaphors to explain options where helpful.');
      if (personality.challengeUser) mustDo.push('Gently challenge the user\'s assumptions.');
      if (personality.humorAllowed === false) avoid.push('Avoid using humor or making jokes.');

      if (personality.responseConstraints?.avoidHumor) avoid.push('Do not use humor.');
      if (personality.responseConstraints?.avoidLongReplies) avoid.push('Avoid long-winded replies; keep sentences concise.');
      if (personality.responseConstraints?.avoidQuestions) avoid.push('Avoid asking questions.');
      if (personality.responseConstraints?.avoidChallenges) avoid.push('Avoid challenging the user.');
    }

    if (plan) {
      mustDo.push(`Align response with target goal: ${plan.responseGoal}.`);
      shouldDo.push(`Incorporate ending style: ${plan.endingStyle}.`);
      shouldDo.push(`Keep the number of questions under the limit: ${plan.maxQuestions}.`);

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
      if (hints.removeHumor) {
        avoid.push('Strictly avoid all jokes, humor, and lighthearted comments.');
      }
      if (hints.reduceQuestions) {
        avoid.push('Do not ask any questions.');
      }
      if (hints.strengthenEmpathy) {
        mustDo.push('Deliver extremely validating, supportive and comforting comments.');
      }
      if (hints.improveFormatting) {
        mustDo.push('Strictly output correct and properly balanced markdown block syntax.');
      }
    }

    mustDo.push(
      "Respond primarily to the user's MOST RECENT message."
    );

    mustDo.push(
      "Do not repeat previous assistant responses."
    );

    avoid.push(
      "Do not reuse identical opening sentences from previous turns."
    );

    avoid.push(
      "Do not ask the same follow-up question unless the user ignored it."
    );
    const directives: PromptDirective = { mustDo, shouldDo, avoid };

    // Calculate tokens
    const totalChars = sections.reduce((acc, s) => {
      const contentStr = typeof s.content === 'string' ? s.content : JSON.stringify(s.content);
      return acc + contentStr.length;
    }, 0);
    const estimatedTokens = estimateTokens(JSON.stringify(sections));

    // Compute checksum
    const checksum = this.generateChecksum(sections);

    // Compute compression ratio (chars to tokens)
    const compressionRatio = totalChars > 0 ? Number((estimatedTokens / (totalChars / 4)).toFixed(2)) : 1.0;

    const statistics: PromptStatistics = {
      sections: sections.length,
      estimatedTokens,
      checksum,
      compressionRatio
    };

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

    // Validation
    const requiredTypes: PromptSectionType[] = ['system', 'identity', 'personality', 'conversation', 'response_plan', 'instructions'];
    const missingType = requiredTypes.some(type => !sections.some(s => s.type === type));
    const hasDuplicates = new Set(sections.map(s => s.id)).size !== sections.length;
    const hasEmptySections = sections.some(s => {
      const contentStr = typeof s.content === 'string' ? s.content : JSON.stringify(s.content);
      return !contentStr.trim() || contentStr === '{}' || contentStr === '[]';
    });

    // Checksum verification
    const reCalculatedChecksum = this.generateChecksum(sections);
    const checksumMismatch = checksum !== reCalculatedChecksum;

    if (missingType || hasDuplicates || hasEmptySections || checksumMismatch) {
      console.warn(
        `[PromptBuilder] Validation warnings detected: ` +
        `missingRequired=${missingType}, duplicates=${hasDuplicates}, emptySections=${hasEmptySections}, checksumMismatch=${checksumMismatch}`
      );
      promptPackage.isIncomplete = true;
    }

    return {
      ...trace,
      promptPackage
    };
  }
}
