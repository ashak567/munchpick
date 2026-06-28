import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeText,
  computeJaccardSimilarity,
  evaluatePredictionConfidence,
  resolveInvalidatedEngines,
  setSpeculativeState,
  SPECULATIVE_CACHE,
  ACTIVE_CONTROLLERS,
  PIPELINE_VERSION,
  DraftCognitiveState,
  getEvictionScore
} from './speculative';
import { CognitiveTrace } from './types';

describe('Speculative Cognition Engine tests', () => {
  beforeEach(() => {
    SPECULATIVE_CACHE.clear();
    ACTIVE_CONTROLLERS.clear();
  });

  it('should compute Jaccard similarity correctly', () => {
    const s1 = 'I think I want to quit my job';
    const s2 = 'I think I want to quit my job because I am stressed';

    const sim = computeJaccardSimilarity(s1, s2);
    // s1 tokens: ['i', 'think', 'i', 'want', 'to', 'quit', 'my', 'job'] -> Set size = 7
    // s2 tokens: ['i', 'think', 'i', 'want', 'to', 'quit', 'my', 'job', 'because', 'i', 'am', 'stressed'] -> Set size = 10
    // Intersection size: 7
    // Union size: 10
    // Jaccard: 7 / 10 = 0.70
    expect(sim).toBeCloseTo(0.70, 2);

    expect(computeJaccardSimilarity('abc', 'abc')).toBe(1.0);
    expect(computeJaccardSimilarity('', 'abc')).toBe(0.0);
  });

  it('should evaluate prediction confidence and respect confidence gating', () => {
    // 1. Very short draft without punctuation
    const shortConf = evaluatePredictionConfidence('I think I');
    expect(shortConf).toBeLessThan(0.35); // Bypasses confidence gate (threshold 0.35)

    // 2. Longer thought ending with punctuation
    const longConf = evaluatePredictionConfidence('I want to quit my job.');
    expect(longConf).toBeGreaterThanOrEqual(0.35);

    // 3. Test caching filter
    const trace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general'
    };

    const lowState: DraftCognitiveState = {
      draft: 'Hi',
      normalizedDraft: 'hi',
      pipelineVersion: PIPELINE_VERSION,
      engineVersions: {},
      fingerprints: {},
      cognitiveTrace: trace,
      completedEngines: [],
      timestamp: Date.now(),
      predictionConfidence: shortConf
    };

    setSpeculativeState('draft_low', lowState);
    expect(SPECULATIVE_CACHE.has('draft_low')).toBe(false); // Low confidence not cached

    const highState: DraftCognitiveState = {
      draft: 'I need to make a decision.',
      normalizedDraft: 'i need to make a decision',
      pipelineVersion: PIPELINE_VERSION,
      engineVersions: {},
      fingerprints: {},
      cognitiveTrace: trace,
      completedEngines: [],
      timestamp: Date.now(),
      predictionConfidence: longConf
    };

    setSpeculativeState('draft_high', highState);
    expect(SPECULATIVE_CACHE.has('draft_high')).toBe(true); // Cached successfully
  });

  it('should resolve dependency-driven invalidations based on similarity scale', () => {
    // 1. Exact match
    const exact = resolveInvalidatedEngines('Hello world', 'Hello world.');
    expect(exact.has('NLU Engine')).toBe(false);
    expect(exact.has('Reflection Engine')).toBe(true);

    // 2. Minor change (Jaccard >= 0.90, length diff <= 15)
    const minor = resolveInvalidatedEngines(
      'go to the gym and work out hard now today',
      'go to the gym and work out hard now today and'
    );
    expect(minor.has('NLU Engine')).toBe(false);
    expect(minor.has('Cognitive Orchestrator')).toBe(true); // Orchestrator re-runs
    expect(minor.has('Reflection Engine')).toBe(true);

    // 3. Medium change (Jaccard >= 0.70)
    const medium = resolveInvalidatedEngines(
      'I think I should quit my job',
      'I think I should quit my job soon'
    );
    expect(medium.has('NLU Engine')).toBe(false);
    expect(medium.has('Emotion Engine')).toBe(true); // Emotion re-runs
    expect(medium.has('Cognitive Orchestrator')).toBe(true);

    // 4. Major change (Jaccard < 0.70)
    const major = resolveInvalidatedEngines('eating pizza', 'quit my job right now');
    expect(major.has('NLU Engine')).toBe(true);
    expect(major.has('Emotion Engine')).toBe(true);
  });

  it('should support hybrid priority LRU eviction', () => {
    const trace: CognitiveTrace = {
      state: 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general'
    };

    const now = Date.now();
    const entryLow: DraftCognitiveState = {
      draft: 'Short',
      normalizedDraft: 'short',
      pipelineVersion: PIPELINE_VERSION,
      engineVersions: {},
      fingerprints: {},
      cognitiveTrace: trace,
      completedEngines: [],
      timestamp: now - 10000, // old
      predictionConfidence: 0.4
    };

    const entryHigh: DraftCognitiveState = {
      draft: 'Very long draft that has a highly refined structure and details.',
      normalizedDraft: 'very long draft that has a highly refined structure and details',
      pipelineVersion: PIPELINE_VERSION,
      engineVersions: {},
      fingerprints: {},
      cognitiveTrace: trace,
      completedEngines: [],
      timestamp: now - 10000,
      predictionConfidence: 0.9
    };

    const scoreLow = getEvictionScore(entryLow, now);
    const scoreHigh = getEvictionScore(entryHigh, now);

    // Higher eviction score means more priority to evict first.
    expect(scoreLow).toBeGreaterThan(scoreHigh); // Low priority draft should evict first
  });

  it('should support AbortController cancellation for rapid edits', () => {
    const draftId = 'draft_abort_test';
    const controller1 = new AbortController();
    ACTIVE_CONTROLLERS.set(draftId, controller1);

    const controller2 = new AbortController();
    const prev = ACTIVE_CONTROLLERS.get(draftId);
    if (prev) {
      prev.abort();
    }
    ACTIVE_CONTROLLERS.set(draftId, controller2);

    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(false);
  });
});
