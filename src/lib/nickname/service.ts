import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { createClient } from '@/utils/supabase/server';
import { RelationshipLevel, NicknameAffinity, NicknameReaction, IdentityState } from './types';

// Initialize Gemini safely
const getGeminiModel = () => {
  const apiKey = serverEnv.GEMINI_API_KEY || '';
  if (!apiKey || apiKey === 'MOCK_KEY') return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-3.1-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });
};

/**
 * Calculates the current relationship level and score for a user.
 */
export async function getRelationshipState(userId: string): Promise<{
  level: RelationshipLevel;
  score: number;
  decisionsCount: number;
  memoriesCount: number;
  activeDays: number;
  returnVisits: number;
}> {
  const supabase = await createClient();

  // 1. Fetch decisions to compute count and active days
  const { data: decisions, error: decError } = await supabase
    .from('decisions')
    .select('created_at')
    .eq('user_id', userId);

  if (decError) {
    console.error('[IdentityService] Error fetching decisions for relationship:', decError);
  }

  const decs = decisions || [];
  const decisionsCount = decs.length;

  // Active days: distinct calendar days where decisions occurred
  const uniqueDays = new Set(
    decs.map((d) => {
      const date = d.created_at ? new Date(d.created_at) : new Date();
      return date.toISOString().split('T')[0];
    })
  );
  const activeDays = uniqueDays.size;
  const returnVisits = Math.max(0, activeDays - 1);

  // 2. Fetch memories count
  const { data: memories, error: memError } = await supabase
    .from('user_memories')
    .select('id')
    .eq('user_id', userId);

  if (memError) {
    console.error('[IdentityService] Error fetching memories for relationship:', memError);
  }

  const memoriesCount = memories?.length || 0;

  // 3. Compute relationship score:
  // (Decisions * 2) + (Memories * 5) + (Active Days * 3) + (Return Visits * 4)
  const score = (decisionsCount * 2) + (memoriesCount * 5) + (activeDays * 3) + (returnVisits * 4);

  // 4. Map score to level
  let level: RelationshipLevel = 'new';
  if (score > 100) {
    level = 'close';
  } else if (score >= 51) {
    level = 'trusted';
  } else if (score >= 21) {
    level = 'familiar';
  }

  return {
    level,
    score,
    decisionsCount,
    memoriesCount,
    activeDays,
    returnVisits
  };
}

/**
 * Extracts rule-based candidates based on database evidence, strictly preventing hallucinations.
 */
export async function extractRuleBasedTokens(userId: string): Promise<string[]> {
  const supabase = await createClient();

  // Fetch beliefs (HUPS)
  const { data: beliefs, error } = await supabase
    .from('user_beliefs')
    .select('dimension, key, value, confidence, evidence_count')
    .eq('user_id', userId);

  if (error || !beliefs) {
    return [];
  }

  const tokens: string[] = [];

  // Rules: evidence_count >= 3 OR confidence >= 0.7
  const verifiedBeliefs = beliefs.filter(
    (b) => b.evidence_count >= 3 || Number(b.confidence) >= 0.7
  );

  verifiedBeliefs.forEach((belief) => {
    const val = String(belief.value).toLowerCase();
    const key = String(belief.key).toLowerCase();
    const combined = `${key} ${val}`;
    
    // Check interests dimension
    if (belief.dimension === 'interests') {
      if (combined.includes('cook') || combined.includes('bake') || combined.includes('baking') || combined.includes('baker') || combined.includes('food')) {
        tokens.push('builder', 'foodie');
      } else if (combined.includes('study') || combined.includes('learn') || combined.includes('read')) {
        tokens.push('thinker', 'stargazer');
      } else if (combined.includes('sport') || combined.includes('gym') || combined.includes('fitness') || combined.includes('run')) {
        tokens.push('explorer', 'runner');
      } else if (combined.includes('game') || combined.includes('movie') || combined.includes('play')) {
        tokens.push('dreamer', 'player');
      }
    }

    // Check decision pattern
    if (belief.dimension === 'decision_pattern') {
      if (combined.includes('deliberate') || combined.includes('slow') || combined.includes('thoughtful')) {
        tokens.push('thinker', 'ponderer');
      } else if (combined.includes('spontaneous') || combined.includes('fast')) {
        tokens.push('explorer', 'adventurer');
      }
    }

    // Check values
    if (belief.dimension === 'values') {
      if (combined.includes('creative') || combined.includes('art') || combined.includes('imagination')) {
        tokens.push('dreamer', 'artist');
      } else if (combined.includes('structure') || combined.includes('order') || combined.includes('planning')) {
        tokens.push('builder', 'architect');
      }
    }
  });

  return Array.from(new Set(tokens));
}

/**
 * Generates nickname candidates and stores them in public.nickname_affinity.
 */
export async function generateNicknameCandidates(
  userId: string,
  userName: string,
  relationshipLevel: RelationshipLevel
): Promise<string[]> {
  const supabase = await createClient();

  // 1. Safe fallbacks
  const safeFallbacks = ['friend', 'buddy', 'explorer', 'builder', 'thinker'];

  // 2. Extract verified evidence-based tokens
  const ruleTokens = await extractRuleBasedTokens(userId);

  // Combine tokens. If empty, start with safe fallbacks and username variations
  const inputTokens = ruleTokens.length > 0 ? ruleTokens : safeFallbacks;

  let candidates: string[] = [];

  const model = getGeminiModel();
  if (model) {
    const prompt = `
You are the Nickname Refinement Engine for Munch 🍀.
Munch is a gentle four-leaf clover companion.
We need to generate a set of 3 to 5 unique, warm, and gentle nicknames for the user based strictly on the provided user profile details and candidate tokens.
Do NOT invent interests, values, or traits not mentioned in the context.

User Details:
- Name: ${userName}
- Relationship Level: ${relationshipLevel}
- Rule-based Candidate Tokens (derived from verified profile evidence): ${JSON.stringify(inputTokens)}

Instructions:
1. Refine, filter, and polish the candidate tokens into gentle, companion-like nicknames.
2. If the relationship level is "new", focus on variations of the user's name or simple safe nicknames (like "friend", "buddy", or initials).
3. If the relationship level is "familiar", "trusted", or "close", you can suggest warmer, more metaphorical nicknames derived from their verified tokens (like "stargazer", "builder", "dreamer").
4. Never suggest corporate, analytical, or robotic terms.
5. Nicknames must be single words or short phrases.

Output format must be JSON:
{
  "nicknames": ["candidate1", "candidate2", "candidate3"]
}
`;

    try {
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.nicknames)) {
        candidates = parsed.nicknames.map((n: string) => n.trim().toLowerCase());
      }
    } catch (err) {
      console.error('[IdentityService] Gemini nickname refinement failed, falling back:', err);
    }
  }

  // Fallback: If LLM fails or is not available, use rule-based tokens and safe list directly
  if (candidates.length === 0) {
    // Generate simple variations of the user's name and safe list
    const nameLower = userName.toLowerCase();
    candidates = [
      nameLower,
      ...inputTokens.slice(0, 3)
    ];
  }

  // Filter out empty strings or invalid strings, limit to unique, and trim
  const cleanCandidates = Array.from(new Set(
    candidates
      .map((n) => n.trim().replace(/[^a-zA-Z0-9\s]/g, ''))
      .filter((n) => n.length > 1 && n.length < 25)
  )).slice(0, 5);

  if (cleanCandidates.length === 0) {
    cleanCandidates.push('friend', userName.toLowerCase());
  }

  // Store them in public.nickname_affinity
  const now = new Date().toISOString();
  const upsertPayload = cleanCandidates.map((nick) => ({
    user_id: userId,
    nickname: nick,
    times_used: 0,
    comfort_score: 1.0,
    is_active: false,
    last_used_at: now
  }));

  const { error } = await supabase
    .from('nickname_affinity')
    .upsert(upsertPayload, { onConflict: 'user_id,nickname' });

  if (error) {
    console.error('[IdentityService] Error saving nickname affinities:', error);
  }

  return cleanCandidates;
}

/**
 * Initializes nicknames for a user immediately during signup/first-visit.
 */
export async function initializeUserNicknames(userId: string, userName: string): Promise<string[]> {
  const { level } = await getRelationshipState(userId);
  return generateNicknameCandidates(userId, userName, level);
}

/**
 * Selects the best nickname for the current session, applying the cooldown system and scoring.
 */
export async function selectNickname(userId: string): Promise<string> {
  const supabase = await createClient();

  // 1. Get current relationship level
  const { level } = await getRelationshipState(userId);

  // 2. Fetch affinities
  let { data: affinities, error: fetchError } = await supabase
    .from('nickname_affinity')
    .select('*')
    .eq('user_id', userId)
    .order('comfort_score', { ascending: false });

  if (fetchError) {
    console.error('[IdentityService] Error fetching affinities:', fetchError);
  }

  // 3. Populate if empty
  if (!affinities || affinities.length === 0) {
    const { data: userRecord } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();
    const name = userRecord?.name || 'friend';
    await generateNicknameCandidates(userId, name, level);

    // Refetch
    const { data: refetched } = await supabase
      .from('nickname_affinity')
      .select('*')
      .eq('user_id', userId)
      .order('comfort_score', { ascending: false });
    affinities = refetched || [];
  }

  // Filter out any disliked nicknames
  const candidates = affinities.filter((a) => a.user_reaction !== 'dislike');

  if (candidates.length === 0) {
    // If all are disliked, fall back to safe name or 'friend'
    return 'friend';
  }

  // 4. Fetch the last 3 decisions for cooldown checking
  const { data: recentDecisions } = await supabase
    .from('decisions')
    .select('nickname_snapshot')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);

  const cooldownList = (recentDecisions || [])
    .map((d) => d.nickname_snapshot)
    .filter(Boolean);

  // 5. Score candidates
  const scored = candidates.map((a) => {
    let score = Number(a.comfort_score);

    // Cooldown penalty
    const isCooldowned = cooldownList.includes(a.nickname);
    if (isCooldowned) {
      score -= 5.0; // Heavy penalty
    }

    // Exploration noise
    const noise = Math.random() * 0.3;
    score += noise;

    return { affinity: a, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const selected = scored[0].affinity;

  // 6. Persist active nickname state in database
  // Deactivate all others, activate selected
  await supabase
    .from('nickname_affinity')
    .update({ is_active: false })
    .eq('user_id', userId);

  const now = new Date().toISOString();
  await supabase
    .from('nickname_affinity')
    .update({
      is_active: true,
      times_used: selected.times_used + 1,
      last_used_at: now
    })
    .eq('id', selected.id);

  return selected.nickname;
}

/**
 * Resolves the active user greeting name using: nickname -> preferred_name -> account_name.
 */
export async function getGreetingName(userId: string): Promise<string> {
  const supabase = await createClient();

  // 1. Active nickname
  const { data: activeNick } = await supabase
    .from('nickname_affinity')
    .select('nickname')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1);

  if (activeNick && activeNick.length > 0) {
    return activeNick[0].nickname;
  }

  // 2. User profile name / Preferred name
  const { data: userRecord } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single();

  if (userRecord?.name) {
    return userRecord.name;
  }

  return 'friend';
}

/**
 * Resolves the complete dynamic identity state for frontend display or templates.
 */
export async function getIdentityState(userId: string): Promise<IdentityState> {
  const { level, score } = await getRelationshipState(userId);
  const nickname = await getGreetingName(userId);
  
  const supabase = await createClient();
  const { data: userRecord } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single();

  return {
    nickname,
    preferred_name: userRecord?.name || 'friend',
    relationship_level: level,
    relationship_score: score
  };
}

/**
 * Updates comfort score based on reaction (👍 Love, 😐 Okay, 👎 Don't Use)
 */
export async function updateNicknameAffinity(
  userId: string,
  nickname: string,
  reaction: NicknameReaction
): Promise<void> {
  const supabase = await createClient();

  // Fetch current record
  const { data: record, error: fetchError } = await supabase
    .from('nickname_affinity')
    .select('id, comfort_score')
    .eq('user_id', userId)
    .eq('nickname', nickname)
    .single();

  if (fetchError || !record) {
    console.error('[IdentityService] Error fetching nickname to update affinity:', fetchError);
    return;
  }

  let delta = 0.0;
  if (reaction === 'love') {
    delta = 2.0;
  } else if (reaction === 'okay') {
    delta = 0.5;
  } else if (reaction === 'dislike') {
    delta = -1.5;
  }

  const newScore = Math.max(0.0, Math.min(10.0, Number(record.comfort_score) + delta));

  await supabase
    .from('nickname_affinity')
    .update({
      user_reaction: reaction,
      comfort_score: newScore
    })
    .eq('id', record.id);
}
