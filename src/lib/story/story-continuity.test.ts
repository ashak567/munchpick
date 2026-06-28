import { describe, it, expect } from 'vitest';
import { StoryProgressEngine } from './continuity';
import { ReflectionEngine } from '../reflection/engine';
import { CognitiveTrace, ContextPackage } from '../reflection/types';

describe('StoryProgressEngine tests', () => {
  it('should detect existing arc continuation and assign goals focus suggestion', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I am continuing with my coding goal',
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
        events: []
      }
    };

    const initialTrace: CognitiveTrace = {
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
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Learning programming',
        arcStage: 'developing',
        activeGoals: ['learning programming'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryProgressEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyProgress).toBeDefined();
    expect(result.storyProgress?.linkedArc).toBe('Learning programming');
    expect(result.storyProgress?.continuityStatus).toBe('continuing');
    expect(result.storyProgress?.focusSuggestion).toBe('goal');
    expect(result.storyProgress?.storyShift).toBe(false);
  });

  it('should detect pivots and classify correct storyShiftReason', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I decided to focus on getting fit and quit my startup',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousStoryState: {
        currentArc: 'Building startup',
        arcStage: 'developing',
        activeGoals: ['building startup'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const initialTrace: CognitiveTrace = {
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
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Getting fit',
        arcStage: 'starting',
        activeGoals: ['getting fit'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryProgressEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyProgress?.storyShift).toBe(true);
    expect(result.storyProgress?.storyShiftReason).toBe('goal_change');
    expect(result.storyProgress?.continuityStatus).toBe('pivoting');
  });

  it('should detect identity change pivots correctly', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I want to become a builder',
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

    const initialTrace: CognitiveTrace = {
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
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Building things',
        arcStage: 'developing',
        activeGoals: ['building things'],
        activeChallenges: [],
        identitySignals: ['builder'], // now has identity signal
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryProgressEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyProgress?.storyShift).toBe(true);
    expect(result.storyProgress?.storyShiftReason).toBe('identity_change');
  });

  it('should increment stagnationCount if challenges persist without progress and emotional momentum is not improving', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'Still struggling, did nothing today',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousStoryState: {
        currentArc: 'Learning programming',
        arcStage: 'developing',
        activeGoals: ['learning programming'],
        activeChallenges: ['procrastination'],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      },
      previousStoryProgress: {
        linkedArc: 'Learning programming',
        continuityStatus: 'continuing',
        progressScore: 20,
        stagnationCount: 2,
        memoryPriority: 'low',
        focusSuggestion: 'challenge',
        storyShift: false,
        storyShiftReason: null,
        confidence: 0.8,
        evidence: []
      }
    };

    const initialTrace: CognitiveTrace = {
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
      activeTopicKey: 'general',
      emotionDynamics: {
        emotionalMomentum: 'stable', // not improving
        volatility: 0.2,
        transitions: 1,
        emotionalRecovery: false,
        evidence: []
      },
      storyState: {
        currentArc: 'Learning programming',
        arcStage: 'developing',
        activeGoals: ['learning programming'],
        activeChallenges: ['procrastination'],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryProgressEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyProgress?.stagnationCount).toBe(3);
    expect(result.storyProgress?.continuityStatus).toBe('stagnating');
  });

  it('should NOT increment stagnation if emotional momentum is improving', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'Still trying to feel better',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousStoryState: {
        currentArc: 'Learning programming',
        arcStage: 'developing',
        activeGoals: ['learning programming'],
        activeChallenges: ['procrastination'],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      },
      previousStoryProgress: {
        linkedArc: 'Learning programming',
        continuityStatus: 'continuing',
        progressScore: 20,
        stagnationCount: 2,
        memoryPriority: 'low',
        focusSuggestion: 'challenge',
        storyShift: false,
        storyShiftReason: null,
        confidence: 0.8,
        evidence: []
      }
    };

    const initialTrace: CognitiveTrace = {
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
      activeTopicKey: 'general',
      emotionDynamics: {
        emotionalMomentum: 'improving', // improving momentum guard!
        volatility: 0.2,
        transitions: 1,
        emotionalRecovery: false,
        evidence: []
      },
      storyState: {
        currentArc: 'Learning programming',
        arcStage: 'developing',
        activeGoals: ['learning programming'],
        activeChallenges: ['procrastination'],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryProgressEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyProgress?.stagnationCount).toBe(0); // reset stagnation
    expect(result.storyProgress?.continuityStatus).not.toBe('stagnating');
  });

  it('should assign correct weighted progressScore', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'Completed study session!',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

    const initialTrace: CognitiveTrace = {
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
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'Learning programming',
        arcStage: 'developing', // 30
        activeGoals: ['learning programming'],
        activeChallenges: ['confusion'], // -10
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: [
          {
            id: 'e1',
            type: 'milestone', // +15
            title: 'Goal milestone',
            description: 'done',
            confidence: 0.9,
            relatedArc: 'Learning programming',
            createdAt: new Date().toISOString(),
            evidence: [],
            significant: true
          }
        ]
      }
    };

    const engine = new StoryProgressEngine();
    const result = await engine.execute(initialTrace, context);

    // Score: stage (30) + milestone (15) - challenge (10) = 35
    expect(result.storyProgress?.progressScore).toBe(35);
  });

  it('should assign critical memory priority for setbacks and keyword matches', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'Unfortunately I lost someone close to me today',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousStoryState: {
        currentArc: 'General',
        arcStage: 'developing',
        activeGoals: [],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const initialTrace: CognitiveTrace = {
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
      activeTopicKey: 'general',
      storyState: {
        currentArc: 'General',
        arcStage: 'developing',
        activeGoals: [],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: [
          {
            id: 'new_setback_event',
            type: 'setback',
            title: 'Setback: Lost someone',
            description: 'Unfortunately I lost someone close to me today',
            confidence: 0.9,
            relatedArc: 'General',
            createdAt: new Date().toISOString(),
            evidence: [],
            significant: true
          }
        ]
      }
    };

    const engine = new StoryProgressEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyProgress?.memoryPriority).toBe('critical');
  });

  it('should integrate story progress observations into ReflectionEngine reflections', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'Still circling around',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: []
    };

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
      activeTopicKey: 'general',
      storyProgress: {
        linkedArc: 'Learning programming',
        continuityStatus: 'stagnating',
        progressScore: 10,
        stagnationCount: 3,
        memoryPriority: 'low',
        focusSuggestion: 'challenge',
        storyShift: false,
        storyShiftReason: null,
        confidence: 0.9,
        evidence: []
      }
    };

    const refEngine = new ReflectionEngine();
    const finalTrace = await refEngine.execute(trace, context);

    const stagnationReflection = finalTrace.reflections.find(r => r.reflection.includes("circling around"));
    expect(stagnationReflection).toBeDefined();
    expect(stagnationReflection?.observation).toContain('stagnating');
  });
});
