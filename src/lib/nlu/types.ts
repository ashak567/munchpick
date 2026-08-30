import { HUPSBelief } from '../hup/types';
import { UserMemory } from '../memory/types';

/**
 * Base evidence interface for all NLU observations.
 * Supports probabilistic representation.
 */
export interface NLUConfidence {
  confidence: number; // 0.0 to 1.0
  evidence: string;   // Reference to user input, memories, or profile beliefs
  uncertainty?: string; // Reason/factor for uncertainty or competing interpretations
}

/**
 * Responsibility 1: Meaning Extraction
 */
export interface MeaningPossibility {
  interpretation: string;
  confidence: number;
}

export interface MeaningInterpretation extends NLUConfidence {
  possible_meanings: MeaningPossibility[];
  importance_score: number; // 0.0 to 1.0 showing how central this meaning is to the user
}

/**
 * Responsibility 2: Topic Extraction
 */
export interface TopicObservation extends NLUConfidence {
  topic: string;
}

/**
 * Responsibility 3: Entity Extraction
 */
export interface EntityObservation extends NLUConfidence {
  entity_name: string;
  entity_type: 'person' | 'project' | 'goal' | 'location' | 'organization' | 'concept' | 'recurring_reference';
  connected_memory_ids?: string[];
  connected_profile_keys?: string[];
}

/**
 * Responsibility 4: Ambiguity Detection
 */
export interface AmbiguityObservation extends NLUConfidence {
  ambiguous_phrase: string;
  competing_interpretations: string[];
}

/**
 * Responsibility 5: Assumption Detection
 */
export interface AssumptionObservation extends NLUConfidence {
  assumption: string;
  underlying_belief?: string;
}

/**
 * Responsibility 6: Missing Information Detection
 */
export interface MissingInfoObservation extends NLUConfidence {
  information_gap: string;
  reason_needed?: string;
}

/**
 * Responsibility 7: Hidden Meaning Detection
 */
export interface HiddenMeaningObservation extends NLUConfidence {
  explicit_meaning: string;
  possible_implicit_meanings: string[];
}

/**
 * Responsibility 8: Communication Purpose Detection
 */
export interface CommunicationPurposeObservation extends NLUConfidence {
  purpose: 'sharing' | 'venting' | 'seeking_understanding' | 'seeking_validation' | 'seeking_comfort' | 'seeking_advice' | 'expressing_frustration' | 'other';
}

/**
 * Responsibility 9: User State Signals
 */
export interface UserStateSignalObservation extends NLUConfidence {
  signal: 'low_energy' | 'cognitive_fatigue' | 'high_engagement' | 'confusion' | 'urgency' | 'uncertainty' | 'mental_overload' | 'calm' | 'other';
}

/**
 * Responsibility 10: Conversation Dynamics
 */
export interface ConversationDynamicsObservation extends NLUConfidence {
  dynamic_type: 'topic_shift' | 'topic_continuation' | 'escalation' | 'de-escalation' | 'repetition' | 'avoidance' | 'recurring_concern';
  description: string;
}

/**
 * Responsibility 11: Curiosity Triggers
 */
export interface CuriosityTriggerObservation extends NLUConfidence {
  exploration_area: string;
  exploration_rationale: string;
}

/**
 * Responsibility 12: Decision Context Detection
 */
export interface DecisionContextObservation extends NLUConfidence {
  decision_present: boolean;
  decision_type?: string;
  complexity?: 'low' | 'medium' | 'high';
  stakeholders?: string[];
  time_horizon?: string;
  risk_level?: 'low' | 'medium' | 'high';
  constraints?: string[];
}

/**
 * Perspective Detection
 */
export interface PerspectiveObservation extends NLUConfidence {
  mindset: 'growth' | 'fixed' | 'neutral';
  agency: 'internal_locus' | 'external_locus' | 'victim_agency' | 'agency_active';
  locus_description: string;
}

/**
 * Certainty Detection
 */
export interface CertaintyObservation extends NLUConfidence {
  certainty_level: 'absolute' | 'high' | 'hesitant' | 'undecided';
  key_doubts: string[];
}

/**
 * Goal Signal Detection
 */
export interface GoalSignalObservation extends NLUConfidence {
  goal: string;
  timeframe?: 'short_term' | 'long_term' | 'immediate';
  type: 'explicit' | 'implicit';
}

/**
 * Obstacle Detection
 */
export interface ObstacleObservation extends NLUConfidence {
  obstacle_type: 'internal' | 'external' | 'interpersonal' | 'financial' | 'time' | 'other';
  description: string;
}

/**
 * Stakeholder Detection
 */
export interface StakeholderObservation extends NLUConfidence {
  stakeholder_name: string;
  relationship_type: string;
  impact_level: 'low' | 'medium' | 'high';
}

/**
 * Importance Detection
 */
export interface ImportanceObservation extends NLUConfidence {
  core_value: string;
  driver: 'value_alignment' | 'fear_of_missing_out' | 'social_pressure' | 'urgency' | 'other';
}

/**
 * Relationship Reference Detection
 */
export interface RelationshipReferenceObservation extends NLUConfidence {
  target: string;
  reference_type: 'support' | 'conflict' | 'pressure' | 'seeking_approval' | 'neutral';
  context: string;
}

/**
 * Self-Reflection Detection
 */
export interface SelfReflectionObservation extends NLUConfidence {
  reflection_level: 'high' | 'medium' | 'none';
  reflection_type: 'introspection' | 'justification' | 'deflection';
  insights: string[];
}

/**
 * Emotional Readiness Signals
 */
export interface EmotionalReadinessObservation extends NLUConfidence {
  readiness_state: 'ready_to_decide' | 'needs_grounding' | 'resistant' | 'open_to_exploration';
  blockers?: string[];
}

/**
 * Combined output containing structured NLU observations.
 */
export interface NLUObservationsOutput {
  meanings: MeaningInterpretation[];
  topics: TopicObservation[];
  entities: EntityObservation[];
  ambiguities: AmbiguityObservation[];
  assumptions: AssumptionObservation[];
  missing_info: MissingInfoObservation[];
  hidden_meanings: HiddenMeaningObservation[];
  communication_purposes: CommunicationPurposeObservation[];
  state_signals: UserStateSignalObservation[];
  dynamics: ConversationDynamicsObservation[];
  curiosity_triggers: CuriosityTriggerObservation[];
  decision_context: DecisionContextObservation[];

  // Expanded cognitive observations
  perspectives: PerspectiveObservation[];
  certainties: CertaintyObservation[];
  goals: GoalSignalObservation[];
  obstacles: ObstacleObservation[];
  stakeholders: StakeholderObservation[];
  importances: ImportanceObservation[];
  relationship_references: RelationshipReferenceObservation[];
  reflections: SelfReflectionObservation[];
  readiness_signals: EmotionalReadinessObservation[];
  self_references?: SelfReferenceObservation[];
}

/**
 * Self-Reference Observation
 */
export interface SelfReferenceObservation extends NLUConfidence {
  is_self_reference: boolean;
  character_id: string;
  reference_type: string;
  reference_phrase: string;
  contextual_summary: string;
}

/**
 * Historical NLU observation loaded from database.
 */
export interface NLUHistoryItem {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  dimension: string;
  key: string;
  observed_value: any;
  confidence: number;
  context?: string;
  created_at: string;
}

/**
 * Evolution metrics for tracking changes over time.
 */
export interface EvolutionMetrics {
  drift_detected: boolean;
  stability_score: number; // 0.0 to 1.0 representing how persistent this meaning is
  previous_value_count: number;
}
