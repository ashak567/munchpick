import { CognitiveEngine, CognitiveTrace, ContextPackage, CognitiveDecision } from './types';

// Configurable Orchestration Rules
const ORCHESTRATOR_RULES = {
  weights: {
    emotion: 1.0,
    story: 1.0,
    memory: 1.0,
    reflection: 1.0
  },
  thresholds: {
    urgencyCritical: 0.8,
    urgencyHigh: 0.6,
    urgencyMedium: 0.3,
    cognitiveLoadHigh: 0.7,
    cognitiveLoadMedium: 0.4
  }
};

export class CognitiveOrchestratorEngine implements CognitiveEngine {
  public name = 'Cognitive Orchestrator';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    // 1. Calculate Individual Priorities
    
    // Emotional Priority
    let emotionalPriority = 0.1;
    const detected = trace.detectedEmotion;
    if (detected) {
      // Scale by intensity if available, or default to confidence
      const intensity = trace.emotionalState?.intensity ?? 0.6;
      emotionalPriority = intensity;
    }
    const currentEmotions = trace.emotions || [];
    if (currentEmotions.includes('sadness') || currentEmotions.includes('fear') || currentEmotions.includes('anger')) {
      emotionalPriority = Math.max(emotionalPriority, 0.7);
    }
    
    // Story Priority
    let storyPriority = 0.1;
    if (trace.storyState) {
      if (trace.storyProgress?.storyShift === true) {
        storyPriority = 0.9; // Pivot is critical
      } else if (trace.storyProgress?.continuityStatus === 'stagnating') {
        storyPriority = 0.7;
      } else if (trace.storyState.events.some(e => e.significant && e.type === 'achievement')) {
        storyPriority = 0.8; // Achievement is high priority
      } else if (trace.storyState.activeGoals.length > 0) {
        storyPriority = 0.5;
      }
    }

    // Memory Priority
    let memoryPriority = 0.1;
    if (trace.memoryState) {
      const activeMemories = trace.memoryState.memories.filter(m => !m.archived);
      if (activeMemories.some(m => m.isCore)) {
        memoryPriority = 0.8; // Core memory present and active
      } else if (activeMemories.some(m => m.reinforcementCount >= 2)) {
        memoryPriority = 0.6; // Reinforced memory
      } else if (activeMemories.length > 0) {
        memoryPriority = 0.4;
      }
    }

    // Reflection Priority
    let reflectionPriority = 0.1;
    const consecReflections = context.consecutiveReflectionCount || 0;
    if (consecReflections >= 2) {
      reflectionPriority = 0.8; // Impending reflection loop
    } else if (consecReflections >= 1) {
      reflectionPriority = 0.4;
    }

    // Apply weights
    const weightedEmotion = emotionalPriority * ORCHESTRATOR_RULES.weights.emotion;
    const weightedStory = storyPriority * ORCHESTRATOR_RULES.weights.story;
    const weightedMemory = memoryPriority * ORCHESTRATOR_RULES.weights.memory;
    const weightedReflection = reflectionPriority * ORCHESTRATOR_RULES.weights.reflection;

    // 2. Determine Urgency
    const maxPriority = Math.max(weightedEmotion, weightedStory, weightedMemory, weightedReflection);
    let urgency: CognitiveDecision['urgency'] = 'low';
    if (maxPriority >= ORCHESTRATOR_RULES.thresholds.urgencyCritical) {
      urgency = 'critical';
    } else if (maxPriority >= ORCHESTRATOR_RULES.thresholds.urgencyHigh) {
      urgency = 'high';
    } else if (maxPriority >= ORCHESTRATOR_RULES.thresholds.urgencyMedium) {
      urgency = 'medium';
    }

    // 3. Resolve Dominant Need & Reason
    let dominantNeed: CognitiveDecision['dominantNeed'] = 'listen';
    let dominantReason = 'Prioritizing active listening in calm context.';
    const supportingReasons: string[] = [];

    const scores = [
      { key: 'emotion', val: weightedEmotion },
      { key: 'story', val: weightedStory },
      { key: 'memory', val: weightedMemory },
      { key: 'reflection', val: weightedReflection }
    ];
    // Sort descending
    scores.sort((a, b) => b.val - a.val);
    const dominantCategory = scores[0].key;

    if (dominantCategory === 'emotion') {
      const isNegative = currentEmotions.some(e => ['sadness', 'fear', 'anger'].includes(e.toLowerCase()));
      const isPositive = currentEmotions.some(e => ['joy', 'excitement', 'happiness'].includes(e.toLowerCase()));

      if (isNegative) {
        dominantNeed = 'comfort';
        dominantReason = 'High negative emotional priority detected.';
      } else if (isPositive) {
        dominantNeed = 'celebrate';
        dominantReason = 'Positive emotional signals deserve celebration.';
      } else {
        dominantNeed = 'listen';
        dominantReason = 'Calm or neutral emotion priority detected.';
      }
    } else if (dominantCategory === 'story') {
      if (trace.storyProgress?.storyShift === true) {
        dominantNeed = 'guide';
        dominantReason = 'Story pivot requires guidance.';
      } else if (trace.storyProgress?.continuityStatus === 'stagnating') {
        dominantNeed = 'motivate';
        dominantReason = 'Story stagnation calls for motivation.';
      } else if (trace.storyState?.events.some(e => e.significant && e.type === 'achievement')) {
        dominantNeed = 'celebrate';
        dominantReason = 'Significant story milestone achieved.';
      } else {
        dominantNeed = 'explore';
        dominantReason = 'Exploring ongoing story progress.';
      }
    } else if (dominantCategory === 'memory') {
      dominantNeed = 'ground';
      dominantReason = 'Grounding conversation in long-term memories.';
    } else if (dominantCategory === 'reflection') {
      dominantNeed = 'explore';
      dominantReason = 'Transitioning topics to prevent reflection loop.';
    }

    // Populate supporting reasons
    if (weightedEmotion > 0.5) supportingReasons.push(`Strong emotional intensity (${weightedEmotion.toFixed(2)})`);
    if (weightedStory > 0.5) supportingReasons.push(`Active story progression detected (${weightedStory.toFixed(2)})`);
    if (weightedMemory > 0.5) supportingReasons.push(`Reinforced memories are active (${weightedMemory.toFixed(2)})`);
    if (weightedReflection > 0.5) supportingReasons.push(`High reflection loop prevention priority (${weightedReflection.toFixed(2)})`);

    // 4. Calculate Cognitive Load & Response Depth
    const goalsCount = trace.storyState?.activeGoals.length || 0;
    const memoriesCount = trace.memoryState?.memories.filter(m => !m.archived).length || 0;
    const threadsCount = trace.storyInsight?.unresolvedThreads.length || 0;
    const emotionsCount = trace.emotions.length || 0;
    const reflectionsCount = trace.reflections.length || 0;

    const cognitiveLoad = Math.min(
      1.0,
      goalsCount * 0.1 + memoriesCount * 0.05 + threadsCount * 0.1 + emotionsCount * 0.1 + reflectionsCount * 0.1
    );

    let responseDepth: CognitiveDecision['responseDepth'] = 'short';
    if (cognitiveLoad >= ORCHESTRATOR_RULES.thresholds.cognitiveLoadHigh) {
      responseDepth = 'deep';
    } else if (cognitiveLoad >= ORCHESTRATOR_RULES.thresholds.cognitiveLoadMedium) {
      responseDepth = 'medium';
    }

    // 5. Determine Strategic Action Flags
    const askQuestion = dominantNeed === 'explore' || (dominantNeed as string) === 'clarify' || dominantNeed === 'guide';
    const acknowledgeEmotion = weightedEmotion >= 0.5 || dominantNeed === 'comfort';
    const referenceMemory = weightedMemory >= 0.5 && memoriesCount > 0;
    const referenceStory = weightedStory >= 0.5 && goalsCount > 0;

    trace.cognitiveDecision = {
      dominantNeed,
      urgency,
      emotionalPriority,
      storyPriority,
      memoryPriority,
      reflectionPriority,
      confidence: trace.confidence || 0.8,
      dominantReason,
      supportingReasons,
      cognitiveLoad,
      responseDepth,
      askQuestion,
      acknowledgeEmotion,
      referenceMemory,
      referenceStory
    };

    return trace;
  }
}
