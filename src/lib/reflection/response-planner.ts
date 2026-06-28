import {
  CognitiveEngine,
  CognitiveTrace,
  ContextPackage,
  ResponsePlan,
  ResponseGoal,
  ResponseSection,
  ResponseSectionType,
  EndingStyle
} from './types';

// ── Configurable Planning Rules ──────────────────────────────────────────────

const PLANNING_RULES = {
  /** Maps CognitiveDecision.dominantNeed → ResponseGoal */
  goalMapping: {
    comfort: 'comfort' as ResponseGoal,
    listen: 'reflect' as ResponseGoal,
    clarify: 'clarify' as ResponseGoal,
    guide: 'guide' as ResponseGoal,
    motivate: 'encourage' as ResponseGoal,
    celebrate: 'celebrate' as ResponseGoal,
    ground: 'reflect' as ResponseGoal,
    explore: 'clarify' as ResponseGoal
  },

  /** Maps ResponseGoal → default section ordering */
  sectionTemplates: {
    comfort: ['opening', 'acknowledgement', 'reflection', 'closing'] as ResponseSectionType[],
    guide: ['opening', 'acknowledgement', 'guidance', 'question', 'closing'] as ResponseSectionType[],
    celebrate: ['opening', 'acknowledgement', 'story_reference', 'closing'] as ResponseSectionType[],
    clarify: ['opening', 'reflection', 'question', 'closing'] as ResponseSectionType[],
    encourage: ['opening', 'acknowledgement', 'memory_reference', 'guidance', 'closing'] as ResponseSectionType[],
    educate: ['opening', 'reflection', 'guidance', 'question', 'closing'] as ResponseSectionType[],
    reflect: ['opening', 'reflection', 'story_reference', 'closing'] as ResponseSectionType[]
  },

  /** Maps ResponseGoal → transition hint sequences */
  transitionTemplates: {
    comfort: ['validate', 'reflect', 'support', 'close'],
    guide: ['validate', 'reflect', 'suggest', 'ask'],
    celebrate: ['celebrate', 'reference_progress', 'encourage', 'close'],
    clarify: ['reflect', 'ask', 'close'],
    encourage: ['validate', 'reference_memory', 'encourage', 'close'],
    educate: ['reflect', 'explain', 'ask', 'close'],
    reflect: ['validate', 'reflect', 'suggest', 'close']
  },

  /** Maps ResponseGoal → ending style */
  endingStyleMapping: {
    comfort: 'warm' as EndingStyle,
    guide: 'encouraging' as EndingStyle,
    celebrate: 'encouraging' as EndingStyle,
    clarify: 'reflective' as EndingStyle,
    encourage: 'encouraging' as EndingStyle,
    educate: 'neutral' as EndingStyle,
    reflect: 'reflective' as EndingStyle
  },

  /** ResponseDepth → section count limits */
  depthLimits: {
    short: 3,
    medium: 5,
    deep: 8
  },

  /** ResponseDepth → maximum questions allowed */
  questionLimits: {
    short: 0,
    medium: 1,
    deep: 2
  }
};

// ── Engine Implementation ────────────────────────────────────────────────────

export class ResponsePlanningEngine implements CognitiveEngine {
  public name = 'Response Planning Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const cognitiveDecision = trace.cognitiveDecision;
    const personalityDecision = trace.personalityDecision;

    // 1. Resolve Response Goal
    const dominantNeed = cognitiveDecision?.dominantNeed ?? 'listen';
    const responseGoal: ResponseGoal = PLANNING_RULES.goalMapping[dominantNeed] ?? 'reflect';

    // 2. Topic Prioritization
    const primaryTopic = trace.activeTopicKey || 'general';
    const secondaryTopics = this.resolveSecondaryTopics(trace, primaryTopic);

    // 3. Response Depth
    const responseDepth = cognitiveDecision?.responseDepth ?? 'medium';
    const maxSections = PLANNING_RULES.depthLimits[responseDepth];

    // 4. Build Sections
    const templateSections = PLANNING_RULES.sectionTemplates[responseGoal] ?? PLANNING_RULES.sectionTemplates.reflect;
    const limitedTemplate = templateSections.slice(0, maxSections);
    const sections = this.buildSections(limitedTemplate, trace, responseGoal);

    // 5. Reference Planning
    const requiredReferences = this.planRequiredReferences(trace);
    const forbiddenReferences = this.planForbiddenReferences(trace, responseGoal);

    // 6. Question Planning
    const maxQuestions = this.planQuestionCount(trace, responseDepth);

    // Remove question sections if questions are forbidden
    if (maxQuestions === 0) {
      const questionIndex = sections.findIndex(s => s.type === 'question');
      if (questionIndex !== -1) {
        sections.splice(questionIndex, 1);
      }
    }

    // 7. Transition Hints
    const transitionHints = PLANNING_RULES.transitionTemplates[responseGoal] ?? PLANNING_RULES.transitionTemplates.reflect;

    // 8. Ending Style
    const endingStyle = PLANNING_RULES.endingStyleMapping[responseGoal] ?? 'neutral';

    // 9. Calculate Confidence
    const confidence = this.calculatePlanConfidence(trace);

    // 10. Assemble Plan
    const responsePlan: ResponsePlan = {
      responseGoal,
      primaryTopic,
      secondaryTopics,
      sections,
      requiredReferences,
      forbiddenReferences,
      transitionHints,
      maxQuestions,
      endingStyle,
      confidence
    };

    return {
      ...trace,
      responsePlan
    };
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Resolves secondary topics from story and memory state.
   */
  private resolveSecondaryTopics(trace: CognitiveTrace, primaryTopic: string): string[] {
    const topics: string[] = [];

    // Active goals from story
    if (trace.storyState?.activeGoals) {
      for (const goal of trace.storyState.activeGoals) {
        if (goal !== primaryTopic && !topics.includes(goal)) {
          topics.push(goal);
        }
      }
    }

    // Unresolved threads from story insight
    if (trace.storyInsight?.unresolvedThreads) {
      for (const thread of trace.storyInsight.unresolvedThreads) {
        const title = (thread as any).title ?? String(thread);
        if (title !== primaryTopic && !topics.includes(title)) {
          topics.push(title);
        }
      }
    }

    // Limit secondary topics to 3 to prevent cognitive overload in the response
    return topics.slice(0, 3);
  }

  /**
   * Builds an ordered array of ResponseSections from a template.
   */
  private buildSections(
    template: ResponseSectionType[],
    trace: CognitiveTrace,
    goal: ResponseGoal
  ): ResponseSection[] {
    return template.map((type, index) => {
      const priority = template.length - index; // higher priority for earlier sections
      const required = this.isSectionRequired(type, goal, trace);

      return { type, priority, required };
    });
  }

  /**
   * Determines whether a section type is required for a given goal & trace.
   */
  private isSectionRequired(
    type: ResponseSectionType,
    goal: ResponseGoal,
    trace: CognitiveTrace
  ): boolean {
    // Opening and closing are always required
    if (type === 'opening' || type === 'closing') return true;

    // Acknowledgement is required when emotion needs validating
    if (type === 'acknowledgement') {
      return trace.cognitiveDecision?.acknowledgeEmotion === true || goal === 'comfort';
    }

    // Story reference required when orchestrator flagged it
    if (type === 'story_reference') {
      return trace.cognitiveDecision?.referenceStory === true;
    }

    // Memory reference required when orchestrator flagged it
    if (type === 'memory_reference') {
      return trace.cognitiveDecision?.referenceMemory === true;
    }

    // Guidance required for guide and encourage goals
    if (type === 'guidance') {
      return goal === 'guide' || goal === 'encourage' || goal === 'educate';
    }

    // Question required only when the orchestrator permits and personality allows
    if (type === 'question') {
      return (
        trace.cognitiveDecision?.askQuestion === true &&
        trace.personalityDecision?.responseConstraints?.avoidQuestions !== true
      );
    }

    // Reflection is required for reflect, comfort, and clarify goals
    if (type === 'reflection') {
      return goal === 'reflect' || goal === 'comfort' || goal === 'clarify';
    }

    return false;
  }

  /**
   * Determines which references the response should include.
   */
  private planRequiredReferences(trace: CognitiveTrace): ResponsePlan['requiredReferences'] {
    return {
      story: trace.cognitiveDecision?.referenceStory === true,
      memory: trace.cognitiveDecision?.referenceMemory === true,
      emotion: trace.cognitiveDecision?.acknowledgeEmotion === true
    };
  }

  /**
   * Determines which references should be intentionally omitted.
   */
  private planForbiddenReferences(
    trace: CognitiveTrace,
    goal: ResponseGoal
  ): ResponsePlan['forbiddenReferences'] {
    const constraints = trace.personalityDecision?.responseConstraints;

    // Forbid memory references when cognitive load is already high to avoid overwhelming
    const forbidMemory =
      (trace.cognitiveDecision?.cognitiveLoad ?? 0) >= 0.8 &&
      trace.cognitiveDecision?.referenceMemory !== true;

    // Forbid story references when urgency is critical and focus should be immediate
    const forbidStory =
      trace.cognitiveDecision?.urgency === 'critical' &&
      trace.cognitiveDecision?.referenceStory !== true;

    // Forbid humor per personality constraints
    const forbidHumor = constraints?.avoidHumor === true || goal === 'comfort';

    return {
      memory: forbidMemory,
      story: forbidStory,
      humor: forbidHumor
    };
  }

  /**
   * Plans the maximum number of questions based on response depth and constraints.
   */
  private planQuestionCount(
    trace: CognitiveTrace,
    responseDepth: 'short' | 'medium' | 'deep'
  ): number {
    // If questions are forbidden, zero
    if (trace.personalityDecision?.responseConstraints?.avoidQuestions === true) {
      return 0;
    }

    // If orchestrator says don't ask, zero
    if (trace.cognitiveDecision?.askQuestion === false) {
      return 0;
    }

    return PLANNING_RULES.questionLimits[responseDepth];
  }

  /**
   * Calculates plan confidence from upstream engine agreements.
   */
  private calculatePlanConfidence(trace: CognitiveTrace): number {
    const signals: number[] = [];

    if (trace.cognitiveDecision) {
      signals.push(trace.cognitiveDecision.confidence);
    }
    if (trace.personalityDecision) {
      signals.push(trace.personalityDecision.confidence);
    }
    if (trace.storyProgress) {
      signals.push(trace.storyProgress.confidence);
    }

    if (signals.length === 0) return 0.7; // fallback baseline

    // Use the minimum signal as a conservative confidence bound
    return Math.min(...signals);
  }
}
