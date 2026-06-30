import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { addObservation } from './service';
import { HUPSObservation, HUPSDimension } from './types';

// Initialize the Gemini API client — guaranteed valid by env.ts validation
const genAI = new GoogleGenerativeAI(serverEnv.GEMINI_API_KEY);

interface GeminiObservationOutput {
  dimension: HUPSDimension;
  key: string;
  observed_value: any;
  confidence: number;
  context: string;
}

export async function analyzeAndLogObservations(
  userId: string,
  sourceType: 'decision' | 'feedback',
  sourceId: string,
  payload: any
) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `
You are the Human Understanding Profile System (HUPS) analyzer for Munch 🍀.
Your task is to analyze user interaction events (either a decision made or feedback submitted) and generate zero or more evidence-based profile observations.

CRITICAL RULE:
- NEVER invent information.
- NEVER populate a dimension/field because it seems common or standard.
- Do NOT make assumptions about values, narrative, growth, timezone, preferred name, etc.
- If there is no clear, explicit, or strongly implied evidence for a dimension from this specific event, do NOT output anything for that dimension.
- If no dimensions have clear evidence, return an empty array: [].
- Every observation must be strictly grounded in the provided event data.

Dimensions of Understanding you can output:
1. 'identity': Factual details about who this person is (e.g. key = "preferred_name", "timezone", "language"). Only output if explicitly provided.
2. 'relationship': Who we are to each other (e.g. key = "familiarity", "trust", "openness"). Value should be a level or indicator.
3. 'values': What matters to this person (e.g. key = "growth", "peace", "freedom", "family", "creativity", "achievement", "authenticity", "curiosity"). Value should be a boolean (true) or descriptive text.
4. 'communication': Preferred style (e.g. key = "reflective", "direct", "analytical", "emotional", "playful", "concise"). Value = probability between 0.0 and 1.0.
5. 'decision_pattern': How they make decisions (e.g. key = "overthinks", "trusts_intuition", "seeks_reassurance", "prefers_evidence", "avoids_conflict", "explores_deeply"). Value = probability between 0.0 and 1.0.
6. 'comfort': What comforts/supports them (e.g. key = "validation", "encouragement", "reflection", "listening", "guidance", "humor"). Value = score or probability.
7. 'interests': What attracts their attention (e.g. key = name of interest like "cooking", "gaming", "fitness"). Value = true or rating.
8. 'emotional_pattern': Emotional patterns observed (e.g. key = "uncertainty_stress", "progress_confidence", "connection_mood"). Value = true or descriptive context.
9. 'narrative': What story they are currently living (e.g. key = "current_story"). Value = string (e.g. "I am trying to learn to trust myself").
10. 'growth': Observations on change over time (e.g. key = "reduced_overthinking", "increased_confidence"). Value = descriptive context.
11. 'uncertainty': High uncertainty/unknowns (e.g. key = topic_name). Value = true.

INPUT EVENT DATA:
- Source Type: ${sourceType}
- Payload Data: ${JSON.stringify(payload)}

Output a JSON array of observations matching this schema:
[
  {
    "dimension": "values" | "communication" | "decision_pattern" | "comfort" | "interests" | "emotional_pattern" | "narrative" | "growth" | "identity" | "uncertainty",
    "key": "specific_attribute_key",
    "observed_value": any,
    "confidence": number (0.0 to 1.0),
    "context": "Context description of what was observed, e.g. 'Prefers cozy comfort foods when feeling stressed late at night'"
  }
]
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const observations = JSON.parse(text) as GeminiObservationOutput[];

    if (Array.isArray(observations)) {
      for (const obs of observations) {
        // Enforce basic type checks before saving
        if (
          obs.dimension &&
          obs.key &&
          obs.observed_value !== undefined &&
          typeof obs.confidence === 'number'
        ) {
          await addObservation({
            user_id: userId,
            source_type: sourceType,
            source_id: sourceId,
            dimension: obs.dimension,
            key: obs.key.trim().toLowerCase(),
            observed_value: obs.observed_value,
            confidence: Math.max(0.0, Math.min(1.0, obs.confidence)),
            context: obs.context || undefined
          });
        }
      }
    }
  } catch (error) {
    console.error('Failed to analyze HUPS observations via Gemini:', error);
  }
}
