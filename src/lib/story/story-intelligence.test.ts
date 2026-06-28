import { describe, it, expect } from 'vitest';
import { StoryIntelligenceEngine } from './intelligence';
import { ReflectionEngine } from '../reflection/engine';
import { CognitiveTrace, ContextPackage } from '../reflection/types';
import { StoryPattern } from './types';

describe('StoryIntelligenceEngine tests', () => {
  it('should detect motivations, values, fears, and strengths from user input keywords', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I decided to launch a new coding habit because I value discipline but fear failure',
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

    const engine = new StoryIntelligenceEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyInsight).toBeDefined();
    // Motivations: 'achievement' (launch), 'creativity' (coding)
    expect(result.storyInsight?.dominantMotivations).toContain('achievement');
    expect(result.storyInsight?.dominantMotivations).toContain('creativity');

    // Values: 'discipline'
    expect(result.storyInsight?.dominantValues).toContain('discipline');

    // Fears: 'failure'
    expect(result.storyInsight?.recurringFears).toContain('failure');
  });

  it('should detect recurring patterns, merge duplicates, and increment occurrences', async () => {
    const previousPattern: StoryPattern = {
      id: 'pattern_1',
      category: 'struggle',
      title: 'Repeatedly delays work',
      description: 'The user tends to procrastinate or get stuck on tasks.',
      occurrences: 2,
      confidence: 0.6,
      evidence: [],
      firstObserved: new Date().toISOString(),
      lastObserved: new Date().toISOString(),
      active: true
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'Still delay',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousStoryInsight: {
        recurringPatterns: [previousPattern],
        dominantMotivations: [],
        dominantValues: [],
        recurringFears: [],
        unresolvedThreads: [],
        personalStrengths: [],
        growthAreas: [],
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
      storyProgress: {
        linkedArc: 'General',
        continuityStatus: 'stagnating', // triggers "Repeatedly delays work" rule
        progressScore: 10,
        stagnationCount: 3,
        memoryPriority: 'low',
        focusSuggestion: 'challenge',
        storyShift: false,
        storyShiftReason: null,
        confidence: 0.9,
        evidence: []
      },
      storyState: {
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

    const engine = new StoryIntelligenceEngine();
    const result = await engine.execute(initialTrace, context);

    const patterns = result.storyInsight?.recurringPatterns;
    expect(patterns?.length).toBe(1);
    expect(patterns?.[0].occurrences).toBe(3);
    expect(patterns?.[0].confidence).toBeGreaterThan(0.6);
  });

  it('should decay inactive patterns and deactivate them when confidence drops below 0.2', async () => {
    const activePattern: StoryPattern = {
      id: 'pattern_1',
      category: 'struggle',
      title: 'Repeatedly delays work',
      description: 'procrastination',
      occurrences: 1,
      confidence: 0.23, // very close to 0.2
      evidence: [],
      firstObserved: new Date().toISOString(),
      lastObserved: new Date().toISOString(),
      active: true
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'Not procrastinating today',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousStoryInsight: {
        recurringPatterns: [activePattern],
        dominantMotivations: [],
        dominantValues: [],
        recurringFears: [],
        unresolvedThreads: [],
        personalStrengths: [],
        growthAreas: [],
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
      storyProgress: {
        linkedArc: 'General',
        continuityStatus: 'continuing', // does not trigger delays rule
        progressScore: 30,
        stagnationCount: 0,
        memoryPriority: 'low',
        focusSuggestion: 'goal',
        storyShift: false,
        storyShiftReason: null,
        confidence: 0.9,
        evidence: []
      },
      storyState: {
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

    const engine = new StoryIntelligenceEngine();
    const result = await engine.execute(initialTrace, context);

    const patterns = result.storyInsight?.recurringPatterns;
    expect(patterns?.[0].confidence).toBeLessThan(0.20);
    expect(patterns?.[0].active).toBe(false);
  });

  it('should identify unresolved story threads', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'ongoing project info',
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
        currentArc: 'Building startup',
        arcStage: 'developing',
        activeGoals: ['building startup'], // active goal
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: [] // no completion milestone
      }
    };

    const engine = new StoryIntelligenceEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyInsight?.unresolvedThreads).toContain('building startup');
  });

  it('should recognize resilience pattern and reflect it in ReflectionEngine', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'Bounced back successfully',
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
      storyInsight: {
        recurringPatterns: [
          {
            id: 'p1',
            category: 'growth',
            title: 'Recovers quickly from setbacks',
            description: 'bouncing back',
            occurrences: 2,
            confidence: 0.75, // high confidence resilience pattern
            evidence: [],
            firstObserved: new Date().toISOString(),
            lastObserved: new Date().toISOString(),
            active: true
          }
        ],
        dominantMotivations: [],
        dominantValues: [],
        recurringFears: [],
        unresolvedThreads: [],
        personalStrengths: [],
        growthAreas: [],
        confidence: 0.9,
        evidence: []
      }
    };

    const refEngine = new ReflectionEngine();
    const result = await refEngine.execute(initialTrace, context);

    const resilienceReflection = result.reflections.find(r => r.reflection.includes("keep moving forward"));
    expect(resilienceReflection).toBeDefined();
    expect(resilienceReflection?.observation).toContain('insight');
  });
});
