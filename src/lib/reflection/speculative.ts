import { CognitiveTrace } from './types';

export interface CognitiveFingerprint {
  emotionHash: string;
  storyHash: string;
  memoryHash: string;
  intentHash: string;
  personalityHash: string;
}

export interface DraftCognitiveState {
  draft: string;
  normalizedDraft: string;
  pipelineVersion: string;
  engineVersions: Record<string, string>;
  fingerprints: Record<string, string>;
  cognitiveTrace: CognitiveTrace;
  completedEngines: string[];
  timestamp: number;
  predictionConfidence: number;
}

// Current system pipeline version
export const PIPELINE_VERSION = 'v1.3.0';

// Stable versions per engine
export const ENGINE_VERSIONS: Record<string, string> = {
  'NLU Engine': '1.0.0',
  'Emotion Engine': '1.1.0',
  'Emotional State Engine': '1.0.0',
  'Emotion Regulation Engine': '1.0.0',
  'Emotion Dynamics Engine': '1.2.0',
  'Story Engine': '1.0.0',
  'Story Events Engine': '1.1.0',
  'Story Progress Engine': '1.0.0',
  'Story Intelligence Engine': '1.1.0',
  'Memory Consolidation Engine': '1.2.0',
  'Cognitive Orchestrator': '1.1.0',
  'Personality Engine': '1.2.0',
  'Response Planning Engine': '1.0.0',
  'Reflection Engine': '1.1.0',
  'Mascot Specialist': '1.0.0',
  'Decision Readiness Engine': '1.0.0'
};

// Configurable Engine Dependency Graph
export const ENGINE_DEPENDENCIES: Record<string, string[]> = {
  'Emotion Engine': ['NLU Engine'],
  'Emotional State Engine': ['Emotion Engine'],
  'Emotion Regulation Engine': ['Emotional State Engine'],
  'Emotion Dynamics Engine': ['Emotion Regulation Engine'],
  'Story Engine': ['NLU Engine'],
  'Story Events Engine': ['Story Engine'],
  'Story Progress Engine': ['Story Events Engine'],
  'Story Intelligence Engine': ['Story Progress Engine'],
  'Memory Consolidation Engine': ['Story Intelligence Engine'],
  'Cognitive Orchestrator': ['Emotion Dynamics Engine', 'Memory Consolidation Engine'],
  'Personality Engine': ['Cognitive Orchestrator'],
  'Response Planning Engine': ['Personality Engine'],
  'Reflection Engine': ['Response Planning Engine'],
  'Mascot Specialist': ['Personality Engine'],
  'Decision Readiness Engine': ['Cognitive Orchestrator']
};

export const SPECULATIVE_CACHE = new Map<string, DraftCognitiveState>();
export const ACTIVE_CONTROLLERS = new Map<string, AbortController>();

// Configuration constants
const MAX_CACHE_SIZE = 50;
const CONFIDENCE_CACHE_THRESHOLD = 0.35;

/**
 * Normalizes text for cheap token-overlap check.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Jaccard Similarity of tokens between two strings.
 */
export function computeJaccardSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const set1 = new Set(norm1.split(' '));
  const set2 = new Set(norm2.split(' '));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Estimates prediction confidence for a draft to avoid caching half-written noise.
 */
export function evaluatePredictionConfidence(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0.0;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0.0;

  let score = 0.0;

  // 1. Punctuation presence signals draft maturity
  const endsWithPunctuation = /[.!?]$/.test(trimmed);
  if (endsWithPunctuation) {
    score += 0.30;
  } else if (/[,;:]/.test(trimmed)) {
    score += 0.15;
  }

  // 2. Token length scale
  if (tokens.length >= 8) {
    score += 0.50;
  } else if (tokens.length >= 4) {
    score += 0.35;
  } else {
    score += 0.15;
  }

  // 3. Check for trailing prepositions/conjunctions (incomplete thought signifier)
  const trailingIncomplete = /\b(and|or|but|the|a|an|i|my|to|in|of|for|with|is|are|at)$/i.test(trimmed);
  if (!trailingIncomplete) {
    score += 0.20;
  }

  return Math.min(1.0, score);
}

/**
 * Resolves dependency invalidation.
 * Invalidation propagates to any downstream engine relying on invalid inputs.
 */
export function resolveInvalidatedEngines(draft: string, finalMessage: string): Set<string> {
  const normDraft = normalizeText(draft);
  const normFinal = normalizeText(finalMessage);

  const invalidated = new Set<string>();

  if (normDraft === normFinal) {
    // Only run final presentation/expression layers
    invalidated.add('Reflection Engine');
    invalidated.add('Mascot Specialist');
    invalidated.add('Decision Readiness Engine');
    return invalidated;
  }

  const jaccard = computeJaccardSimilarity(draft, finalMessage);
  const lengthDiff = Math.abs(draft.length - finalMessage.length);

  // Initial trigger invalidations
  if (jaccard >= 0.90 && lengthDiff <= 15) {
    // Minor changes: re-run only Orchestrator, Personality, and presentation
    invalidated.add('Cognitive Orchestrator');
    invalidated.add('Personality Engine');
    invalidated.add('Reflection Engine');
    invalidated.add('Mascot Specialist');
    invalidated.add('Decision Readiness Engine');
  } else if (jaccard >= 0.70 && lengthDiff <= 50) {
    // Medium changes: Emotion, Story and Orchestrator layers invalidated
    invalidated.add('Emotion Engine');
    invalidated.add('Emotional State Engine');
    invalidated.add('Emotion Regulation Engine');
    invalidated.add('Emotion Dynamics Engine');
    invalidated.add('Story Engine');
    invalidated.add('Story Events Engine');
    invalidated.add('Story Progress Engine');
    invalidated.add('Story Intelligence Engine');
    invalidated.add('Cognitive Orchestrator');
    invalidated.add('Personality Engine');
    invalidated.add('Reflection Engine');
    invalidated.add('Mascot Specialist');
    invalidated.add('Decision Readiness Engine');
  } else {
    // Major changes: All engines invalidated
    Object.keys(ENGINE_VERSIONS).forEach(e => invalidated.add(e));
    return invalidated;
  }

  // Bubble downstream dependencies using BFS
  const queue = Array.from(invalidated);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [engineName, deps] of Object.entries(ENGINE_DEPENDENCIES)) {
      if (deps.includes(current) && !invalidated.has(engineName)) {
        invalidated.add(engineName);
        queue.push(engineName);
      }
    }
  }

  return invalidated;
}

/**
 * Computes generic hashes for engine state blocks for trace fingerprinting.
 */
export function generateFingerprints(trace: CognitiveTrace): Record<string, string> {
  const getHash = (obj: any): string => {
    if (!obj) return '';
    try {
      return JSON.stringify(obj);
    } catch {
      return '';
    }
  };

  return {
    'NLU Engine': getHash(trace.activeTopicKey),
    'Emotion Engine': getHash(trace.emotions),
    'Emotional State Engine': getHash(trace.emotionalState),
    'Story Engine': getHash(trace.storyState),
    'Story Events Engine': getHash(trace.storyState?.events),
    'Story Progress Engine': getHash(trace.storyProgress),
    'Story Intelligence Engine': getHash(trace.storyInsight),
    'Memory Consolidation Engine': getHash(trace.memoryState),
    'Cognitive Orchestrator': getHash(trace.cognitiveDecision),
    'Personality Engine': getHash(trace.personalityDecision),
    'Response Planning Engine': getHash(trace.responsePlan)
  };
}

/**
 * Hybrid eviction policy scoring function.
 * Higher score = higher priority to evict first.
 */
export function getEvictionScore(entry: DraftCognitiveState, now: number): number {
  const ageInSecs = (now - entry.timestamp) / 1000;
  return (ageInSecs * 0.1) - (entry.draft.length * 0.05) - (entry.predictionConfidence * 0.5);
}

/**
 * Places draft into the cache, enforcing hybrid priority LRU eviction if maximum limit is exceeded.
 */
export function setSpeculativeState(draftId: string, state: DraftCognitiveState): void {
  // Confidence gate check
  if (state.predictionConfidence < CONFIDENCE_CACHE_THRESHOLD) {
    return;
  }

  SPECULATIVE_CACHE.set(draftId, state);

  // Enforce Max Size LRU / priority eviction
  if (SPECULATIVE_CACHE.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    let highestScore = -Infinity;
    let victimKey: string | null = null;

    for (const [key, val] of SPECULATIVE_CACHE.entries()) {
      const score = getEvictionScore(val, now);
      if (score > highestScore) {
        highestScore = score;
        victimKey = key;
      }
    }

    if (victimKey) {
      SPECULATIVE_CACHE.delete(victimKey);
    }
  }
}
