import {
  CognitiveEngine,
  CognitiveTrace,
  ContextPackage,
  ConversationState
} from './types';

/**
 * Decision Readiness Engine.
 * Evaluates the user's cognitive readiness to make a decision, determines
 * an adaptive readiness threshold, and advances the Conversation State Machine.
 */
export class DecisionReadinessEngine implements CognitiveEngine {
  public name = 'Decision Readiness Engine';

  /**
   * Determine the adaptive threshold based on the category and importance keywords (stakes).
   */
  private calculateThreshold(category: string, userInput: string, importance = ''): number {
    const combined = `${userInput} ${importance}`.toLowerCase();

    // High stakes: Career, finance, relationships, major life changes, health
    const highStakesKeywords = [
      'career', 'job', 'interview', 'resign', 'quit',
      'relationship', 'breakup', 'partner', 'marriage', 'divorce',
      'money', 'finance', 'budget', 'loan', 'rent', 'lease', 'move', 'moving',
      'college', 'university', 'study abroad', 'exam', 'health', 'doctor', 'medical'
    ];

    const hasHighStakesKeyword = highStakesKeywords.some(kw => combined.includes(kw));

    if (hasHighStakesKeyword) {
      // High-impact decision: requires high readiness (0.75 - 0.85)
      return 0.80;
    }

    if (category === 'Food') {
      // Low-stakes decision: lower barrier (0.50)
      return 0.50;
    }

    // Medium-stakes (Activities, Entertainment, Shopping, general choices)
    return 0.65;
  }

  /**
   * Computes a numerical readiness score (0.0 to 1.0) based on cognitive observations.
   */
  private calculateReadinessScore(trace: CognitiveTrace, context: ContextPackage): number {
    let score = 0.0;

    // 1. Option/Path Clarity (Weight: 0.4)
    // Do we have clear possible paths to choose from?
    const pathCount = trace.generatedPaths ? trace.generatedPaths.length : 0;
    if (pathCount >= 2) {
      score += 0.4;
    } else if (pathCount === 1) {
      score += 0.2;
    }

    // Helper to find observations
    const getObservationsOfAgent = (agentName: string, key: string): any[] => {
      const obs = context.observations || [];
      return obs.filter((o: any) => o.agent_name === agentName && o.key === key);
    };

    // 2. Certainty Level (Weight: 0.2)
    const certaintyObs = getObservationsOfAgent('NLU Agent', 'certainties');
    if (certaintyObs.length > 0 && Array.isArray(certaintyObs[0].value)) {
      const certaintyItem = certaintyObs[0].value[0]; // main certainty observation
      if (certaintyItem) {
        const level = certaintyItem.certainty_level;
        if (level === 'absolute') score += 0.20;
        else if (level === 'high') score += 0.15;
        else if (level === 'hesitant') score += 0.05;
      }
    }

    // 3. Goal Clarity (Weight: 0.2)
    const goalObs = getObservationsOfAgent('NLU Agent', 'goals');
    if (goalObs.length > 0 && Array.isArray(goalObs[0].value) && goalObs[0].value.length > 0) {
      score += 0.20; // Goal is clearly identified
    }

    // 4. Emotional Readiness (Weight: 0.2)
    const readinessObs = getObservationsOfAgent('NLU Agent', 'readiness_signals');
    if (readinessObs.length > 0 && Array.isArray(readinessObs[0].value)) {
      const readinessItem = readinessObs[0].value[0];
      if (readinessItem) {
        const state = readinessItem.readiness_state;
        if (state === 'ready_to_decide') score += 0.20;
        else if (state === 'open_to_exploration') score += 0.10;
        else if (state === 'needs_grounding') score -= 0.15; // penalize if user is overwhelmed/panicked
        else if (state === 'resistant') score -= 0.20;
      }
    }

    // 5. Ambiguity & Conflict Penalties
    // Active conflicts between competing hypotheses
    const hasConflicts = context.conflicts && context.conflicts.length > 0;
    if (hasConflicts) {
      score -= 0.15;
    }

    // NLU detected ambiguities
    const ambiguityObs = getObservationsOfAgent('NLU Agent', 'ambiguities');
    if (ambiguityObs.length > 0 && Array.isArray(ambiguityObs[0].value) && ambiguityObs[0].value.length > 0) {
      score -= 0.10;
    }

    // Clamp score between 0.0 and 1.0
    return Math.max(0.0, Math.min(1.0, score));
  }

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    // 1. Get Category from NLU Agent if present
    const nluCategoryObs = (context.observations || []).find(
      (o: any) => o.agent_name === 'NLU Agent' && o.key === 'detected_category'
    );
    const category = nluCategoryObs ? String(nluCategoryObs.value) : 'Other';

    // 2. Compute Threshold & Score
    const threshold = this.calculateThreshold(category, context.user_input, context.importance);
    const score = this.calculateReadinessScore(trace, context);

    // 3. Determine Conversation State Transitions
    let nextState: ConversationState = trace.state;

    if (trace.state === 'Listening') {
      nextState = 'Understanding';
    }

    if (nextState === 'Understanding' || nextState === 'Exploring' || nextState === 'Clarifying') {
      const hasConflicts = context.conflicts && context.conflicts.length > 0;
      const nluAmbiguityObs = (context.observations || []).find(
        (o: any) => o.agent_name === 'NLU Agent' && o.key === 'ambiguities'
      );
      const hasAmbiguities = nluAmbiguityObs && Array.isArray(nluAmbiguityObs.value) && nluAmbiguityObs.value.length > 0;

      const allowDecision = trace.emotionalGuidance ? trace.emotionalGuidance.allowDecision : true;
      if (allowDecision && score >= threshold && trace.generatedPaths && trace.generatedPaths.length >= 2) {
        // User is ready and we have paths!
        nextState = 'Emerging Paths';
      } else if (hasConflicts || hasAmbiguities) {
        // High uncertainty or confusion: clarify
        nextState = 'Clarifying';
      } else {
        // Normal dialogue: explore options further
        nextState = 'Exploring';
      }
    }

    // 4. Reflection Loop Breaker Guard
    let consecutiveCount = context.consecutiveReflectionCount || 0;
    if (nextState === 'Clarifying' || nextState === 'Reflection') {
      consecutiveCount++;
      if (consecutiveCount > 3) {
        console.warn(`[DecisionReadiness] Maximum consecutive reflection count reached (${consecutiveCount}). Forcing transition to prevent reflection loop.`);
        if (trace.generatedPaths && trace.generatedPaths.length >= 2) {
          nextState = 'Emerging Paths';
        } else {
          nextState = 'Exploring';
        }
        consecutiveCount = 0;
      }
    } else {
      consecutiveCount = 0;
    }
    context.consecutiveReflectionCount = consecutiveCount;

    return {
      ...trace,
      readinessScore: Number(score.toFixed(2)),
      readinessThreshold: threshold,
      state: nextState
    };
  }
}
