import { describe, it, expect } from 'vitest';
import { StoryEventsEngine } from './events';
import { StoryEngine } from './story';
import { CognitiveTrace, ContextPackage } from '../reflection/types';

describe('StoryEventsEngine tests', () => {
  it('should detect achievement events and promote to milestones', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I finally finished my exams!',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['happy'],
      detectedEmotion: {
        primaryEmotion: 'happy',
        confidence: 0.9,
        intensity: 0.8,
        evidence: []
      },
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Preparing exams',
        arcStage: 'developing',
        activeGoals: ['preparing exams'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryEventsEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyState?.events.length).toBe(1);
    const event = result.storyState?.events[0];
    expect(event?.title).toContain('I finally finished');
    expect(event?.type).toBe('milestone'); // achievement promoted to milestone
    expect(event?.significant).toBe(true);
    expect(event?.emotion).toBe('happy');
    expect(event?.relatedArc).toBe('Preparing exams');
    expect(event?.id).toBeDefined();
    expect(event?.id.startsWith('event_')).toBe(true);
  });

  it('should detect setbacks as significant events', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I failed to complete the prototype',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['sad'],
      detectedEmotion: {
        primaryEmotion: 'sad',
        confidence: 0.8,
        intensity: 0.7,
        evidence: []
      },
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Building startup',
        arcStage: 'developing',
        activeGoals: ['building startup'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.7,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryEventsEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyState?.events.length).toBe(1);
    const event = result.storyState?.events[0];
    expect(event?.type).toBe('setback');
    expect(event?.significant).toBe(true);
    expect(event?.emotion).toBe('sad');
  });

  it('should detect progress as non-significant events', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I worked on coding my website today',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['calm'],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Learning programming',
        arcStage: 'developing',
        activeGoals: ['learning programming'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.7,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryEventsEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyState?.events.length).toBe(1);
    const event = result.storyState?.events[0];
    expect(event?.type).toBe('progress');
    expect(event?.significant).toBe(false);
  });

  it('should detect realizations and identity changes as milestones', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I realized that I want to become a builder',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousStoryState: {
        currentArc: 'General Exploration',
        arcStage: 'starting',
        activeGoals: [],
        activeChallenges: [],
        identitySignals: [], // empty before
        confidence: 0.5,
        evidence: [],
        events: []
      }
    };

    // Run StoryEngine first to detect the identity change and update trace.storyState
    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['happy'],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyState: context.previousStoryState
    };

    const storyEngine = new StoryEngine();
    const traceAfterStory = await storyEngine.execute(initialTrace, context);

    // Run StoryEventsEngine
    const eventsEngine = new StoryEventsEngine();
    const finalTrace = await eventsEngine.execute(traceAfterStory, context);

    // Should detect Realization: "I realized" and Identity Shift: Builder
    expect(finalTrace.storyState?.events.length).toBe(2);

    const realizationEvent = finalTrace.storyState?.events.find(e => e.type === 'realization');
    expect(realizationEvent).toBeDefined();
    expect(realizationEvent?.significant).toBe(true);

    const identityEvent = finalTrace.storyState?.events.find(e => e.type === 'milestone');
    expect(identityEvent).toBeDefined();
    expect(identityEvent?.title).toBe('Identity Shift: Builder');
    expect(identityEvent?.significant).toBe(true);
  });

  it('should prevent duplicate events from being created', async () => {
    const previousEvent = {
      id: 'event_existing',
      type: 'achievement' as const,
      title: 'Achievement: I completed',
      description: 'I completed the task',
      confidence: 0.9,
      relatedArc: 'Learning programming',
      createdAt: new Date().toISOString(),
      evidence: [],
      significant: true,
      emotion: 'happy'
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I completed my exams today!',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousStoryState: {
        currentArc: 'Learning programming',
        arcStage: 'developing',
        activeGoals: ['learning programming'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: [previousEvent] // already has the event
      }
    };

    const initialTrace: CognitiveTrace = {
      state: 'Listening',
      emotions: ['happy'],
      reflections: [],
      readinessScore: 0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Learning programming',
        arcStage: 'developing',
        activeGoals: ['learning programming'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: [previousEvent]
      }
    };

    const engine = new StoryEventsEngine();
    const result = await engine.execute(initialTrace, context);

    // Duplicate achievement match: "i completed" has the same title and relatedArc.
    // However, the new matched event would be promoted to milestone since the input matches "i completed" (which has title "Achievement: I completed" under the default matched type, or milestone type).
    // Let's verify that duplicate protection skips it because title and relatedArc are identical.
    expect(result.storyState?.events.length).toBe(1);
  });
});
