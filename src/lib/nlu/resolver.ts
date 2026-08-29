import { ContextPackage } from '../orchestrator/types';
import {
  NLUObservationsOutput,
  NLUHistoryItem,
  MeaningInterpretation,
  TopicObservation,
  UserStateSignalObservation,
  CuriosityTriggerObservation,
  HiddenMeaningObservation,
  DecisionContextObservation,
  PerspectiveObservation,
  CertaintyObservation,
  GoalSignalObservation,
  ObstacleObservation,
  StakeholderObservation,
  ImportanceObservation,
  RelationshipReferenceObservation,
  SelfReflectionObservation,
  EmotionalReadinessObservation
} from './types';
import { normalizeConfidence } from './confidence';

/**
 * Determine the quality factor of the evidence source based on text analysis.
 */
export function getEvidenceSourceQuality(evidenceText: string): number {
  const text = evidenceText.toLowerCase();
  if (text.includes('user_input') || text.includes('user input') || text.includes('input')) {
    return 1.0; // Current user direct statement - highest quality
  }
  if (text.includes('recent') || text.includes('decision_history') || text.includes('recent conversations')) {
    return 0.8; // Recent context - very high quality
  }
  if (text.includes('belief') || text.includes('profile') || text.includes('hups')) {
    return 0.7; // Consolidated profile belief - high quality
  }
  if (text.includes('memory') || text.includes('memories')) {
    return 0.6; // Episodic memory - medium quality
  }
  return 0.5; // Default implicit source quality
}

/**
 * Applies the Context Hierarchy Rule:
 * Priorities: Current Input (1.0) > Recent Conversation (0.8) > Profile (0.7) > Memory (0.5) > Relationship (0.5)
 */
export function applyContextHierarchy(confidence: number, evidenceText: string): number {
  const quality = getEvidenceSourceQuality(evidenceText);
  return normalizeConfidence(confidence * quality);
}

/**
 * Resolves contradictory evidence.
 * If current user input contradicts a historical profile/memory signal,
 * we suppress the confidence of the conflicting historical observation.
 */
export function resolveContradictions(
  observations: NLUObservationsOutput,
  context: ContextPackage
): NLUObservationsOutput {
  const inputLower = (context.user_input || '').toLowerCase();
  const emotionalState = (context.emotional_state || '').toLowerCase();

  // If user explicitly mentions being calm, excited, or happy in current input,
  // suppress any high stress/anxiety signals that are derived ONLY from historical profile/memory
  const userExpressingCalm = /calm|relax|happy|fine|good|excited|peace/i.test(inputLower) || /calm|joyful/i.test(emotionalState);
  
  if (userExpressingCalm) {
    observations.state_signals = observations.state_signals.map(signal => {
      const isNegativeState = ['cognitive_fatigue', 'mental_overload', 'uncertainty', 'confusion'].includes(signal.signal);
      const isFromHistory = !signal.evidence.toLowerCase().includes('user_input') && !signal.evidence.toLowerCase().includes('input');
      
      if (isNegativeState && isFromHistory) {
        return {
          ...signal,
          confidence: normalizeConfidence(signal.confidence * 0.3), // Substantial reduction
          uncertainty: `Suppressed by current user state: user explicitly signals calm/positive state.`
        };
      }
      return signal;
    });
  }

  // Handle exhaustion contradictions (e.g. user says "energetic" vs profile says "tired")
  if (/energetic|awake|active|ready/i.test(inputLower)) {
    observations.state_signals = observations.state_signals.map(signal => {
      if (signal.signal === 'low_energy' && !signal.evidence.toLowerCase().includes('user_input')) {
        return {
          ...signal,
          confidence: normalizeConfidence(signal.confidence * 0.2),
          uncertainty: `Suppressed: user currently reports being active/energetic.`
        };
      }
      return signal;
    });
  }

  return observations;
}

/**
 * Boosts confidence of observations when reinforced by repeating evidence
 * across multiple different sources.
 */
export function applyEvidenceBoosting(observations: NLUObservationsOutput): NLUObservationsOutput {
  // Boost topics if they match multiple sources
  observations.topics = observations.topics.map(t => {
    const text = t.evidence.toLowerCase();
    const hasInput = text.includes('input');
    const hasMemory = text.includes('memory') || text.includes('belief');
    if (hasInput && hasMemory) {
      return {
        ...t,
        confidence: normalizeConfidence(t.confidence + 0.15),
        uncertainty: 'Reinforced by both current input and historical profile/memory context.'
      };
    }
    return t;
  });

  // Boost state signals supported by multiple sources
  observations.state_signals = observations.state_signals.map(s => {
    const text = s.evidence.toLowerCase();
    if ((text.includes('input') && text.includes('memory')) || (text.includes('input') && text.includes('belief'))) {
      return {
        ...s,
        confidence: normalizeConfidence(s.confidence + 0.12),
        uncertainty: 'State signal reinforced by current expression and historical profile beliefs.'
      };
    }
    return s;
  });

  return observations;
}

/**
 * Meaning Evolution & Stability:
 * Evaluates changes between the current run and history.
 * Boosts stable/recurrent interpretations, computes drift/stability metrics.
 */
export function evaluateEvolutionAndStability(
  observations: NLUObservationsOutput,
  history: NLUHistoryItem[]
): NLUObservationsOutput {
  if (!history || history.length === 0) {
    return observations;
  }

  // Helper to calculate recency weight based on exponential time decay (0.05 lambda per day)
  const getRecencyWeight = (createdAt: string): number => {
    const ageInMs = Date.now() - new Date(createdAt).getTime();
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
    // lambda = 0.05 (corresponds to ~5% decay per day, similar to context builder)
    return Math.exp(-0.05 * Math.max(0, ageInDays));
  };

  const historyByKey = new Map<string, NLUHistoryItem[]>();
  for (const item of history) {
    const list = historyByKey.get(item.key) || [];
    list.push(item);
    historyByKey.set(item.key, list);
  }

  // 1. Track stable/recurrent meaning interpretations with recency weighting
  const pastMeanings = historyByKey.get('meanings') || [];
  const pastMeaningScores = new Map<string, number>();
  pastMeanings.forEach(h => {
    const recencyWeight = getRecencyWeight(h.created_at);
    if (Array.isArray(h.observed_value)) {
      h.observed_value.forEach((m: any) => {
        if (Array.isArray(m.possible_meanings)) {
          m.possible_meanings.forEach((pm: any) => {
            if (pm.interpretation) {
              const score = recencyWeight * pm.confidence;
              pastMeaningScores.set(pm.interpretation, (pastMeaningScores.get(pm.interpretation) || 0) + score);
            }
          });
        }
      });
    }
  });

  observations.meanings = observations.meanings.map(m => {
    const updatedPossibleMeanings = m.possible_meanings.map(pm => {
      const pastWeightedScore = pastMeaningScores.get(pm.interpretation) || 0;
      if (pastWeightedScore >= 0.5) { // Needs at least one reasonably recent occurrence
        return {
          ...pm,
          confidence: normalizeConfidence(pm.confidence + 0.1)
        };
      }
      return pm;
    });

    const confidence = Math.max(...updatedPossibleMeanings.map(pm => pm.confidence), 0);
    return {
      ...m,
      possible_meanings: updatedPossibleMeanings,
      confidence: normalizeConfidence(confidence)
    };
  });

  // 2. Track stable topics with recency weighting
  const pastTopics = historyByKey.get('topics') || [];
  const pastTopicScores = new Map<string, number>();
  pastTopics.forEach(h => {
    const recencyWeight = getRecencyWeight(h.created_at);
    if (Array.isArray(h.observed_value)) {
      h.observed_value.forEach((t: any) => {
        if (t.topic) {
          const score = recencyWeight * (t.confidence || h.confidence || 1.0);
          pastTopicScores.set(t.topic, (pastTopicScores.get(t.topic) || 0) + score);
        }
      });
    }
  });

  observations.topics = observations.topics.map(t => {
    const pastWeightedScore = pastTopicScores.get(t.topic) || 0;
    if (pastWeightedScore >= 1.0) {
      return {
        ...t,
        confidence: normalizeConfidence(t.confidence + 0.08),
        uncertainty: `Stable topic: recurrently active across recent conversations (stability score: ${pastWeightedScore.toFixed(2)}).`
      };
    }
    return t;
  });

  // 3. Track state signal stability and drift with recency weighting
  const pastSignals = historyByKey.get('state_signals') || [];
  const pastSignalScores = new Map<string, number>();
  pastSignals.forEach(h => {
    const recencyWeight = getRecencyWeight(h.created_at);
    if (Array.isArray(h.observed_value)) {
      h.observed_value.forEach((s: any) => {
        if (s.signal) {
          const score = recencyWeight * (s.confidence || h.confidence || 1.0);
          pastSignalScores.set(s.signal, (pastSignalScores.get(s.signal) || 0) + score);
        }
      });
    }
  });

  observations.state_signals = observations.state_signals.map(s => {
    const pastWeightedScore = pastSignalScores.get(s.signal) || 0;
    const hasPastOccurrences = pastWeightedScore > 0;
    
    if (pastWeightedScore >= 1.0) {
      return {
        ...s,
        confidence: normalizeConfidence(s.confidence + 0.08),
        uncertainty: `Stable state signal: recurrently observed in recent history (stability score: ${pastWeightedScore.toFixed(2)}).`
      };
    } else if (!hasPastOccurrences && history.length >= 3) {
      return {
        ...s,
        uncertainty: `State signal drift: this is a new state signal not seen in recent history.`
      };
    }
    return s;
  });

  return observations;
}

/**
 * Hidden Meaning Safeguards:
 * - Programmatically cap hidden/implicit meaning confidence to prevent over-interpretation.
 * - Preserve uncertainty (keep competing possibilities).
 * - Filter observations that fall below the minimum confidence threshold.
 */
export function applySafeguards(
  observations: NLUObservationsOutput,
  threshold = 0.3
): NLUObservationsOutput {
  // Capping hidden meanings confidence to prevent over-interpretation
  observations.hidden_meanings = observations.hidden_meanings.map(m => {
    const cappedConfidence = Math.min(0.7, m.confidence); // Cap at 0.7 max
    return {
      ...m,
      confidence: cappedConfidence,
      uncertainty: m.uncertainty || 'Capped by Hidden Meaning Safeguard to prevent cognitive over-interpretation.'
    };
  });

  // Capping ambiguity interpretations confidence
  observations.ambiguities = observations.ambiguities.map(a => {
    return {
      ...a,
      confidence: Math.min(0.75, a.confidence)
    };
  });

  // Programmatic confidence threshold filter
  observations.meanings = observations.meanings.filter(o => o.confidence >= threshold);
  observations.topics = observations.topics.filter(o => o.confidence >= threshold);
  observations.entities = observations.entities.filter(o => o.confidence >= threshold);
  observations.ambiguities = observations.ambiguities.filter(o => o.confidence >= threshold);
  observations.assumptions = observations.assumptions.filter(o => o.confidence >= threshold);
  observations.missing_info = observations.missing_info.filter(o => o.confidence >= threshold);
  observations.hidden_meanings = observations.hidden_meanings.filter(o => o.confidence >= threshold);
  observations.communication_purposes = observations.communication_purposes.filter(o => o.confidence >= threshold);
  observations.state_signals = observations.state_signals.filter(o => o.confidence >= threshold);
  observations.dynamics = observations.dynamics.filter(o => o.confidence >= threshold);
  observations.curiosity_triggers = observations.curiosity_triggers.filter(o => o.confidence >= threshold);
  observations.decision_context = observations.decision_context.filter(o => o.confidence >= threshold);

  // New cognitive observations filtering
  observations.perspectives = observations.perspectives.filter(o => o.confidence >= threshold);
  observations.certainties = observations.certainties.filter(o => o.confidence >= threshold);
  observations.goals = observations.goals.filter(o => o.confidence >= threshold);
  observations.obstacles = observations.obstacles.filter(o => o.confidence >= threshold);
  observations.stakeholders = observations.stakeholders.filter(o => o.confidence >= threshold);
  observations.importances = observations.importances.filter(o => o.confidence >= threshold);
  observations.relationship_references = observations.relationship_references.filter(o => o.confidence >= threshold);
  observations.reflections = observations.reflections.filter(o => o.confidence >= threshold);
  observations.readiness_signals = observations.readiness_signals.filter(o => o.confidence >= threshold);

  return observations;
}

/**
 * Curiosity Trigger Controls:
 * - Prioritize triggers by confidence.
 * - Filter out low-value triggers (< 0.5 confidence).
 * - Prevent redundant/unnecessary questioning if details are already in the context.
 */
export function applyCuriosityControls(
  observations: NLUObservationsOutput,
  context: ContextPackage
): NLUObservationsOutput {
  const options = context.options || [];
  const importance = context.importance || '';
  const beliefs = context.profile_beliefs || [];

  observations.curiosity_triggers = observations.curiosity_triggers
    .filter(trigger => {
      const area = trigger.exploration_area.toLowerCase();
      if (trigger.confidence < 0.5) return false;

      // Prevent redundant questioning about options
      if (options.length >= 2 && (area.includes('option') || area.includes('choice') || area.includes('alternative'))) {
        return false;
      }

      // Prevent redundant questioning about criteria/importance
      if (importance && (area.includes('priority') || area.includes('important') || area.includes('criteria') || area.includes('values'))) {
        return false;
      }

      // Prevent redundant questioning about relationship dynamic
      if (area.includes('relationship') || area.includes('friend') || area.includes('family')) {
        const relationshipBelief = beliefs.find(b => b.dimension === 'relationship' && b.confidence >= 0.7);
        if (relationshipBelief) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => b.confidence - a.confidence);

  return observations;
}

/**
 * The Master NLU Resolution Pipeline.
 * Orchestrates all 6 cognitive rules (evidence weighting, hierarchy, evolutions, safeguards, curiosity).
 */
export function resolveNLUObservations(
  rawObservations: NLUObservationsOutput,
  context: ContextPackage,
  history: NLUHistoryItem[]
): NLUObservationsOutput {
  let output = {
    ...rawObservations,
    meanings: rawObservations.meanings || [],
    topics: rawObservations.topics || [],
    entities: rawObservations.entities || [],
    ambiguities: rawObservations.ambiguities || [],
    assumptions: rawObservations.assumptions || [],
    missing_info: rawObservations.missing_info || [],
    hidden_meanings: rawObservations.hidden_meanings || [],
    communication_purposes: rawObservations.communication_purposes || [],
    state_signals: rawObservations.state_signals || [],
    dynamics: rawObservations.dynamics || [],
    curiosity_triggers: rawObservations.curiosity_triggers || [],
    decision_context: rawObservations.decision_context || [],
    perspectives: rawObservations.perspectives || [],
    certainties: rawObservations.certainties || [],
    goals: rawObservations.goals || [],
    obstacles: rawObservations.obstacles || [],
    stakeholders: rawObservations.stakeholders || [],
    importances: rawObservations.importances || [],
    relationship_references: rawObservations.relationship_references || [],
    reflections: rawObservations.reflections || [],
    readiness_signals: rawObservations.readiness_signals || []
  };

  // 1. Evidence Weighting & Context Hierarchy (Applies weight based on source quality)
  output.meanings = output.meanings.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.topics = output.topics.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.entities = output.entities.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.ambiguities = output.ambiguities.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.assumptions = output.assumptions.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.missing_info = output.missing_info.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.hidden_meanings = output.hidden_meanings.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.communication_purposes = output.communication_purposes.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.state_signals = output.state_signals.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.dynamics = output.dynamics.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.curiosity_triggers = output.curiosity_triggers.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.decision_context = output.decision_context.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));

  // Expanded cognitive observations weighting
  output.perspectives = output.perspectives.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.certainties = output.certainties.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.goals = output.goals.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.obstacles = output.obstacles.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.stakeholders = output.stakeholders.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.importances = output.importances.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.relationship_references = output.relationship_references.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.reflections = output.reflections.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));
  output.readiness_signals = output.readiness_signals.map(item => ({ ...item, confidence: applyContextHierarchy(item.confidence, item.evidence) }));

  // 2. Contradiction Resolution (Hierarchy resolution of conflicting messages)
  output = resolveContradictions(output, context);

  // 3. Repeated Evidence Boosting
  output = applyEvidenceBoosting(output);

  // 4. Meaning Evolution & Stability checks against History
  output = evaluateEvolutionAndStability(output, history);

  // 5. Hidden Meaning Safeguards & Thresholds
  output = applySafeguards(output, 0.3);

  // 6. Curiosity Trigger controls
  output = applyCuriosityControls(output, context);

  return output;
}
