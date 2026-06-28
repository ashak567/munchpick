import { describe, it, expect } from 'vitest';
import { MemoryConsolidationEngine } from './memory';
import { ReflectionEngine } from '../reflection/engine';
import { CognitiveTrace, ContextPackage } from '../reflection/types';
import { ConsolidatedMemory } from './types';

describe('MemoryConsolidationEngine tests', () => {
  it('should create new memories from active goals and identity signals', async () => {
    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I am practicing piano today',
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
        currentArc: 'Learning piano',
        arcStage: 'developing',
        activeGoals: ['learning piano'],
        activeChallenges: [],
        identitySignals: ['musician'],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new MemoryConsolidationEngine();
    const result = await engine.execute(initialTrace, context);

    expect(result.memoryState).toBeDefined();
    const memories = result.memoryState?.memories || [];
    expect(memories.length).toBe(2);

    const goalMem = memories.find(m => m.category === 'goal');
    expect(goalMem?.title).toBe('Learning piano');
    expect(goalMem?.strength).toBe(0.5);

    const identityMem = memories.find(m => m.category === 'identity');
    expect(identityMem?.title).toBe('Identity: Musician');
  });

  it('should reinforce matching memories and promote to core memory', async () => {
    const previousMemory: ConsolidatedMemory = {
      id: 'mem_1',
      category: 'goal',
      title: 'Learning piano',
      summary: 'summary',
      strength: 0.6,
      stability: 0.7, // close to 0.8 core threshold
      confidence: 0.9,
      firstObserved: new Date().toISOString(),
      lastReinforced: new Date().toISOString(),
      reinforcementCount: 2, // close to 3 core threshold
      archived: false,
      evidence: []
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I played piano again',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousMemoryState: {
        memories: [previousMemory]
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
        currentArc: 'Learning piano',
        arcStage: 'developing',
        activeGoals: ['learning piano'],
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new MemoryConsolidationEngine();
    const result = await engine.execute(initialTrace, context);

    const memories = result.memoryState?.memories || [];
    expect(memories.length).toBe(1);
    
    const m = memories[0];
    expect(m.reinforcementCount).toBe(3);
    expect(m.strength).toBeCloseTo(0.75, 1); // 0.6 + 0.15 reinforcement
    expect(m.stability).toBeCloseTo(0.9, 1);  // 0.7 + 0.20 reinforcement
    expect(m.isCore).toBe(true); // Promoted to Core
  });

  it('should merge memories using lightweight title similarity', async () => {
    // "Programming Journey" and candidate "Learning programming" are similar
    const previousMemory: ConsolidatedMemory = {
      id: 'mem_1',
      category: 'goal',
      title: 'Programming Journey',
      summary: 'summary',
      strength: 0.5,
      stability: 0.1,
      confidence: 0.8,
      firstObserved: new Date().toISOString(),
      lastReinforced: new Date().toISOString(),
      reinforcementCount: 1,
      archived: false,
      evidence: []
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'coding habit progress',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousMemoryState: {
        memories: [previousMemory]
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
        activeGoals: ['learning programming'], // "learning programming" vs "Programming Journey" matches similarity
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new MemoryConsolidationEngine();
    const result = await engine.execute(initialTrace, context);

    const memories = result.memoryState?.memories || [];
    expect(memories.length).toBe(1); // Merged into 1 memory
    expect(memories[0].title).toBe('Programming Journey'); // Kept original title
    expect(memories[0].reinforcementCount).toBe(2);
  });

  it('should archive conflicting memories when story pivots', async () => {
    const oldGoal: ConsolidatedMemory = {
      id: 'mem_old',
      category: 'goal',
      title: 'Learning programming',
      summary: 'summary',
      strength: 0.8,
      stability: 0.5,
      confidence: 0.8,
      firstObserved: new Date().toISOString(),
      lastReinforced: new Date().toISOString(),
      reinforcementCount: 3,
      archived: false,
      evidence: []
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I pivot to fitness',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousMemoryState: {
        memories: [oldGoal]
      },
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
      storyProgress: {
        linkedArc: 'Getting fit',
        continuityStatus: 'pivoting',
        progressScore: 20,
        stagnationCount: 0,
        memoryPriority: 'medium',
        focusSuggestion: 'goal',
        storyShift: true,
        storyShiftReason: 'goal_change', // pivot detected!
        confidence: 0.9,
        evidence: []
      },
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

    const engine = new MemoryConsolidationEngine();
    const result = await engine.execute(initialTrace, context);

    const memories = result.memoryState?.memories || [];
    const oldMem = memories.find(m => m.id === 'mem_old');
    expect(oldMem?.archived).toBe(true); // old goal memory is archived due to pivot conflict
  });

  it('should decay inactive active memories and archive them if strength drops below 0.2', async () => {
    const oldActiveMemory: ConsolidatedMemory = {
      id: 'mem_1',
      category: 'goal',
      title: 'Learning programming',
      summary: 'summary',
      strength: 0.23, // close to 0.20 threshold
      stability: 0.1,
      confidence: 0.8,
      firstObserved: new Date().toISOString(),
      lastReinforced: new Date().toISOString(),
      reinforcementCount: 1,
      archived: false,
      evidence: []
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'working on piano instead',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousMemoryState: {
        memories: [oldActiveMemory]
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
        currentArc: 'Piano practice',
        arcStage: 'developing',
        activeGoals: ['playing piano'], // programming is inactive
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new MemoryConsolidationEngine();
    const result = await engine.execute(initialTrace, context);

    const memories = result.memoryState?.memories || [];
    const decMem = memories.find(m => m.id === 'mem_1');
    expect(decMem?.strength).toBeLessThan(0.20);
    expect(decMem?.archived).toBe(true); // archived after decay below 0.20
  });

  it('should reactivate archived memories and preserve history', async () => {
    const archivedMemory: ConsolidatedMemory = {
      id: 'mem_archived',
      category: 'goal',
      title: 'Learning programming',
      summary: 'summary',
      strength: 0.1,
      stability: 0.5,
      confidence: 0.8,
      firstObserved: '2026-06-01T00:00:00Z', // original observation timestamp
      lastReinforced: '2026-06-05T00:00:00Z',
      reinforcementCount: 4,
      archived: true, // currently archived
      evidence: ['Old coding sessions']
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'I resumed coding programming today',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousMemoryState: {
        memories: [archivedMemory]
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
        activeGoals: ['learning programming'], // reactivates the archived memory!
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new MemoryConsolidationEngine();
    const result = await engine.execute(initialTrace, context);

    const memories = result.memoryState?.memories || [];
    const m = memories[0];
    expect(m.archived).toBe(false); // Reactivated
    expect(m.strength).toBe(0.5); // Strength reset to 0.5
    expect(m.reinforcementCount).toBe(5); // Increment count
    expect(m.firstObserved).toBe('2026-06-01T00:00:00Z'); // Kept history
  });

  it('should enforce max active memories limit of 100', async () => {
    // Generate 101 active memories
    const activeMemories: ConsolidatedMemory[] = [];
    for (let i = 0; i < 101; i++) {
      activeMemories.push({
        id: `mem_${i}`,
        category: 'goal',
        title: `Goal_${i}`,
        summary: 'summary',
        strength: i === 0 ? 0.25 : 0.8, // Goal_0 has the lowest strength
        stability: 0.1,
        confidence: 0.8,
        firstObserved: new Date().toISOString(),
        lastReinforced: new Date().toISOString(),
        reinforcementCount: 1,
        archived: false,
        evidence: []
      });
    }

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'working on tasks',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: [],
      previousMemoryState: {
        memories: activeMemories
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
        currentArc: 'Goal_100',
        arcStage: 'developing',
        activeGoals: activeMemories.map(m => m.title.toLowerCase()), // all candidates reinforced
        activeChallenges: [],
        identitySignals: [],
        confidence: 0.8,
        evidence: [],
        events: []
      }
    };

    const engine = new MemoryConsolidationEngine();
    const result = await engine.execute(initialTrace, context);

    const memories = result.memoryState?.memories || [];
    const activeCount = memories.filter(m => !m.archived).length;
    expect(activeCount).toBe(100); // capped at 100

    const goal0 = memories.find(m => m.id === 'mem_0');
    expect(goal0?.archived).toBe(true); // low strength Goal_0 archived to enforce cap
  });

  it('should reflect commitment in ReflectionEngine if goal memory is reinforced', async () => {
    const reinforcedGoalMemory: ConsolidatedMemory = {
      id: 'mem_1',
      category: 'goal',
      title: 'Learning programming',
      summary: 'summary',
      strength: 0.8,
      stability: 0.5,
      confidence: 0.9,
      firstObserved: new Date().toISOString(),
      lastReinforced: new Date().toISOString(),
      reinforcementCount: 3,
      archived: false,
      evidence: []
    };

    const context: ContextPackage = {
      user_id: 'user_123',
      user_input: 'coding habit progress',
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
      memoryState: {
        memories: [reinforcedGoalMemory]
      }
    };

    const refEngine = new ReflectionEngine();
    const finalTrace = await refEngine.execute(trace, context);

    const commitmentReflection = finalTrace.reflections.find(r => r.reflection.includes("stayed committed"));
    expect(commitmentReflection).toBeDefined();
    expect(commitmentReflection?.observation).toContain('goal');
  });
});
