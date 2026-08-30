import { ContextPackage } from '../orchestrator/types';
import {
  NLUObservationsOutput,
  MeaningInterpretation,
  TopicObservation,
  EntityObservation,
  AmbiguityObservation,
  AssumptionObservation,
  MissingInfoObservation,
  HiddenMeaningObservation,
  CommunicationPurposeObservation,
  UserStateSignalObservation,
  ConversationDynamicsObservation,
  CuriosityTriggerObservation,
  DecisionContextObservation,
  PerspectiveObservation,
  CertaintyObservation,
  GoalSignalObservation,
  ObstacleObservation,
  StakeholderObservation,
  ImportanceObservation,
  RelationshipReferenceObservation,
  SelfReflectionObservation,
  EmotionalReadinessObservation,
  SelfReferenceObservation
} from './types';
import { normalizeConfidence, buildEvidenceContext } from './confidence';
import { detectSelfReference } from '../mascots/self-identity';
import { MascotCharacter } from '../mascots/registry';

/**
 * Perform a keyword and regex-based NLU analysis of the context package.
 * This serves as the fallback when the Gemini API is unavailable or fails.
 */
export function analyzeContextFallback(context: ContextPackage): NLUObservationsOutput {
  const input = context.user_input || '';
  const inputLower = input.toLowerCase();
  const options = context.options || [];
  const emotionalState = (context.emotional_state || '').toLowerCase();
  const importance = (context.importance || '').toLowerCase();
  const currentContext = (context.current_context || '').toLowerCase();

  const evidence = buildEvidenceContext('user_input', input.slice(0, 100));

  // 1. Meaning Extraction (Responsibility 1 + Meaning Importance Scoring)
  const meanings: MeaningInterpretation[] = [];
  if (/tired|exhausted|burnout|sleepy/i.test(inputLower)) {
    meanings.push({
      possible_meanings: [
        { interpretation: 'physical exhaustion', confidence: 0.8 },
        { interpretation: 'mental fatigue', confidence: 0.75 },
        { interpretation: 'burnout', confidence: 0.5 }
      ],
      confidence: 0.8,
      evidence,
      uncertainty: 'Keywords indicate tiredness, but the boundary between physical and mental fatigue remains unclear.',
      importance_score: /burnout/i.test(inputLower) ? 0.8 : 0.6
    });
  } else if (/don't know|unsure|stuck|help/i.test(inputLower)) {
    meanings.push({
      possible_meanings: [
        { interpretation: 'decision fatigue', confidence: 0.85 },
        { interpretation: 'lack of details/information', confidence: 0.6 },
        { interpretation: 'emotional overwhelm', confidence: 0.5 }
      ],
      confidence: 0.8,
      evidence,
      uncertainty: 'Expressing uncertainty. Could be cognitive difficulty in choosing or emotional overwhelm.',
      importance_score: 0.7
    });
  } else if (/fine|okay|ok/i.test(inputLower)) {
    meanings.push({
      possible_meanings: [
        { interpretation: 'genuinely doing okay', confidence: 0.5 },
        { interpretation: 'deflective response to avoid opening up', confidence: 0.7 },
        { interpretation: 'understated emotional exhaustion', confidence: 0.6 }
      ],
      confidence: 0.7,
      evidence,
      uncertainty: 'A brief, generic response like "fine" is inherently ambiguous.',
      importance_score: 0.4
    });
  } else {
    meanings.push({
      possible_meanings: [
        { interpretation: 'general communication/sharing', confidence: 0.6 }
      ],
      confidence: 0.5,
      evidence,
      uncertainty: 'General input without strong exhaustion or hesitation keywords.',
      importance_score: 0.5
    });
  }

  // 2. Topic Extraction
  const topics: TopicObservation[] = [];
  const topicMap: Record<string, string[]> = {
    relationships: ['friend', 'mom', 'dad', 'family', 'partner', 'relationship', 'date', 'boyfriend', 'girlfriend', 'boss', 'colleague'],
    education: ['study', 'class', 'exam', 'school', 'college', 'test', 'homework', 'learn', 'degree'],
    career: ['work', 'job', 'career', 'boss', 'interview', 'resume', 'office', 'company', 'meeting', 'project'],
    finances: ['money', 'buy', 'spend', 'cost', 'price', 'budget', 'finance', 'dollar', 'pay', 'expensive'],
    fitness: ['run', 'gym', 'workout', 'exercise', 'health', 'sleep', 'eat', 'diet', 'nutrition'],
    personal_growth: ['habit', 'grow', 'book', 'read', 'goal', 'improvement', 'mindset']
  };

  for (const [topic, keywords] of Object.entries(topicMap)) {
    const matched = keywords.filter(kw => inputLower.includes(kw));
    if (matched.length > 0) {
      topics.push({
        topic,
        confidence: normalizeConfidence(0.5 + matched.length * 0.15),
        evidence: buildEvidenceContext('user_input', matched.join(', '))
      });
    }
  }

  if (topics.length === 0 && context.relevant_memories?.length > 0) {
    const topMemory = context.relevant_memories[0];
    topics.push({
      topic: 'general_context',
      confidence: 0.5,
      evidence: buildEvidenceContext('relevant_memories', topMemory.summary)
    });
  }

  // 3. Entity Extraction
  const entities: EntityObservation[] = [];
  const nameRegex = /\b[A-Z][a-z]+\b/g;
  const matches = input.match(nameRegex) || [];
  const uniqueNames = Array.from(new Set(matches)).filter(name => {
    return !/^(I|The|He|She|It|We|They|You|And|But|Or|On|At|In|To|If|My|When|Our|Then|This|That)$/i.test(name);
  });

  for (const name of uniqueNames) {
    entities.push({
      entity_name: name,
      entity_type: 'person',
      confidence: 0.7,
      evidence: buildEvidenceContext('user_input', name)
    });
  }

  if (context.relevant_memories) {
    for (const mem of context.relevant_memories) {
      const memorySummaryLower = mem.summary.toLowerCase();
      if (inputLower.includes('cafe') || inputLower.includes('coffee')) {
        if (memorySummaryLower.includes('coffee') || memorySummaryLower.includes('cafe')) {
          entities.push({
            entity_name: 'Cozy Coffee Shop',
            entity_type: 'location',
            connected_memory_ids: mem.id ? [mem.id] : [],
            confidence: 0.8,
            evidence: buildEvidenceContext('memory_match', mem.summary)
          });
        }
      }
    }
  }

  // 4. Ambiguity Detection
  const ambiguities: AmbiguityObservation[] = [];
  const ambiguityPhrases = ['fine', 'okay', 'it doesn\'t matter', 'whatever', 'something', 'anything', 'i don\'t know', 'maybe', 'not sure'];
  for (const phrase of ambiguityPhrases) {
    if (inputLower.includes(phrase)) {
      ambiguities.push({
        ambiguous_phrase: phrase,
        competing_interpretations: [
          `Literal agreement / acceptance of current state`,
          `Avoidance or hiding deeper discomfort / fatigue`,
          `Unsure how to choose or make a decision`
        ],
        confidence: 0.8,
        evidence: buildEvidenceContext('user_input', phrase),
        uncertainty: 'Short ambiguous phrases carry multiple social and emotional meanings depending on user state.'
      });
    }
  }

  // 5. Assumption Detection
  const assumptions: AssumptionObservation[] = [];
  if (/always|never|ruined|perfect|catastrophe|disaster|everything/i.test(inputLower)) {
    assumptions.push({
      assumption: 'All-or-nothing thinking (cognitive distortion)',
      underlying_belief: 'Events have binary outcomes (total success or complete catastrophe)',
      confidence: 0.75,
      evidence,
      uncertainty: 'Extreme words suggest an assumption, but it might be conversational exaggeration.'
    });
  }
  if (/should|must|have to|need to/i.test(inputLower)) {
    assumptions.push({
      assumption: 'Rigid obligation constraint ("should" statement)',
      underlying_belief: 'User has strict internal or external expectations that govern their actions',
      confidence: 0.7,
      evidence,
      uncertainty: 'Usage of "should" suggests constraint, but could also be a casual query.'
    });
  }

  // 6. Missing Information Detection
  const missing_info: MissingInfoObservation[] = [];
  if (/don't know|what to do|stuck|help/i.test(inputLower) && options.length === 0) {
    missing_info.push({
      information_gap: 'Decision options are not specified',
      reason_needed: 'Munch needs to know what options the user is considering to help guide their choice.',
      confidence: 0.8,
      evidence
    });
  }
  if (options.length > 0 && !importance && !inputLower.includes('priority') && !inputLower.includes('important')) {
    missing_info.push({
      information_gap: 'Decision criteria or priorities (what is important) are not stated',
      reason_needed: 'Without priority criteria, evaluating options is difficult.',
      confidence: 0.7,
      evidence
    });
  }

  // 7. Hidden Meaning Detection
  const hidden_meanings: HiddenMeaningObservation[] = [];
  if (/fine|okay|ok/i.test(inputLower)) {
    hidden_meanings.push({
      explicit_meaning: 'I am doing fine / acceptable.',
      possible_implicit_meanings: [
        'I am feeling overwhelmed but don\'t want to talk about it.',
        'I am resigning myself to a sub-optimal choice.',
        'I want to shift focus or speed up the interaction.'
      ],
      confidence: 0.85,
      evidence
    });
  } else if (/it doesn't matter|whatever|you choose/i.test(inputLower)) {
    hidden_meanings.push({
      explicit_meaning: 'The outcome of this decision does not make a difference.',
      possible_implicit_meanings: [
        'I am experiencing severe decision fatigue and want to delegate control.',
        'I feel disconnected or unmotivated by the current options.'
      ],
      confidence: 0.8,
      evidence
    });
  }

  // 8. Communication Purpose Detection
  const communication_purposes: CommunicationPurposeObservation[] = [];
  if (/hate|mad|annoyed|tired of|stupid|sucks|terrible|awful/i.test(inputLower)) {
    communication_purposes.push({
      purpose: 'expressing_frustration',
      confidence: 0.85,
      evidence
    });
    communication_purposes.push({
      purpose: 'venting',
      confidence: 0.8,
      evidence
    });
  } else if (/what should i|how do i|help me|choose/i.test(inputLower) || options.length > 0) {
    communication_purposes.push({
      purpose: 'seeking_advice',
      confidence: 0.8,
      evidence
    });
  } else if (/is it okay|am i wrong|should i feel/i.test(inputLower)) {
    communication_purposes.push({
      purpose: 'seeking_validation',
      confidence: 0.75,
      evidence
    });
  } else {
    communication_purposes.push({
      purpose: 'sharing',
      confidence: 0.6,
      evidence
    });
  }

  // 9. User State Signals
  const state_signals: UserStateSignalObservation[] = [];
  if (/tired|exhausted|sleepy|lazy/i.test(inputLower) || emotionalState.includes('tired')) {
    state_signals.push({
      signal: 'low_energy',
      confidence: 0.85,
      evidence
    });
  }
  if (/overwhelm|stressed|hectic|busy|pressure|too much/i.test(inputLower) || /overwhelm/i.test(emotionalState)) {
    state_signals.push({
      signal: 'cognitive_fatigue',
      confidence: 0.8,
      evidence
    });
    state_signals.push({
      signal: 'mental_overload',
      confidence: 0.75,
      evidence
    });
  }
  if (/now|soon|urgent|quick|fast/i.test(inputLower) || /time/i.test(importance)) {
    state_signals.push({
      signal: 'urgency',
      confidence: 0.7,
      evidence
    });
  }
  if (/don't know|unsure|maybe|not sure|stuck/i.test(inputLower)) {
    state_signals.push({
      signal: 'uncertainty',
      confidence: 0.8,
      evidence
    });
  }

  // 10. Conversation Dynamics
  const dynamics: ConversationDynamicsObservation[] = [];
  if (/anyway|going back|as i said/i.test(inputLower)) {
    dynamics.push({
      dynamic_type: 'topic_continuation',
      description: 'User is returning to or reinforcing a previously mentioned theme.',
      confidence: 0.75,
      evidence
    });
  } else if (/nevermind|forget it|doesn't matter/i.test(inputLower)) {
    dynamics.push({
      dynamic_type: 'avoidance',
      description: 'User is dismissing their own input or pulling back from the discussion.',
      confidence: 0.8,
      evidence
    });
  } else {
    dynamics.push({
      dynamic_type: 'topic_continuation',
      description: 'User continues the dialogue within the current decision or conversation flow.',
      confidence: 0.6,
      evidence
    });
  }

  // 11. Curiosity Triggers
  const curiosity_triggers: CuriosityTriggerObservation[] = [];
  if (topics.some(t => t.topic === 'relationships')) {
    curiosity_triggers.push({
      exploration_area: 'Relationship dynamic with the mentioned person',
      exploration_rationale: 'User mentioned a relationship-based term (e.g. friend, family member, partner), which often influences decisions.',
      confidence: 0.75,
      evidence
    });
  }
  if (/tired|overwhelm|stressed/i.test(inputLower)) {
    curiosity_triggers.push({
      exploration_area: 'Sources of decision fatigue or burnout',
      exploration_rationale: 'User is signaling fatigue or stress, which directly impairs decision quality.',
      confidence: 0.8,
      evidence
    });
  }

  // 12. Decision Context Detection
  const decision_context: DecisionContextObservation[] = [];
  const decisionWords = /choose|pick|decide|or|option|should I|select|alternative/i;
  const isDecision = options.length > 0 || decisionWords.test(inputLower);

  if (isDecision) {
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (options.length > 3 || /complicated|hard|tough|stressful/i.test(inputLower)) {
      complexity = 'high';
    } else if (options.length > 1 || /decide/i.test(inputLower)) {
      complexity = 'medium';
    }

    let risk: 'low' | 'medium' | 'high' = 'low';
    if (/ruin|danger|quit|fail|career|money|cost/i.test(inputLower)) {
      risk = 'high';
    }

    decision_context.push({
      decision_present: true,
      decision_type: options.length > 0 ? 'multi-option selection' : 'binary/open choice',
      complexity,
      risk_level: risk,
      time_horizon: /today|tonight|now/i.test(inputLower) ? 'immediate' : 'short-term',
      constraints: importance ? [importance] : [],
      confidence: 0.85,
      evidence
    });
  } else {
    decision_context.push({
      decision_present: false,
      confidence: 0.7,
      evidence
    });
  }

  // --- Expanded NLU Detections ---

  // 1. Perspective Detection
  const perspectives: PerspectiveObservation[] = [];
  if (/learn|grow|try|practice|effort|understand/i.test(inputLower)) {
    perspectives.push({
      mindset: 'growth',
      agency: 'agency_active',
      locus_description: 'User shows internal engagement and motivation to grow.',
      confidence: 0.8,
      evidence
    });
  } else if (/must|can't|always|never|ruined|perfect/i.test(inputLower)) {
    perspectives.push({
      mindset: 'fixed',
      agency: 'external_locus',
      locus_description: 'User indicates absolute/restrictive language or external constraints.',
      confidence: 0.75,
      evidence
    });
  } else if (/they made me|forced to|no choice|have to/i.test(inputLower)) {
    perspectives.push({
      mindset: 'neutral',
      agency: 'external_locus',
      locus_description: 'User feels obligated or constrained by external factors.',
      confidence: 0.8,
      evidence
    });
  } else if (/blame|unfair|sucks|always me/i.test(inputLower)) {
    perspectives.push({
      mindset: 'neutral',
      agency: 'victim_agency',
      locus_description: 'User is expressing frustration with their agency or circumstances.',
      confidence: 0.75,
      evidence
    });
  } else {
    perspectives.push({
      mindset: 'neutral',
      agency: isDecision ? 'agency_active' : 'internal_locus',
      locus_description: 'Locus of control is neutral to internal.',
      confidence: 0.5,
      evidence
    });
  }

  // 2. Certainty Detection
  const certainties: CertaintyObservation[] = [];
  if (/definitely|for sure|absolutely|certain/i.test(inputLower)) {
    certainties.push({
      certainty_level: 'absolute',
      key_doubts: [],
      confidence: 0.85,
      evidence
    });
  } else if (/maybe|perhaps|not sure|possibly|i guess/i.test(inputLower)) {
    certainties.push({
      certainty_level: 'hesitant',
      key_doubts: ['unclear individual preference'],
      confidence: 0.8,
      evidence
    });
  } else if (/don't know|unsure|stuck|what to do/i.test(inputLower)) {
    certainties.push({
      certainty_level: 'undecided',
      key_doubts: ['lack of clear selection criteria'],
      confidence: 0.85,
      evidence
    });
  } else {
    certainties.push({
      certainty_level: 'high',
      key_doubts: [],
      confidence: 0.6,
      evidence
    });
  }

  // 3. Goal Signal Detection
  const goals: GoalSignalObservation[] = [];
  const goalRegex = /(?:want to|need to|planning to|aiming to|hope to|goal of)\s+([^,.?!]+)/i;
  const goalMatch = input.match(goalRegex);
  if (goalMatch) {
    goals.push({
      goal: goalMatch[1].trim(),
      timeframe: 'immediate',
      type: 'explicit',
      confidence: 0.85,
      evidence: buildEvidenceContext('user_input', goalMatch[0])
    });
  } else if (isDecision) {
    goals.push({
      goal: 'Choose between options',
      timeframe: 'short_term',
      type: 'implicit',
      confidence: 0.7,
      evidence
    });
  }

  // 4. Obstacle Detection
  const obstacles: ObstacleObservation[] = [];
  if (/money|expensive|cost|price|budget/i.test(inputLower)) {
    obstacles.push({
      obstacle_type: 'financial',
      description: 'Financial resource constraint.',
      confidence: 0.8,
      evidence
    });
  }
  if (/busy|no time|late|rushed|schedule/i.test(inputLower)) {
    obstacles.push({
      obstacle_type: 'time',
      description: 'Time constraint or schedule conflict.',
      confidence: 0.8,
      evidence
    });
  }
  if (/boss|mom|dad|friend|parent|they won't/i.test(inputLower)) {
    obstacles.push({
      obstacle_type: 'interpersonal',
      description: 'Social or interpersonal blocker.',
      confidence: 0.75,
      evidence
    });
  }
  if (/anxious|afraid|tired|stressed|scared/i.test(inputLower)) {
    obstacles.push({
      obstacle_type: 'internal',
      description: 'Internal emotional or energy blocker.',
      confidence: 0.8,
      evidence
    });
  }

  // 5. Stakeholder Detection
  const stakeholders: StakeholderObservation[] = [];
  const stakeholderMap: Record<string, { name: string; rel: string; impact: 'low' | 'medium' | 'high' }> = {
    friend: { name: 'Friend', rel: 'friendship', impact: 'medium' },
    mom: { name: 'Parent (Mom)', rel: 'family', impact: 'high' },
    dad: { name: 'Parent (Dad)', rel: 'family', impact: 'high' },
    parent: { name: 'Parent', rel: 'family', impact: 'high' },
    boss: { name: 'Manager/Boss', rel: 'professional', impact: 'high' },
    colleague: { name: 'Colleague', rel: 'professional', impact: 'medium' },
    partner: { name: 'Partner', rel: 'romantic', impact: 'high' },
    boyfriend: { name: 'Partner (Boyfriend)', rel: 'romantic', impact: 'high' },
    girlfriend: { name: 'Partner (Girlfriend)', rel: 'romantic', impact: 'high' }
  };

  for (const [key, detail] of Object.entries(stakeholderMap)) {
    if (inputLower.includes(key)) {
      stakeholders.push({
        stakeholder_name: detail.name,
        relationship_type: detail.rel,
        impact_level: detail.impact,
        confidence: 0.8,
        evidence: buildEvidenceContext('user_input', key)
      });
    }
  }

  // 6. Importance Detection
  const importances: ImportanceObservation[] = [];
  if (/values|goals|meaningful|grow|learn/i.test(inputLower)) {
    importances.push({
      core_value: 'personal growth',
      driver: 'value_alignment',
      confidence: 0.8,
      evidence
    });
  }
  if (/miss out|fomo|everyone else|late/i.test(inputLower)) {
    importances.push({
      core_value: 'social inclusion',
      driver: 'fear_of_missing_out',
      confidence: 0.85,
      evidence
    });
  }
  if (/boss says|mom wants|must succeed|approval/i.test(inputLower)) {
    importances.push({
      core_value: 'external validation',
      driver: 'social_pressure',
      confidence: 0.8,
      evidence
    });
  }
  if (/now|deadline|soon|hurry/i.test(inputLower) || state_signals.some(s => s.signal === 'urgency')) {
    importances.push({
      core_value: 'time efficiency',
      driver: 'urgency',
      confidence: 0.8,
      evidence
    });
  }

  // 7. Relationship Reference Detection
  const relationship_references: RelationshipReferenceObservation[] = [];
  if (stakeholders.length > 0) {
    const primaryStakeholder = stakeholders[0].stakeholder_name;
    if (/argument|fight|disagree|mad at/i.test(inputLower)) {
      relationship_references.push({
        target: primaryStakeholder,
        reference_type: 'conflict',
        context: 'Interpersonal disagreement or friction.',
        confidence: 0.85,
        evidence
      });
    } else if (/wants me to|expects|force/i.test(inputLower)) {
      relationship_references.push({
        target: primaryStakeholder,
        reference_type: 'pressure',
        context: 'External expectation or pressure.',
        confidence: 0.8,
        evidence
      });
    } else if (/hope they like|make them proud|approval/i.test(inputLower)) {
      relationship_references.push({
        target: primaryStakeholder,
        reference_type: 'seeking_approval',
        context: 'Seeking validation or approval.',
        confidence: 0.8,
        evidence
      });
    } else if (/helped|loves|supports/i.test(inputLower)) {
      relationship_references.push({
        target: primaryStakeholder,
        reference_type: 'support',
        context: 'Supportive relationship reference.',
        confidence: 0.8,
        evidence
      });
    } else {
      relationship_references.push({
        target: primaryStakeholder,
        reference_type: 'neutral',
        context: 'Neutral relationship reference.',
        confidence: 0.7,
        evidence
      });
    }
  }

  // 8. Self-Reflection Detection
  const reflections: SelfReflectionObservation[] = [];
  if (/realize|noticed|think about|reflect|aware|understand why/i.test(inputLower)) {
    reflections.push({
      reflection_level: 'high',
      reflection_type: 'introspection',
      insights: ['User is examining their own thoughts or behaviors.'],
      confidence: 0.85,
      evidence
    });
  } else if (/because|since|so that I could/i.test(inputLower)) {
    reflections.push({
      reflection_level: 'medium',
      reflection_type: 'justification',
      insights: ['User is rationalizing their state or decision.'],
      confidence: 0.75,
      evidence
    });
  } else if (/whatever|doesn't matter|forget it/i.test(inputLower)) {
    reflections.push({
      reflection_level: 'none',
      reflection_type: 'deflection',
      insights: ['User is deflecting or avoiding self-reflection.'],
      confidence: 0.8,
      evidence
    });
  }

  // 9. Emotional Readiness Signals
  const readiness_signals: EmotionalReadinessObservation[] = [];
  if (/ready|know what to do|let's choose|decided/i.test(inputLower)) {
    readiness_signals.push({
      readiness_state: 'ready_to_decide',
      confidence: 0.85,
      evidence
    });
  } else if (/panicked|overwhelmed|stressed|stressed out/i.test(inputLower)) {
    readiness_signals.push({
      readiness_state: 'needs_grounding',
      blockers: ['emotional overwhelm'],
      confidence: 0.85,
      evidence
    });
  } else if (/don't want to|hate this|refuse/i.test(inputLower)) {
    readiness_signals.push({
      readiness_state: 'resistant',
      blockers: ['emotional resistance'],
      confidence: 0.8,
      evidence
    });
  } else if (/curious|explore|learn more|alternatives/i.test(inputLower) || options.length > 0) {
    readiness_signals.push({
      readiness_state: 'open_to_exploration',
      confidence: 0.8,
      evidence
    });
  }

  // 21. Character Self-Reference & Disambiguation
  const self_references: SelfReferenceObservation[] = [];
  const activeChar = (context.active_mascot || 'munch') as MascotCharacter;
  const historyTurns = (context.conversation_history || []).map((h: any) => ({
    role: h.role,
    content: h.content
  }));
  const selfRefResult = detectSelfReference(input, activeChar, historyTurns);
  if (selfRefResult.isSelfReference) {
    self_references.push({
      is_self_reference: true,
      character_id: selfRefResult.mascotId,
      reference_type: selfRefResult.referentialType,
      reference_phrase: selfRefResult.referencePhrase || input,
      contextual_summary: selfRefResult.contextualReason,
      confidence: normalizeConfidence(selfRefResult.confidence),
      evidence: buildEvidenceContext('user_input', selfRefResult.referencePhrase || input.slice(0, 80))
    });
  }

  return {
    meanings,
    topics,
    entities,
    ambiguities,
    assumptions,
    missing_info,
    hidden_meanings,
    communication_purposes,
    state_signals,
    dynamics,
    curiosity_triggers,
    decision_context,

    // Expanded cognitive detections
    perspectives,
    certainties,
    goals,
    obstacles,
    stakeholders,
    importances,
    relationship_references,
    reflections,
    readiness_signals,
    self_references
  };
}
