import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/utils/supabase/server';
import { serverEnv } from '@/lib/env';
import { UserMemory, EvidenceReference, MemoryType } from './types';

const genAI = new GoogleGenerativeAI(serverEnv.GEMINI_API_KEY);

// Finds a semantically similar memory of the same type for reinforcement using Gemini
async function findSimilarMemoryMatch(
  userId: string,
  memoryType: MemoryType,
  newSummary: string,
  existingMemories: any[]
): Promise<{ matchId: string | null; mergedSummary?: string } | null> {
  if (existingMemories.length === 0) return null;

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
You are the Memory Consolidation Engine for Munch 🍀.
We need to determine if a new memory summary describes the same learned fact, recurring emotional pattern, relationship observation, decision pattern, or specific episodic moment as one of our existing memories.

New Memory Summary to consolidate: "${newSummary}"

Existing memories of type "${memoryType}":
${existingMemories.map(m => `- [ID: ${m.id}]: "${m.summary}" (Confidence: ${m.confidence})`).join('\n')}

Output JSON format:
{
  "match_id": "the matched ID from the list, or null if it's a completely new memory",
  "merged_summary": "If matched, write a refined summary that merges both observations cleanly. Otherwise, null"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return {
      matchId: parsed.match_id || null,
      mergedSummary: parsed.merged_summary || undefined
    };
  } catch (error) {
    console.error('Failed to find semantic memory match:', error);
    return null;
  }
}

// Add or reinforce a memory dynamically
export async function addOrReinforceMemory(
  userId: string,
  memoryType: MemoryType,
  summary: string,
  confidence: number,
  importance: number,
  evidenceRef: EvidenceReference
) {
  const supabase = await createClient();

  // 1. Fetch all existing memories of the same type
  const { data: existing, error: fetchError } = await supabase
    .from('user_memories')
    .select('id, summary, confidence, importance, evidence_refs')
    .eq('user_id', userId)
    .eq('memory_type', memoryType);

  if (fetchError) {
    console.error('Error fetching existing memories:', fetchError);
  }

  const existingList = existing || [];

  // 2. Check for semantic match
  const matchResult = await findSimilarMemoryMatch(userId, memoryType, summary, existingList);

  if (matchResult && matchResult.matchId) {
    // REINFORCE: Match found
    const matched = existingList.find(m => m.id === matchResult.matchId);
    if (matched) {
      // Confidence Reinforcement Formula
      const existingConf = Number(matched.confidence);
      const newConfidence = Math.min(1.0, existingConf + (1.0 - existingConf) * confidence * 0.5);

      // Importance updates to the higher level
      const newImportance = Math.max(Number(matched.importance), importance);

      // Merge evidence references ensuring no duplicate source IDs
      const oldRefs = Array.isArray(matched.evidence_refs) ? matched.evidence_refs : [];
      const updatedRefs = [...oldRefs];
      if (!updatedRefs.some(ref => ref.source_id === evidenceRef.source_id)) {
        updatedRefs.push(evidenceRef);
      }

      const { data, error } = await supabase
        .from('user_memories')
        .update({
          summary: matchResult.mergedSummary || summary,
          confidence: newConfidence,
          importance: newImportance,
          relevance_score: 1.0, // reset decay
          evidence_refs: updatedRefs,
          last_referenced_at: new Date().toISOString()
        })
        .eq('id', matched.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  // CREATE: No match found, insert new memory
  const { data, error } = await supabase
    .from('user_memories')
    .insert({
      user_id: userId,
      memory_type: memoryType,
      summary,
      confidence,
      importance,
      relevance_score: 1.0,
      evidence_refs: [evidenceRef],
      last_referenced_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Applies time-decay factor on all memories
export async function decayMemories(userId: string) {
  const supabase = await createClient();
  const { data: memories, error } = await supabase
    .from('user_memories')
    .select('id, relevance_score, confidence, last_referenced_at')
    .eq('user_id', userId);

  if (error || !memories || memories.length === 0) return;

  const now = new Date();
  const LAMBDA_REL = 0.02; // relevance decays 2% per day
  const LAMBDA_CONF = 0.01; // confidence decays 1% per day if unreferenced

  for (const m of memories) {
    const ageInMs = now.getTime() - new Date(m.last_referenced_at).getTime();
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

    if (ageInDays > 0.5) { // Only decay if last referenced > 12 hours ago
      const decayedRelevance = Number(m.relevance_score) * Math.exp(-LAMBDA_REL * ageInDays);
      const decayedConfidence = Number(m.confidence) * Math.exp(-LAMBDA_CONF * ageInDays);

      await supabase
        .from('user_memories')
        .update({
          relevance_score: Math.max(0.1, decayedRelevance),
          confidence: Math.max(0.05, decayedConfidence)
        })
        .eq('id', m.id);
    }
  }
}

// Retrieves relevant memories for context query, performing decay on fetch
export async function retrieveMemories(userId: string, contextQuery: string, limit = 5) {
  const supabase = await createClient();

  // Run decay logic first
  await decayMemories(userId).catch(err => console.error('Decay error:', err));

  // Retrieve memories ordered by relevance and recency
  const { data: memories, error } = await supabase
    .from('user_memories')
    .select('*')
    .eq('user_id', userId)
    .order('relevance_score', { ascending: false })
    .order('last_referenced_at', { ascending: false })
    .limit(15);

  if (error || !memories || memories.length === 0) return [];

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
You are the Memory Retrieval Filter for Munch 🍀.
We need to retrieve the most contextually useful memories of the user to personalize the companion interaction.

Context Query: "${contextQuery}"

Available memories:
${memories.map((m, idx) => `[Idx: ${idx}] Type: ${m.memory_type} | "${m.summary}"`).join('\n')}

Output JSON format:
{
  "selected_indices": [number] // array of indices from the available memories list that are directly relevant to the Context Query (max ${limit} items)
}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    const selectedIndices: number[] = parsed.selected_indices || [];

    const retrievedMemories = selectedIndices
      .map(idx => memories[idx])
      .filter(Boolean);

    // Update last_referenced_at and reset relevance score for retrieved memories
    if (retrievedMemories.length > 0) {
      const ids = retrievedMemories.map(m => m.id);
      await supabase
        .from('user_memories')
        .update({
          relevance_score: 1.0,
          last_referenced_at: new Date().toISOString()
        })
        .in('id', ids);
    }

    return retrievedMemories;
  } catch (error) {
    console.error('Failed to retrieve context-matched memories:', error);
    // Fallback: return top N memories by relevance/recency directly
    return memories.slice(0, limit);
  }
}
