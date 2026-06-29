import {
  CognitiveEngine,
  CognitiveTrace,
  ContextPackage,
  ContextBlock,
  ContextAssembly,
  ContextCategory,
  ContextImportance,
  AssemblyMetrics,
  ProviderHints
} from './types';

/**
 * Priority Weights Configuration.
 * These weights range from 0.0 to 1.0.
 */
export const CONTEXT_PRIORITY_RULES: Record<ContextCategory, number> = {
  system: 1.0,
  planning: 1.0,
  personality: 0.82,
  emotion: 0.74,
  story: 0.63,
  memory: 0.58,
  reflection: 0.42,
  conversation: 0.31
};

/**
 * Stop words set to filter out during semantic Jaccard calculations.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'to', 'in', 'of', 'for', 'with', 'at', 'on',
  'i', 'you', 'he', 'she', 'they', 'we', 'it', 'this', 'that', 'these', 'those'
]);

/**
 * Heuristic token estimator.
 * Can be replaced by LLM-specific tokenizers in the future.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Normalization target for semantic item comparison.
 */
export interface NormalizedSemanticItem {
  text?: string;
  arc?: string;
  goal?: string;
  challenge?: string;
  milestone?: string;
}

/**
 * Extracts semantic fields from a record or string.
 */
export function extractSemanticItem(val: any): NormalizedSemanticItem {
  if (typeof val === 'string') {
    return { text: val };
  }
  const res: NormalizedSemanticItem = {};
  if (val && typeof val === 'object') {
    res.text = String(val.text || val.description || val.content || val.observation || val.reflection || val.message || '');
    res.arc = String(val.arc || val.linkedArc || val.storyArc || '');
    res.goal = String(val.goal || val.linkedGoal || '');
    res.challenge = String(val.challenge || '');
    res.milestone = String(val.milestone || '');
  }
  return res;
}

/**
 * Computes Jaccard similarity of two strings, filtering stop words.
 */
export function JaccardSimilarity(s1: string, s2: string): number {
  const norm1 = s1.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const norm2 = s2.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const tokens1 = norm1.split(' ').filter(t => t && !STOP_WORDS.has(t));
  const tokens2 = norm2.split(' ').filter(t => t && !STOP_WORDS.has(t));

  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Compares two items semantically.
 */
export function compareSemanticItems(item1: any, item2: any): number {
  const i1 = extractSemanticItem(item1);
  const i2 = extractSemanticItem(item2);

  let matchCount = 0;
  let totalSimilarity = 0.0;

  const fields: Array<keyof NormalizedSemanticItem> = ['text', 'arc', 'goal', 'challenge', 'milestone'];
  for (const field of fields) {
    const v1 = i1[field];
    const v2 = i2[field];
    if (v1 && v2) {
      totalSimilarity += JaccardSimilarity(v1, v2);
      matchCount++;
    }
  }

  if (matchCount === 0) {
    return JaccardSimilarity(JSON.stringify(item1), JSON.stringify(item2));
  }

  return totalSimilarity / matchCount;
}

/**
 * Helper to recursively search and extract array items from an object.
 */
function extractAllArrayItems(obj: any): any[] {
  const items: any[] = [];
  const recurse = (val: any) => {
    if (Array.isArray(val)) {
      val.forEach(item => {
        if (item) items.push(item);
      });
    } else if (val && typeof val === 'object') {
      Object.values(val).forEach(recurse);
    }
  };
  recurse(obj);
  return items;
}

/**
 * Evaluates semantic overlap between two blocks.
 */
export function checkBlockSemanticOverlap(b1: ContextBlock, b2: ContextBlock): boolean {
  const items1 = extractAllArrayItems(b1.content);
  const items2 = extractAllArrayItems(b2.content);

  for (const i1 of items1) {
    for (const i2 of items2) {
      if (compareSemanticItems(i1, i2) > 0.7) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Merges two blocks that share semantic overlap.
 */
export function mergeBlocks(b1: ContextBlock, b2: ContextBlock): ContextBlock {
  const mergedSourceIds = Array.from(new Set([...b1.sourceIds, ...b2.sourceIds]));
  const mergedContent = mergeContentDeduplicated(b1.content, b2.content);

  const category = b1.priority >= b2.priority ? b1.category : b2.category;
  const priority = Math.max(b1.priority, b2.priority);
  const required = b1.required || b2.required;

  // Resolve higher importance
  const importanceOrder: ContextImportance[] = ['low', 'medium', 'high', 'critical'];
  const idx1 = importanceOrder.indexOf(b1.importance);
  const idx2 = importanceOrder.indexOf(b2.importance);
  const importance = importanceOrder[Math.max(idx1, idx2)];

  return {
    id: b1.id.includes(b2.id) ? b1.id : `${b1.id}_merged_${b2.id}`,
    category,
    priority,
    importance,
    required,
    sourceIds: mergedSourceIds,
    content: mergedContent,
    estimatedTokens: 0 // Will recalculate later
  };
}

function mergeContentDeduplicated(c1: Record<string, any>, c2: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...c1 };

  for (const key of Object.keys(c2)) {
    if (key in merged) {
      const v1 = merged[key];
      const v2 = c2[key];

      if (Array.isArray(v1) && Array.isArray(v2)) {
        merged[key] = mergeArraysAndDeduplicate(v1, v2);
      } else if (v1 && typeof v1 === 'object' && v2 && typeof v2 === 'object') {
        merged[key] = mergeContentDeduplicated(v1, v2);
      } else if (typeof v1 === 'string' && typeof v2 === 'string') {
        merged[key] = v1.length >= v2.length ? v1 : v2;
      } else {
        merged[key] = v2;
      }
    } else {
      merged[key] = c2[key];
    }
  }

  return merged;
}

function mergeArraysAndDeduplicate(arr1: any[], arr2: any[]): any[] {
  const combined = [...arr1];
  for (const item2 of arr2) {
    let isDup = false;
    for (let i = 0; i < combined.length; i++) {
      const item1 = combined[i];
      if (compareSemanticItems(item1, item2) > 0.7) {
        isDup = true;
        const s1 = String(extractSemanticItem(item1).text || '');
        const s2 = String(extractSemanticItem(item2).text || '');
        if (s2.length > s1.length) {
          combined[i] = item2;
        }
        break;
      }
    }
    if (!isDup) {
      combined.push(item2);
    }
  }
  return combined;
}

/**
 * Context Assembly Engine.
 * Gathers, normalizes, deduplicates, prioritizes, and trims cognitive states.
 */
export class ContextAssemblyEngine implements CognitiveEngine {
  public name = 'Context Assembly Engine';

  /**
   * Deduce Generation Intent based on state and dominant needs.
   */
  private deduceGenerationIntent(trace: CognitiveTrace): string {
    const need = trace.cognitiveDecision?.dominantNeed;
    const state = trace.state;

    if (need === 'comfort') return 'comfort';
    if (need === 'celebrate') return 'celebration';
    if (need === 'guide') return 'guidance';
    if (need === 'clarify' || state === 'Clarifying' || state === 'Reflection') return 'reflection';
    if (need === 'explore') return 'brainstorming';

    if (state === 'Emerging Paths' || state === 'Choosing') return 'planning';
    if (state === 'Understanding') return 'problem_solving';

    return 'conversation';
  }

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const collectedBlocks: ContextBlock[] = [];

    // 1. Gather Response Plan (planning)
    if (trace.responsePlan && Object.keys(trace.responsePlan).length > 0) {
      collectedBlocks.push({
        id: 'response_plan',
        category: 'planning',
        priority: CONTEXT_PRIORITY_RULES.planning,
        importance: 'critical',
        required: true,
        sourceIds: ['response_planning_engine'],
        content: trace.responsePlan as any,
        estimatedTokens: 0
      });
    }

    // 2. Gather Cognitive Decision (planning)
    if (trace.cognitiveDecision && Object.keys(trace.cognitiveDecision).length > 0) {
      collectedBlocks.push({
        id: 'cognitive_decision',
        category: 'planning',
        priority: CONTEXT_PRIORITY_RULES.planning,
        importance: 'critical',
        required: true,
        sourceIds: ['cognitive_orchestrator'],
        content: trace.cognitiveDecision as any,
        estimatedTokens: 0
      });
    }

    // 3. Gather Personality Profile/Decision (personality)
    if (trace.personalityDecision && Object.keys(trace.personalityDecision).length > 0) {
      collectedBlocks.push({
        id: 'personality_decision',
        category: 'personality',
        priority: CONTEXT_PRIORITY_RULES.personality,
        importance: 'critical',
        required: true,
        sourceIds: ['personality_engine'],
        content: trace.personalityDecision as any,
        estimatedTokens: 0
      });
    }

    // 4. Gather Emotion Layer (emotion)
    const emotionContent: Record<string, any> = {};
    if (trace.emotions && trace.emotions.length > 0) emotionContent.emotions = trace.emotions;
    if (trace.detectedEmotion) emotionContent.detectedEmotion = trace.detectedEmotion;
    if (trace.emotionalState) emotionContent.emotionalState = trace.emotionalState;
    if (trace.emotionalGuidance) emotionContent.emotionalGuidance = trace.emotionalGuidance;
    if (trace.emotionDynamics) emotionContent.emotionDynamics = trace.emotionDynamics;

    if (Object.keys(emotionContent).length > 0) {
      collectedBlocks.push({
        id: 'emotion_state',
        category: 'emotion',
        priority: CONTEXT_PRIORITY_RULES.emotion,
        importance: 'high',
        required: false,
        sourceIds: ['emotion_engine', 'emotional_state_engine', 'emotion_regulation_engine', 'emotion_dynamics_engine'],
        content: emotionContent,
        estimatedTokens: 0
      });
    }

    // 5. Gather Story State (story)
    const storyContent: Record<string, any> = {};
    if (trace.storyState) storyContent.storyState = trace.storyState;
    if (trace.storyProgress) storyContent.storyProgress = trace.storyProgress;
    if (trace.storyInsight) storyContent.storyInsight = trace.storyInsight;

    if (Object.keys(storyContent).length > 0) {
      collectedBlocks.push({
        id: 'story_state',
        category: 'story',
        priority: CONTEXT_PRIORITY_RULES.story,
        importance: 'medium',
        required: false,
        sourceIds: ['story_engine', 'story_events_engine', 'story_progress_engine', 'story_intelligence_engine'],
        content: storyContent,
        estimatedTokens: 0
      });
    }

    // 6. Gather Memory Consolidation (memory)
    if (trace.memoryState && Object.keys(trace.memoryState).length > 0) {
      collectedBlocks.push({
        id: 'memory_state',
        category: 'memory',
        priority: CONTEXT_PRIORITY_RULES.memory,
        importance: 'medium',
        required: false,
        sourceIds: ['memory_consolidation_engine'],
        content: trace.memoryState as any,
        estimatedTokens: 0
      });
    }

    // 7. Gather Reflections (reflection)
    if (trace.reflections && trace.reflections.length > 0) {
      collectedBlocks.push({
        id: 'reflections',
        category: 'reflection',
        priority: CONTEXT_PRIORITY_RULES.reflection,
        importance: 'medium',
        required: false,
        sourceIds: ['reflection_engine'],
        content: { reflections: trace.reflections },
        estimatedTokens: 0
      });
    }

    // 8. Gather Conversation Metadata (conversation) - Avoid conversation dumping!
    const conversationContent: Record<string, any> = {
      userInput: context.user_input,
      activeTopicKey: trace.activeTopicKey,
      state: trace.state,
      readinessScore: trace.readinessScore,
      readinessThreshold: trace.readinessThreshold,
      generatedPaths: trace.generatedPaths || []
    };
    if (context.recent_context) {
      conversationContent.recentContext = context.recent_context;
    }

    collectedBlocks.push({
      id: 'conversation_metadata',
      category: 'conversation',
      priority: CONTEXT_PRIORITY_RULES.conversation,
      importance: 'medium',
      required: false,
      sourceIds: ['nlu_engine_plugin'],
      content: conversationContent,
      estimatedTokens: 0
    });

    // 9. Semantic Deduplication & Merging
    let deduplicatedBlocks: ContextBlock[] = [];
    let duplicateBlocksMerged = 0;

    for (const block of collectedBlocks) {
      let merged = false;
      for (let i = 0; i < deduplicatedBlocks.length; i++) {
        const existing = deduplicatedBlocks[i];
        
        // Prevent merging planning/personality decisions out
        if (existing.required && block.required && existing.id !== block.id) {
          continue;
        }

        if (checkBlockSemanticOverlap(existing, block)) {
          deduplicatedBlocks[i] = mergeBlocks(existing, block);
          duplicateBlocksMerged++;
          merged = true;
          break;
        }
      }
      if (!merged) {
        deduplicatedBlocks.push(block);
      }
    }

    // Calculate estimated tokens for each block
    deduplicatedBlocks.forEach(block => {
      block.estimatedTokens = estimateTokens(JSON.stringify(block.content));
    });

    // Sort by priority descending (highest weight first) to preserve deterministic order
    deduplicatedBlocks.sort((a, b) => b.priority - a.priority);

    // Save ordered assembly category list
    const assemblyOrder = deduplicatedBlocks.map(b => b.category);

    // 10. Smart Trimming based on Token Budget
    const tokenBudget = context.assemblyTokenBudget || 2000;
    let totalEstimatedTokens = deduplicatedBlocks.reduce((acc, b) => acc + b.estimatedTokens, 0);

    const trimmedBlocks: string[] = [];
    let skippedBlocks = 0;

    if (totalEstimatedTokens > tokenBudget) {
      // Divide into required/critical vs optional blocks
      const criticalBlocks = deduplicatedBlocks.filter(b => b.required || b.importance === 'critical');
      const optionalBlocks = deduplicatedBlocks.filter(b => !(b.required || b.importance === 'critical'));

      // Sort optional blocks by trimming score ascending (lowest priority & importance first)
      const getTrimmingScore = (block: ContextBlock): number => {
        const importanceWeights: Record<ContextImportance, number> = {
          low: 0,
          medium: 1,
          high: 2,
          critical: 3
        };
        return block.priority * 10 + importanceWeights[block.importance];
      };

      optionalBlocks.sort((a, b) => getTrimmingScore(a) - getTrimmingScore(b));

      const keptOptional: ContextBlock[] = [];
      let currentTotal = criticalBlocks.reduce((acc, b) => acc + b.estimatedTokens, 0);

      // Add back optionals starting from the highest trimming score until budget is filled
      optionalBlocks.reverse(); // Now highest score is first

      for (const opt of optionalBlocks) {
        if (currentTotal + opt.estimatedTokens <= tokenBudget) {
          keptOptional.push(opt);
          currentTotal += opt.estimatedTokens;
        } else {
          trimmedBlocks.push(opt.id);
        }
      }

      // Reassemble final list keeping the relative priority order
      const finalBlocks = [...criticalBlocks, ...keptOptional];
      finalBlocks.sort((a, b) => b.priority - a.priority);

      deduplicatedBlocks = finalBlocks;
      totalEstimatedTokens = currentTotal;
    }

    // 11. Upstream Confidence Aggregation (Conservative minimum)
    const confidences: number[] = [trace.confidence || 1.0];
    if (trace.detectedEmotion?.confidence !== undefined) confidences.push(trace.detectedEmotion.confidence);
    if (trace.emotionalState?.confidence !== undefined) confidences.push(trace.emotionalState.confidence);
    if (trace.storyInsight?.confidence !== undefined) confidences.push(trace.storyInsight.confidence);
    if (trace.cognitiveDecision?.confidence !== undefined) confidences.push(trace.cognitiveDecision.confidence);
    if (trace.personalityDecision?.confidence !== undefined) confidences.push(trace.personalityDecision.confidence);
    if (trace.responsePlan?.confidence !== undefined) confidences.push(trace.responsePlan.confidence);

    const aggregatedConfidence = Math.max(0.0, Math.min(1.0, Math.min(...confidences)));

    // 12. Assembly Validation & Degradation Status
    const requiredPlanningPresent = deduplicatedBlocks.some(b => b.category === 'planning');
    const requiredPersonalityPresent = deduplicatedBlocks.some(b => b.category === 'personality');
    const requiredOrchestratorPresent = deduplicatedBlocks.some(b => b.sourceIds.includes('cognitive_orchestrator'));

    const validationFailed = !requiredPlanningPresent || !requiredPersonalityPresent || !requiredOrchestratorPresent;
    let isIncomplete = false;

    if (validationFailed) {
      console.warn(
        `[ContextAssembly] Validation incomplete. Required elements missing: ` +
        `planning=${requiredPlanningPresent}, personality=${requiredPersonalityPresent}, orchestrator=${requiredOrchestratorPresent}`
      );
      isIncomplete = true;
    }

    // 13. Build final Assembly metrics and provider hints
    const assemblyMetrics: AssemblyMetrics = {
      totalBlocks: collectedBlocks.length,
      mergedBlocks: duplicateBlocksMerged,
      trimmedBlocks: trimmedBlocks.length,
      skippedBlocks,
      estimatedTokens: totalEstimatedTokens
    };

    const providerHints: ProviderHints = {
      supportsStreaming: true,
      supportsVision: false,
      supportsReasoning: false
    };

    const assembly: ContextAssembly = {
      blocks: deduplicatedBlocks,
      totalEstimatedTokens,
      trimmedBlocks,
      duplicateBlocksMerged,
      confidence: aggregatedConfidence,
      pipelineVersion: 'v1.4.0',
      assemblyOrder,
      isIncomplete,
      generationIntent: this.deduceGenerationIntent(trace),
      assemblyMetrics,
      providerHints
    };

    return {
      ...trace,
      contextAssembly: assembly
    };
  }
}
