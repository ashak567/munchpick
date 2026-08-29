import { describe, it, expect } from 'vitest';
import { EmotionRegulationEngine } from './regulation';
import { MascotSpecialistEngine } from '../reflection/engine';
import { DecisionReadinessEngine } from '../reflection/readiness';
import { CognitiveTrace, ContextPackage } from '../reflection/types';

describe('Emotion Regulation Engine', () => {
  const engine = new EmotionRegulationEngine();

  const getBaseTrace = (): CognitiveTrace => ({
    state: 'Listening',
    emotions: [],
    reflections: [],
    readinessScore: 0,
    readinessThreshold: 0,
    mascotCharacter: 'munch',
    mascotExpression: 'idle',
    mascotReason: '',
    generatedPaths: [],
    confidence: 1.0,
    activeTopicKey: 'general'
  });

  const getBaseContext = (): ContextPackage => ({
    user_id: 'user_123',
    user_input: '',
    user_name: 'Friend',
    user_nickname: 'Friend',
    options: [],
    profile_beliefs: [],
    relevant_memories: [],
    decision_history: []
  });

  it('should map overwhelmed with high intensity to comfort style, slow pacing, break suggestion, and gate decision', async () => {
    const trace = getBaseTrace();
    trace.emotionalState = {
      primaryEmotion: 'overwhelmed',
      confidence: 0.85,
      intensity: 0.75,
      stability: 1.0,
      emotionalConsistency: 'stable',
      needsEmotionalValidation: true,
      evidence: []
    };

    const result = await engine.execute(trace, getBaseContext());

    expect(result.emotionalGuidance).toBeDefined();
    expect(result.emotionalGuidance?.responseStyle).toBe('comfort');
    expect(result.emotionalGuidance?.pacing).toBe('slow');
    expect(result.emotionalGuidance?.shouldSuggestBreak).toBe(true);
    expect(result.emotionalGuidance?.allowDecision).toBe(false);
    expect(result.emotionalGuidance?.urgency).toBe('medium'); // confidence not both >= 0.80 in intensity? wait, confidence = 0.85, intensity = 0.75 (intensity is < 0.80)
  });

  it('should map anxious with high intensity to ground response style and slow pacing', async () => {
    const trace = getBaseTrace();
    trace.emotionalState = {
      primaryEmotion: 'anxious',
      confidence: 0.9,
      intensity: 0.8,
      stability: 1.0,
      emotionalConsistency: 'stable',
      needsEmotionalValidation: true,
      evidence: []
    };

    const result = await engine.execute(trace, getBaseContext());

    expect(result.emotionalGuidance?.responseStyle).toBe('ground');
    expect(result.emotionalGuidance?.pacing).toBe('slow');
    expect(result.emotionalGuidance?.urgency).toBe('high'); // confidence 0.9 and intensity 0.8 are both >= 0.80
  });

  it('should map tired to encourage style and happy to celebrate style', async () => {
    const trace1 = getBaseTrace();
    trace1.emotionalState = {
      primaryEmotion: 'tired',
      confidence: 0.8,
      intensity: 0.5,
      stability: 1.0,
      emotionalConsistency: 'stable',
      needsEmotionalValidation: false,
      evidence: []
    };

    const result1 = await engine.execute(trace1, getBaseContext());
    expect(result1.emotionalGuidance?.responseStyle).toBe('encourage');
    expect(result1.emotionalGuidance?.allowDecision).toBe(true);

    const trace2 = getBaseTrace();
    trace2.emotionalState = {
      primaryEmotion: 'happy',
      confidence: 0.9,
      intensity: 0.7,
      stability: 1.0,
      emotionalConsistency: 'stable',
      needsEmotionalValidation: false,
      evidence: []
    };

    const result2 = await engine.execute(trace2, getBaseContext());
    expect(result2.emotionalGuidance?.responseStyle).toBe('celebrate');
    expect(result2.emotionalGuidance?.allowDecision).toBe(true);
  });

  it('should map uncertain to clarify response style, enable questions, and block decision', async () => {
    const trace = getBaseTrace();
    trace.emotionalState = {
      primaryEmotion: 'uncertain',
      confidence: 0.4,
      intensity: 0.3,
      stability: 1.0,
      emotionalConsistency: 'stable',
      needsEmotionalValidation: false,
      evidence: []
    };

    const result = await engine.execute(trace, getBaseContext());

    expect(result.emotionalGuidance?.responseStyle).toBe('clarify');
    expect(result.emotionalGuidance?.shouldAskQuestion).toBe(true);
    expect(result.emotionalGuidance?.allowDecision).toBe(false);
  });

  it('should trigger correct mascot character in MascotSpecialistEngine based on responseStyle', async () => {
    const mascotEngine = new MascotSpecialistEngine();

    const trace = getBaseTrace();
    delete (trace as any).mascotCharacter;
    trace.emotionalGuidance = {
      responseStyle: 'comfort',
      urgency: 'medium',
      pacing: 'slow',
      shouldAskQuestion: false,
      shouldSuggestBreak: false,
      allowDecision: true,
      evidence: []
    };

    const result = await mascotEngine.execute(trace, getBaseContext());
    expect(result.mascotCharacter).toBe('pandy'); // Pandy specializes in comfort
  });

  it('should block state transitions to Emerging Paths in DecisionReadinessEngine if allowDecision is false', async () => {
    const readinessEngine = new DecisionReadinessEngine();

    const trace = getBaseTrace();
    trace.state = 'Exploring';
    trace.generatedPaths = [
      { text: 'Pizza', tags: [] },
      { text: 'Salad', tags: [] }
    ];
    trace.emotionalGuidance = {
      responseStyle: 'comfort',
      urgency: 'high',
      pacing: 'slow',
      shouldAskQuestion: false,
      shouldSuggestBreak: true,
      allowDecision: false, // Block decision!
      evidence: []
    };

    // Construct context with high readiness observations
    const context = getBaseContext();
    context.observations = [
      {
        agent_name: 'NLU Agent',
        type: 'nlu',
        key: 'detected_category',
        value: 'Food',
        confidence: 0.9,
        reasoning: ''
      },
      {
        agent_name: 'NLU Agent',
        type: 'nlu',
        key: 'certainties',
        value: [{ certainty_level: 'absolute', confidence: 0.9 }],
        confidence: 0.9,
        reasoning: ''
      },
      {
        agent_name: 'NLU Agent',
        type: 'nlu',
        key: 'goals',
        value: [{ goal: 'eat pizza' }],
        confidence: 0.9,
        reasoning: ''
      },
      {
        agent_name: 'NLU Agent',
        type: 'nlu',
        key: 'readiness_signals',
        value: [{ readiness_state: 'ready_to_decide' }],
        confidence: 0.9,
        reasoning: ''
      }
    ];

    const result = await readinessEngine.execute(trace, context);

    // Readiness score should be high (>= 0.50 threshold for Food)
    expect(result.readinessScore).toBeGreaterThanOrEqual(result.readinessThreshold);
    // But since allowDecision is false, state must not advance to 'Emerging Paths'
    expect(result.state).not.toBe('Emerging Paths');
    expect(result.state).toBe('Exploring');
  });
});
