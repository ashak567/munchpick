import { describe, it, expect } from 'vitest';
import { StoryEngine } from './story';
import { CognitiveTrace, ContextPackage } from '../reflection/types';

describe('StoryEngine tests', () => {
  it('should detect goals and challenges with correct weighted confidence', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I decided to start learning programming but I struggle with procrastination',
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
      activeTopicKey: 'general'
    };

    const engine = new StoryEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyState).toBeDefined();
    expect(result.storyState?.activeGoals).toContain('learning programming');
    expect(result.storyState?.activeChallenges).toContain('procrastination');
    expect(result.storyState?.currentArc).toBe('Learning programming');
    expect(result.storyState?.arcStage).toBe('starting');

    // Confidence:
    // goal: "decided to ... learning programming" is explicit (contains "decided to") -> +0.5
    // challenge: "procrastination" in current message -> +0.3
    // total sum: 0.8
    expect(result.storyState?.confidence).toBeCloseTo(0.8, 1);
  });

  it('should detect identity signals from prefix statements', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I want to become a founder',
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
      activeTopicKey: 'general'
    };

    const engine = new StoryEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyState?.identitySignals).toContain('founder');
    expect(result.storyState?.confidence).toBeCloseTo(0.8, 1); // 0.3 (matching startup/founder keyword in current message) + 0.5 (explicit identity prefix) = 0.8
  });

  it('should progress arc stage based on user progress/completion keywords', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I pass my exam! I finally finished studying.',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [
        { sender: 'user', content: 'I am preparing exams' }
      ]
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
        currentArc: 'Preparing exams',
        arcStage: 'starting',
        activeGoals: ['preparing exams'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.5,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.storyState?.activeGoals).toContain('preparing exams');
    expect(result.storyState?.arcStage).toBe('completed');
  });

  it('should transition arc stage to transitioning on pivot keywords', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I think I will pivot and focus on getting fit instead',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [
        { sender: 'user', content: 'I am learning programming' }
      ]
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
        confidence: 0.6,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryEngine();
    const result = await engine.execute(initialTrace, context);

    // "getting fit" is detected in current turn, and user transitions
    expect(result.storyState?.activeGoals).toContain('getting fit');
    expect(result.storyState?.arcStage).toBe('transitioning');
  });

  it('should forget unmentioned goals and carry over active ones (decay logic)', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I worked on building startup today',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [
        // No mention of 'getting fit' in the last 10 messages
        { sender: 'user', content: 'working hard' },
        { sender: 'user', content: 'need to launch' }
      ]
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
        arcStage: 'developing',
        activeGoals: ['getting fit', 'building startup'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new StoryEngine();
    const result = await engine.execute(initialTrace, context);

    // 'building startup' is active and matches history/current turn
    expect(result.storyState?.activeGoals).toContain('building startup');
    // 'getting fit' decayed and is forgotten because it's not in the active turn or history window
    expect(result.storyState?.activeGoals).not.toContain('getting fit');
    expect(result.storyState?.currentArc).toBe('Building startup');
  });
});
