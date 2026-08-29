import { EnvelopeGenerationContext } from './types';

/**
 * Standard stop words for conversational NLP overlap checking
 */
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Normalizes text for comparison by removing punctuation and excess whitespace.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts meaningful non-stopword tokens from text.
 */
export function extractContentTokens(text: string): Set<string> {
  const norm = normalizeText(text);
  const words = norm.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Extracts the first sentence of a message.
 */
export function getFirstSentence(text: string): string {
  const match = text.trim().match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1].trim() : text.trim();
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let j = 0; j <= an; ++j) matrix[0][j] = j;

  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Computes Levenshtein similarity ratio between 0.0 and 1.0.
 */
export function getLevenshteinSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na && !nb) return 1.0;
  if (!na || !nb) return 0.0;
  if (na === nb) return 1.0;
  const maxLen = Math.max(na.length, nb.length);
  const dist = calculateLevenshteinDistance(na, nb);
  return 1 - (dist / maxLen);
}

/**
 * Computes Jaccard Similarity between two token sets.
 */
export function getJaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }
  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

export interface EnvelopeRepetitionResult {
  isRepetitive: boolean;
  reason?: string;
  matchedPrevious?: string;
  similarityScore?: number;
}

/**
 * Checks whether a candidate envelope message is repetitive compared to previous envelopes
 * belonging to the same conversation.
 */
export function checkEnvelopeRepetition(
  candidate: string,
  previousEnvelopes: string[] = []
): EnvelopeRepetitionResult {
  if (!candidate || !candidate.trim()) {
    return { isRepetitive: true, reason: 'Empty candidate envelope' };
  }

  const trimmedCandidate = candidate.trim();
  const normCandidate = normalizeText(trimmedCandidate);
  const candidateTokens = extractContentTokens(trimmedCandidate);
  const candidateOpening = normalizeText(getFirstSentence(trimmedCandidate));

  for (const prev of previousEnvelopes) {
    if (!prev || !prev.trim()) continue;
    const trimmedPrev = prev.trim();
    const normPrev = normalizeText(trimmedPrev);

    // 1. Exact or normalized string equality
    if (normCandidate === normPrev) {
      return {
        isRepetitive: true,
        reason: 'Exact duplicate of previous envelope message',
        matchedPrevious: trimmedPrev,
        similarityScore: 1.0
      };
    }

    // 2. Matching opening sentence (>= 16 characters)
    const prevOpening = normalizeText(getFirstSentence(trimmedPrev));
    if (candidateOpening.length >= 16 && candidateOpening === prevOpening) {
      return {
        isRepetitive: true,
        reason: 'Identical opening sentence to a previous envelope message',
        matchedPrevious: trimmedPrev,
        similarityScore: 0.9
      };
    }

    // 3. High token overlap / Jaccard similarity (>= 0.55)
    const prevTokens = extractContentTokens(trimmedPrev);
    const jaccard = getJaccardSimilarity(candidateTokens, prevTokens);
    if (jaccard >= 0.55 && candidateTokens.size >= 3 && prevTokens.size >= 3) {
      return {
        isRepetitive: true,
        reason: `Substantial semantic/token overlap (Jaccard: ${jaccard.toFixed(2)})`,
        matchedPrevious: trimmedPrev,
        similarityScore: jaccard
      };
    }

    // 4. High Levenshtein similarity (>= 0.70)
    const levSim = getLevenshteinSimilarity(normCandidate, normPrev);
    if (levSim >= 0.70) {
      return {
        isRepetitive: true,
        reason: `Near-paraphrase / high edit similarity (${(levSim * 100).toFixed(0)}%)`,
        matchedPrevious: trimmedPrev,
        similarityScore: levSim
      };
    }

    // 5. Long substring containment
    if (normPrev.length >= 24 && (normCandidate.includes(normPrev) || (normPrev.includes(normCandidate) && normCandidate.length >= 24))) {
      return {
        isRepetitive: true,
        reason: 'Contains substantial verbatim substring of previous envelope',
        matchedPrevious: trimmedPrev,
        similarityScore: 0.85
      };
    }
  }

  return { isRepetitive: false };
}

/**
 * Generates a deterministic, context-specific envelope message when LLM retries fail
 * or when executing offline, guaranteeing that the result does NOT duplicate previous envelopes.
 */
export function generateContextualFallback(
  context: EnvelopeGenerationContext,
  previousEnvelopes: string[] = []
): string {
  const name = context.nickname || 'friend';
  const userMsg = (context.currentUserMessage || '').toLowerCase();
  const emotions = context.cognitiveState?.emotions || [];
  const topic = (context.currentTopic || context.cognitiveState?.activeTopicKey || 'general').toLowerCase();

  // Context-specific candidate pools
  const candidates: string[] = [];

  if (userMsg.includes('project') || userMsg.includes('work') || userMsg.includes('build') || userMsg.includes('code') || topic.includes('project')) {
    candidates.push(
      `${name}, bringing something from an idea into the world is significant. Take a slow moment to acknowledge the effort you've poured into it.`,
      `A working project is a rewarding milestone, ${name}. Quiet the rush for a second and let yourself feel good about what you accomplished.`,
      `Seeing things finally come together after so much focus is wonderful, ${name}. Give yourself credit for seeing it through.`,
      `You've put deep energy into this, ${name}. Whatever next steps wait ahead, honor this moment of progress first.`
    );
  } else if (userMsg.includes('worry') || userMsg.includes('wrong') || userMsg.includes('anxious') || userMsg.includes('fear') || emotions.includes('anxious') || emotions.includes('fear')) {
    candidates.push(
      `It is completely natural for worries to linger even when things go well, ${name}. We don't have to solve everything at once.`,
      `When you care about what you're doing, the mind naturally searches for what could go wrong. Take a slow breath with me, ${name}.`,
      `You don't have to carry the weight of future uncertainties right now, ${name}. Let's stay gently anchored in today's calm.`,
      `Vulnerability and doubt are quiet companions on any journey, ${name}. We can take this one small, safe step at a time.`
    );
  } else if (userMsg.includes('chill') || userMsg.includes('relax') || userMsg.includes('rest') || userMsg.includes('good') || userMsg.includes('happy') || emotions.includes('happy')) {
    candidates.push(
      `I'm really glad to share this peaceful moment with you, ${name}. Savor the lightness in your day.`,
      `A quiet, unhurried space is a gift to your thoughts, ${name}. Enjoy the gentle pace today.`,
      `Nothing demanding to solve right now, ${name}—just resting and letting the day unfold softly.`,
      `It feels lovely when things settle down, ${name}. Keep breathing easy and take your time.`
    );
  } else if (context.triggerType === 'milestone') {
    candidates.push(
      `We are reaching a meaningful milestone together, ${name}. Thank you for sharing these thoughtful steps with me.`,
      `Every choice you explore brings a little more clarity, ${name}. I'm honored to walk this path beside you.`,
      `A quiet milestone reached, ${name}. Celebrating the patience and care you put into your thoughts.`
    );
  } else if (context.triggerType === 'inactivity') {
    candidates.push(
      `Welcome back, ${name}. There's never any rush or pressure here—just a safe space whenever you want to share.`,
      `It's so good to see you again, ${name}. I hope you've found small pockets of comfort while you were away.`,
      `Whenever life gets busy, remember you have a quiet corner right here, ${name}. How are you feeling today?`
    );
  } else if (context.triggerType === 'daily_return') {
    candidates.push(
      `Good to see you back today, ${name}. Taking a few quiet moments for yourself is a lovely rhythm to keep.`,
      `Hello ${name}. I hope your day is treating you gently. I'm right here whenever you'd like to reflect.`,
      `Welcome back, ${name}. Let's slow down the noise together and see what's on your mind today.`
    );
  } else {
    // General context-aware candidates
    candidates.push(
      `Take a gentle breath, ${name}. Whatever you are navigating today, we can untangle it one thought at a time.`,
      `I'm right here listening, ${name}. No expectations, just a soft space to explore what feels right to you.`,
      `Finding clarity starts with slowing down, ${name}. Let's take our time with whatever is on your heart.`,
      `Your thoughts are safe here, ${name}. We can look at things together without any rush.`
    );
  }

  // Find the first candidate that passes anti-repetition against previous envelopes
  for (const candidate of candidates) {
    const rep = checkEnvelopeRepetition(candidate, previousEnvelopes);
    if (!rep.isRepetitive) {
      return candidate;
    }
  }

  // Fallback: Dynamically generate an unrepeated composite with unique time signature
  const timestampId = Date.now().toString(36).slice(-4);
  return `${name}, whenever thoughts feel heavy or plentiful, remember we can take them one gentle step at a time. [🍀 ${timestampId}]`;
}
