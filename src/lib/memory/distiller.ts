import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { addOrReinforceMemory } from './service';
import { MemoryType } from './types';

const genAI = new GoogleGenerativeAI(serverEnv.GEMINI_API_KEY);

interface GeminiMemoryOutput {
  memory_type: MemoryType;
  summary: string;
  confidence: number;
  importance: number;
  context: string;
}

export async function analyzeAndDistillMemories(
  userId: string,
  sourceType: 'decision' | 'feedback',
  sourceId: string,
  payload: any
) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
You are the Memory Distillation Engine for Munch 🍀.
Your task is to analyze user interaction events (either a decision made or feedback submitted) and distill zero or more meaningful, long-term memories.

CRITICAL PRIVACY RULE:
- NEVER record credentials, passwords, APIs, payment cards, phone numbers, addresses, or government IDs.
- If the event contains sensitive personal credentials, ignore them completely.

MEMORY CATEGORIES:
1. 'episodic': Specific key moments/milestones (e.g. "Shared anxiety before launching the Munch project").
2. 'semantic': Factual details/preferences learned (e.g. "Prefers quiet study sessions", "Dislikes spicy seafood").
3. 'emotional': Key mood patterns/reactions (e.g. "Work deadline discussions increase stress", "Gains confidence from listing options").
4. 'relationship': Companion style observations (e.g. "Appreciates reflective follow-up check-ins", "Does not like being rushed").
5. 'decision': Choices structure observations (e.g. "Frequently second-guesses dinner choices", "Prefers intuitive routes for leisure").

RULES FOR DISTILLATION:
- Do NOT store the conversation logs verbatim. Distill the experience.
- Memory summaries should be concise, companion-oriented, and third-person (e.g., "Enjoys coding late at night with cozy music").
- Each memory must specify a confidence score (0.0 to 1.0) and an importance score (0.0 to 1.0) based on how meaningful it is.
- If no meaningful memory can be distilled, return an empty list: [].

EVENT DATA TO ANALYZE:
- Source Type: ${sourceType}
- Payload: ${JSON.stringify(payload)}

Output a JSON array of memories:
[
  {
    "memory_type": "episodic" | "semantic" | "emotional" | "relationship" | "decision",
    "summary": "Consolidated memory statement",
    "confidence": number (0.0 to 1.0),
    "importance": number (0.0 to 1.0),
    "context": "Short context explanation"
  }
]
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const memories = JSON.parse(text) as GeminiMemoryOutput[];

    if (Array.isArray(memories)) {
      const timestamp = new Date().toISOString();
      for (const m of memories) {
        if (
          m.memory_type &&
          m.summary &&
          typeof m.confidence === 'number' &&
          typeof m.importance === 'number'
        ) {
          await addOrReinforceMemory(
            userId,
            m.memory_type,
            m.summary.trim(),
            Math.max(0.0, Math.min(1.0, m.confidence)),
            Math.max(0.0, Math.min(1.0, m.importance)),
            {
              source_type: sourceType,
              source_id: sourceId,
              timestamp,
              context: m.context || undefined
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Failed to distill memories via Gemini:', error);
  }
}
