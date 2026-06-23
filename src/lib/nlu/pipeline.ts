import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { ContextPackage } from '../orchestrator/types';
import { NLUObservationsOutput } from './types';
import { analyzeContextFallback } from './fallback';

// Initialize the Google Generative AI client
const geminiApiKey = serverEnv?.GEMINI_API_KEY || '';
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

/**
 * Execute the Gemini NLU Interpretation Pipeline.
 * If the API is missing or fails, it falls back to the local rule-based analysis.
 */
export async function runNLUPipeline(context: ContextPackage): Promise<NLUObservationsOutput> {
  if (!genAI) {
    console.warn('[NLUPipeline] No GEMINI_API_KEY found, running fallback NLU engine.');
    return analyzeContextFallback(context);
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1 // Low temperature for deterministic NLU classification
    }
  });

  const prompt = `
You are Layer 1 (Companion Natural Language Understanding Engine) of the Munch Cognitive Architecture.
Munch is a gentle four-leaf clover companion that helps Navi slow down, understand her thoughts, and make decisions she feels comfortable with.

CRITICAL ROLE BOUNDARIES:
- You ONLY generate structured observations.
- You DO NOT detect emotions, DO NOT detect intent, DO NOT reason, DO NOT make decisions, and DO NOT generate user-facing responses or text. Those are the responsibilities of future layers.
- Your sole job is to analyze what the user is trying to communicate, prioritizing meaning over words.
- All observations must include a confidence score (0.0 to 1.0), an evidence string, and an uncertainty explanation.
- Keep uncertainty preserved: if multiple competing interpretations exist, present them as possibilities with confidence scores. Do not collapse uncertainty prematurely.

---
CONTEXT PACKAGE:
- User Input: "${context.user_input}"
- Options under consideration: ${JSON.stringify(context.options || [])}
- What's important right now: "${context.importance || 'Not specified'}"
- User-provided feeling/mood: "${context.emotional_state || 'Not specified'}"
- Current environment/context: "${context.current_context || 'Not specified'}"

Profile Context (HUPS Beliefs):
${JSON.stringify((context.profile_beliefs || []).map(b => ({ dimension: b.dimension, key: b.key, value: b.value, confidence: b.confidence })))}

Relevant Memories:
${JSON.stringify((context.relevant_memories || []).map(m => ({ id: m.id, type: m.memory_type, summary: m.summary, confidence: m.confidence })))}

Recent Decisions/History:
${JSON.stringify(context.decision_history || [])}
---

Your task is to analyze the context package and return a JSON object conforming exactly to the following structure:

{
  "meanings": [
    {
      "possible_meanings": [
        { "interpretation": "Short description of a possible meaning", "confidence": 0.0 to 1.0 }
      ],
      "confidence": 0.0 to 1.0,
      "evidence": "Snippet of input or memory indicating this",
      "uncertainty": "Why is this meaning uncertain or what competing possibilities exist",
      "importance_score": 0.0 to 1.0 // Relative importance score of this meaning to the user (0.0 = low, 1.0 = highly central)
    }
  ],
  "topics": [
    {
      "topic": "Name of topic (relationships, education, career, family, personal_growth, fitness, finances, etc.)",
      "confidence": 0.0 to 1.0,
      "evidence": "Word or context source indicating this"
    }
  ],
  "entities": [
    {
      "entity_name": "Name of person, project, goal, location, organization, or recurring reference",
      "entity_type": "person" | "project" | "goal" | "location" | "organization" | "concept" | "recurring_reference",
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference",
      "connected_memory_ids": ["array of matching relevant memory IDs, if any"],
      "connected_profile_keys": ["array of matching HUPS keys, if any"]
    }
  ],
  "ambiguities": [
    {
      "ambiguous_phrase": "Vague or unclear phrase from input",
      "competing_interpretations": ["List of possible meanings for the phrase"],
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference",
      "uncertainty": "Explanation of the ambiguity"
    }
  ],
  "assumptions": [
    {
      "assumption": "Identified implicit assumption (e.g., failure = catastrophe)",
      "underlying_belief": "Implicit belief driving the assumption",
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference",
      "uncertainty": "Alternative explanations for the statement"
    }
  ],
  "missing_info": [
    {
      "information_gap": "Information Munch needs but lacks (e.g. options, constraints)",
      "reason_needed": "Why this info is important for decision making",
      "confidence": 0.0 to 1.0,
      "evidence": "Statement showing lack of info"
    }
  ],
  "hidden_meanings": [
    {
      "explicit_meaning": "Literal meaning of the text",
      "possible_implicit_meanings": ["List of possible indirect/implied meanings"],
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "communication_purposes": [
    {
      "purpose": "sharing" | "venting" | "seeking_understanding" | "seeking_validation" | "seeking_comfort" | "seeking_advice" | "expressing_frustration" | "other",
      "confidence": 0.0 to 1.0,
      "evidence": "Snippet of input"
    }
  ],
  "state_signals": [
    {
      "signal": "low_energy" | "cognitive_fatigue" | "high_engagement" | "confusion" | "urgency" | "uncertainty" | "mental_overload" | "calm" | "other",
      "confidence": 0.0 to 1.0,
      "evidence": "Snippet of input"
    }
  ],
  "dynamics": [
    {
      "dynamic_type": "topic_shift" | "topic_continuation" | "escalation" | "de-escalation" | "repetition" | "avoidance" | "recurring_concern",
      "description": "Conversation dynamics analysis compared to context",
      "confidence": 0.0 to 1.0,
      "evidence": "Relationship to context/memories"
    }
  ],
  "curiosity_triggers": [
    {
      "exploration_area": "Theme/topic worth exploring further",
      "exploration_rationale": "Why this area holds emotional or cognitive significance",
      "confidence": 0.0 to 1.0,
      "evidence": "Mention or context trigger"
    }
  ],
  "decision_context": [
    {
      "decision_present": true or false,
      "decision_type": "Description of decision type if present",
      "complexity": "low" | "medium" | "high",
      "stakeholders": ["list of stakeholders"],
      "time_horizon": "Immediate vs short-term vs long-term",
      "risk_level": "low" | "medium" | "high",
      "constraints": ["List of constraint factors"],
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],

  // --- Cognitive Expansion Detections ---
  "perspectives": [
    {
      "mindset": "growth" | "fixed" | "neutral",
      "agency": "internal_locus" | "external_locus" | "victim_agency" | "agency_active",
      "locus_description": "Explanation of user locus of control/agency",
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "certainties": [
    {
      "certainty_level": "absolute" | "high" | "hesitant" | "undecided",
      "key_doubts": ["List of doubts/hesitations identified"],
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "goals": [
    {
      "goal": "Specific goal identified",
      "timeframe": "short_term" | "long_term" | "immediate",
      "type": "explicit" | "implicit",
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "obstacles": [
    {
      "obstacle_type": "internal" | "external" | "interpersonal" | "financial" | "time" | "other",
      "description": "Details of the blocker",
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "stakeholders": [
    {
      "stakeholder_name": "Name/Role of person affected/influencing",
      "relationship_type": "family" | "friendship" | "professional" | "romantic" | "other",
      "impact_level": "low" | "medium" | "high",
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "importances": [
    {
      "core_value": "The value/driver behind importance",
      "driver": "value_alignment" | "fear_of_missing_out" | "social_pressure" | "urgency" | "other",
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "relationship_references": [
    {
      "target": "Stakeholder name/role",
      "reference_type": "support" | "conflict" | "pressure" | "seeking_approval" | "neutral",
      "context": "Context of this reference in the conversation",
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "reflections": [
    {
      "reflection_level": "high" | "medium" | "none",
      "reflection_type": "introspection" | "justification" | "deflection",
      "insights": ["List of self-aware insights observed"],
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ],
  "readiness_signals": [
    {
      "readiness_state": "ready_to_decide" | "needs_grounding" | "resistant" | "open_to_exploration",
      "blockers": ["List of readiness blockers (e.g., anxiety)"],
      "confidence": 0.0 to 1.0,
      "evidence": "Text reference"
    }
  ]
}

Ensure all lists are populated if there is relevant evidence in the input/context. If a list has no relevant items, return an empty array for that field.
Return ONLY valid JSON content. No markdown surrounding the JSON.
`;

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    
    // Clean potential markdown blocks
    const cleanJsonText = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanJsonText) as NLUObservationsOutput;

    // Post-process to ensure arrays and field compliance
    return {
      meanings: Array.isArray(parsed.meanings) ? parsed.meanings : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      ambiguities: Array.isArray(parsed.ambiguities) ? parsed.ambiguities : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info : [],
      hidden_meanings: Array.isArray(parsed.hidden_meanings) ? parsed.hidden_meanings : [],
      communication_purposes: Array.isArray(parsed.communication_purposes) ? parsed.communication_purposes : [],
      state_signals: Array.isArray(parsed.state_signals) ? parsed.state_signals : [],
      dynamics: Array.isArray(parsed.dynamics) ? parsed.dynamics : [],
      curiosity_triggers: Array.isArray(parsed.curiosity_triggers) ? parsed.curiosity_triggers : [],
      decision_context: Array.isArray(parsed.decision_context) ? parsed.decision_context : [],

      // New cognitive observations mapping
      perspectives: Array.isArray(parsed.perspectives) ? parsed.perspectives : [],
      certainties: Array.isArray(parsed.certainties) ? parsed.certainties : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      obstacles: Array.isArray(parsed.obstacles) ? parsed.obstacles : [],
      stakeholders: Array.isArray(parsed.stakeholders) ? parsed.stakeholders : [],
      importances: Array.isArray(parsed.importances) ? parsed.importances : [],
      relationship_references: Array.isArray(parsed.relationship_references) ? parsed.relationship_references : [],
      reflections: Array.isArray(parsed.reflections) ? parsed.reflections : [],
      readiness_signals: Array.isArray(parsed.readiness_signals) ? parsed.readiness_signals : []
    };
  } catch (error) {
    console.error('[NLUPipeline] Gemini call or parse failed, falling back to local analyzer. Error:', error);
    return analyzeContextFallback(context);
  }
}
