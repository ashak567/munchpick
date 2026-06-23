import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { Agent, AgentObservation, ContextPackage } from './types';

const genAI = new GoogleGenerativeAI(serverEnv.GEMINI_API_KEY || 'MOCK_KEY');

export class BaseAgent implements Agent {
  constructor(
    public name: string,
    public isSharedPipeline = true
  ) {}

  async analyze(context: ContextPackage): Promise<AgentObservation[]> {
    return getFallbackObservationsForAgent(this.name, context);
  }
}

import { nluEngine } from '../nlu/service';

export class NLUAgent extends BaseAgent {
  constructor() {
    super('NLU Agent', false);
  }

  override async analyze(context: ContextPackage): Promise<AgentObservation[]> {
    return nluEngine.analyze(context);
  }
}

export class EmotionAgent extends BaseAgent {
  constructor() {
    super('Emotion Agent');
  }
}

export class IntentAgent extends BaseAgent {
  constructor() {
    super('Intent Agent');
  }
}

export class RelationshipAgent extends BaseAgent {
  constructor() {
    super('Relationship Agent');
  }
}

export class MascotAgent extends BaseAgent {
  constructor() {
    super('Mascot Agent');
  }
}

// Executes the shared Gemini pipeline in a single prompt pass
export async function runSharedPipeline(
  context: ContextPackage,
  agents: Agent[]
): Promise<AgentObservation[]> {
  if (!serverEnv.GEMINI_API_KEY) {
    console.warn('No GEMINI_API_KEY found, running fallback pipeline for agents.');
    return getFallbackPipelineObservations(context, agents);
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
You are the central nervous system (Shared Reasoning Pipeline) for Munch 🍀.
Munch is a gentle four-leaf clover companion that helps Navi slow down, understand her thoughts, and make decisions she feels comfortable with.

We are running the following virtual analysis agents on the user's current situation:
${agents.map(a => `- ${a.name}: Generates structured observations for its cognitive domain.`).join('\n')}

---
CONTEXT PACKAGE:
- User Input: "${context.user_input}"
- Options under consideration: ${JSON.stringify(context.options)}
- What's important right now: "${context.importance || 'Not specified'}"
- User-provided feeling/mood: "${context.emotional_state || 'Not specified'}"
- Current environment/context: "${context.current_context || 'Not specified'}"

Profile Context (HUPS Beliefs):
${JSON.stringify(context.profile_beliefs.map(b => ({ dimension: b.dimension, key: b.key, value: b.value, confidence: b.confidence })))}

Relevant Memories:
${JSON.stringify(context.relevant_memories.map(m => ({ type: m.memory_type, summary: m.summary, confidence: m.confidence, importance: m.importance })))}

Recent Decisions/History:
${JSON.stringify(context.decision_history || [])}
---

Your task is to analyze this context and generate a JSON array of observations, one or more for each agent.
CRITICAL RULES:
- Agents DO NOT generate user-facing responses, messages, or text.
- Agents ONLY generate structured observations representing their domain.
- Conflicting hypotheses are welcome! If there's conflicting evidence (e.g. user input looks happy but profile says they struggle with decision fatigue, or emotional state says anxious but intent seeks adventure), output observations representing both sides so the orchestrator can track uncertainty.

JSON Schema:
{
  "observations": [
    {
      "agent_name": "Name of the agent (must be one of: ${agents.map(a => `'${a.name}'`).join(', ')})",
      "type": "nlu" | "emotion" | "intent" | "relationship_signal" | "mascot_recommendation" | "reasoning_hypothesis",
      "key": "the key for this observation (e.g. 'detected_category', 'emotional_state', 'user_goal', 'trust_level', 'recommended_mascot')",
      "value": any, // the value of the observation (e.g. 'Food', 'stressed', 'validation', 0.8, 'froggy')
      "confidence": number, // confidence score between 0.0 and 1.0
      "reasoning": "brief description explaining how this observation was derived from context"
    }
  ]
}
`;

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.observations)) {
      return parsed.observations;
    }
    throw new Error('Invalid JSON format returned from Gemini');
  } catch (error) {
    console.error('Shared reasoning pipeline failed, running fallback:', error);
    return getFallbackPipelineObservations(context, agents);
  }
}

export function getFallbackPipelineObservations(
  context: ContextPackage,
  agents: Agent[]
): AgentObservation[] {
  const observations: AgentObservation[] = [];
  for (const agent of agents) {
    const fallbackObs = getFallbackObservationsForAgent(agent.name, context);
    observations.push(...fallbackObs);
  }
  return observations;
}

export function getFallbackObservationsForAgent(
  agentName: string,
  context: ContextPackage
): AgentObservation[] {
  const inputLower = (context.user_input || '').toLowerCase();
  const emotionalState = (context.emotional_state || '').toLowerCase();
  const importance = (context.importance || '').toLowerCase();
  const currentContext = (context.current_context || '').toLowerCase();

  const observations: AgentObservation[] = [];

  if (agentName === 'NLU Agent') {
    // Determine category
    let category = 'Other';
    if (/pizza|sushi|pasta|burger|food|eat|dinner|lunch|breakfast|restaurant/i.test(inputLower)) {
      category = 'Food';
    } else if (/movie|film|netflix|show|watch|game|youtube|music|book/i.test(inputLower)) {
      category = 'Entertainment';
    } else if (/run|gym|work|study|code|read|sleep|clean/i.test(inputLower)) {
      category = 'Activities';
    } else if (/buy|shop|clothes|shoes|amazon|gadget/i.test(inputLower)) {
      category = 'Shopping';
    }

    observations.push({
      agent_name: 'NLU Agent',
      type: 'nlu',
      key: 'detected_category',
      value: category,
      confidence: 0.8,
      reasoning: 'Fallback keyword analysis of user input.'
    });

    const keywords = inputLower.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    observations.push({
      agent_name: 'NLU Agent',
      type: 'nlu',
      key: 'keywords',
      value: keywords,
      confidence: 0.7,
      reasoning: 'Extracted long words from input.'
    });
  }

  if (agentName === 'Emotion Agent') {
    let emotion = 'calm';
    if (/overwhelm|stress|busy|chaotic|hectic/i.test(emotionalState) || /overwhelm|stress|busy|chaotic|hectic/i.test(inputLower)) {
      emotion = 'overwhelmed';
    } else if (/doubt|anxious|anxiety|worry|unsure/i.test(emotionalState) || /doubt|anxious|anxiety|worry|unsure/i.test(inputLower)) {
      emotion = 'anxious';
    } else if (/tired|sad|exhaust/i.test(emotionalState) || /tired|sad|exhaust/i.test(inputLower)) {
      emotion = 'tired';
    } else if (/happy|joy|excite/i.test(emotionalState) || /happy|joy|excite/i.test(inputLower)) {
      emotion = 'joyful';
    }

    observations.push({
      agent_name: 'Emotion Agent',
      type: 'emotion',
      key: 'emotional_state',
      value: emotion,
      confidence: 0.75,
      reasoning: 'Fallback emotional keyword extraction.'
    });
  }

  if (agentName === 'Intent Agent') {
    let intent = 'reflection';
    if (/saving time|fast|quick/i.test(importance)) {
      intent = 'wants action';
    } else if (/peace of mind|relax|calm/i.test(importance)) {
      intent = 'reflection';
    } else if (/learning|explore/i.test(importance)) {
      intent = 'exploration';
    }

    observations.push({
      agent_name: 'Intent Agent',
      type: 'intent',
      key: 'user_goal',
      value: intent,
      confidence: 0.7,
      reasoning: 'Derived intent from importance context.'
    });
  }

  if (agentName === 'Relationship Agent') {
    observations.push({
      agent_name: 'Relationship Agent',
      type: 'relationship_signal',
      key: 'trust_level',
      value: 'open',
      confidence: 0.6,
      reasoning: 'Default relationship state.'
    });
  }

  if (agentName === 'Mascot Agent') {
    let mascot = 'munch';
    const combined = `${emotionalState} ${currentContext} ${inputLower}`;
    if (/overwhelm|stress|busy|chaotic|hectic/i.test(combined)) {
      mascot = 'froggy';
    } else if (/doubt|anxious|anxiety|worry|second-guess|unsure/i.test(combined)) {
      mascot = 'ellie';
    } else if (/encourage|motivate|lazy|procrastinat|start|begin|energy/i.test(combined)) {
      mascot = 'dobby';
    } else if (/tired|sad|comfort|unhappy|cozy/i.test(combined)) {
      mascot = 'pandy';
    } else if (/curious|explore|new|interest|learn/i.test(combined)) {
      mascot = 'coco';
    } else if (/reflect|think|thoughtful|ponder|analyse|study/i.test(combined)) {
      mascot = 'ollie';
    } else if (/open|relax|flexible|simple/i.test(combined)) {
      mascot = 'bubbles';
    } else if (/happy|joy|excite|celebrat/i.test(combined)) {
      mascot = 'chicky';
    }

    observations.push({
      agent_name: 'Mascot Agent',
      type: 'mascot_recommendation',
      key: 'recommended_mascot',
      value: mascot,
      confidence: 0.85,
      reasoning: 'Mascot selection based on emotional tone and context.'
    });
  }

  return observations;
}
