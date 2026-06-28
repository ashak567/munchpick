import { CognitiveEngine, CognitiveTrace, ContextPackage } from '../reflection/types';
import { StoryEvent, StoryProgress, StoryState } from './types';

interface PriorityRule {
  priority: 'low' | 'medium' | 'high' | 'critical';
  eventTypes: string[];
  keywords?: RegExp[];
}

// Configurable Memory Priority Rules
const MEMORY_PRIORITY_RULES: PriorityRule[] = [
  {
    priority: 'critical',
    eventTypes: ['setback'],
    keywords: [/\b(lost someone|died|passed away|death|loss of|bereavement|grief)\b/i]
  },
  {
    priority: 'high',
    eventTypes: ['milestone'],
    keywords: [/\b(graduated|marathon|launched|got first job|wedding|married|engagement)\b/i]
  },
  {
    priority: 'medium',
    eventTypes: ['decision', 'realization', 'achievement']
  },
  {
    priority: 'low',
    eventTypes: ['progress', 'transition']
  }
];

interface FocusRule {
  focus: 'goal' | 'challenge' | 'identity' | 'milestone' | 'decision' | 'relationship';
  trigger: (trace: CognitiveTrace, context: ContextPackage, newEvents: StoryEvent[]) => boolean;
}

// Configurable Focus Priority Rules
const FOCUS_PRIORITY_RULES: FocusRule[] = [
  {
    focus: 'milestone',
    trigger: (trace, context, newEvents) => newEvents.some(e => e.type === 'milestone')
  },
  {
    focus: 'decision',
    trigger: (trace, context, newEvents) => newEvents.some(e => e.type === 'decision')
  },
  {
    focus: 'challenge',
    trigger: (trace, context, newEvents) => (trace.storyState?.activeChallenges || []).length > 0
  },
  {
    focus: 'identity',
    trigger: (trace, context, newEvents) => {
      const prevIdentities = (context.previousStoryState as StoryState | undefined)?.identitySignals || [];
      const currentIdentities = trace.storyState?.identitySignals || [];
      return currentIdentities.some(id => !prevIdentities.includes(id));
    }
  },
  {
    focus: 'relationship',
    trigger: (trace, context, newEvents) => {
      const userInput = context.user_input || '';
      return /\b(friend|partner|husband|wife|marry|married|dating|relationship|boyfriend|girlfriend|breakup)\b/i.test(userInput);
    }
  },
  {
    focus: 'goal',
    trigger: (trace, context, newEvents) => (trace.storyState?.activeGoals || []).length > 0
  }
];

export class StoryProgressEngine implements CognitiveEngine {
  public name = 'Story Progress Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const userInput = context.user_input || '';
    const previousStory = context.previousStoryState as StoryState | undefined;
    const previousProgress = context.previousStoryProgress as StoryProgress | undefined;

    const currentArc = trace.storyState?.currentArc || 'General Exploration';
    const previousArc = previousStory?.currentArc || 'General Exploration';

    const currentIdentities = trace.storyState?.identitySignals || [];
    const previousIdentities = previousStory?.identitySignals || [];

    // 1. Detect New Events on this turn
    const prevEvents = previousStory?.events || [];
    const currentEvents = trace.storyState?.events || [];
    const newEvents = currentEvents.filter(e => !prevEvents.some(pe => pe.id === e.id));

    // 2. Story Pivot & Shift Reason
    let storyShift = false;
    let storyShiftReason: string | null = null;

    if (previousStory && previousStory.currentArc !== trace.storyState?.currentArc) {
      storyShift = true;
      const hasNewIdentity = currentIdentities.some(id => !previousIdentities.includes(id));
      const hasRelationshipKeyword = /\b(friend|partner|husband|wife|marry|married|dating|relationship|boyfriend|girlfriend|breakup|divorce)\b/i.test(userInput);
      const hasJobSchoolKeyword = /\b(job|work|career|boss|hired|interview|school|study|college|university|exam|grade|graduation|graduated)\b/i.test(userInput);

      if (hasNewIdentity) {
        storyShiftReason = 'identity_change';
      } else if (hasRelationshipKeyword) {
        storyShiftReason = 'relationship_change';
      } else if (hasJobSchoolKeyword) {
        storyShiftReason = 'career';
      } else {
        storyShiftReason = 'goal_change';
      }
    }

    // 3. Stagnation Detection (with emotional momentum guard)
    let stagnationCount = previousProgress?.stagnationCount || 0;
    const activeChallenges = trace.storyState?.activeChallenges || [];
    const isImproving = trace.emotionDynamics?.emotionalMomentum === 'improving';
    const madeProgressThisTurn = newEvents.some(e => ['progress', 'achievement', 'milestone'].includes(e.type));

    if (activeChallenges.length > 0 && !isImproving && !madeProgressThisTurn) {
      stagnationCount += 1;
    } else {
      stagnationCount = 0;
    }

    const continuityStatus = trace.storyState?.arcStage === 'completed'
      ? 'completed'
      : storyShift
      ? 'pivoting'
      : stagnationCount >= 3
      ? 'stagnating'
      : madeProgressThisTurn
      ? 'progressing'
      : previousStory
      ? 'continuing'
      : 'new';

    // 4. Weighted Progress Score Calculation
    let stageScore = 10;
    const arcStage = trace.storyState?.arcStage || 'starting';
    if (arcStage === 'developing') stageScore = 30;
    if (arcStage === 'progressing') stageScore = 60;
    if (arcStage === 'completed') stageScore = 100;

    const milestoneCount = currentEvents.filter(e => e.type === 'milestone').length;
    const milestoneBonus = Math.min(milestoneCount * 15, 30);
    const challengePenalty = Math.min(activeChallenges.length * 10, 20);
    
    const hasSetbackThisTurn = newEvents.some(e => e.type === 'setback');
    const setbackPenalty = hasSetbackThisTurn ? 15 : 0;
    const pivotPenalty = storyShift ? 10 : 0;

    let progressScore = stageScore + milestoneBonus - challengePenalty - setbackPenalty - pivotPenalty;
    progressScore = Math.max(0, Math.min(progressScore, 100));

    // 5. Memory Priority Rule Check
    let memoryPriority: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };

    for (const event of newEvents) {
      let matchedPriority: 'low' | 'medium' | 'high' | 'critical' = 'low';
      for (const rule of MEMORY_PRIORITY_RULES) {
        const typeMatch = rule.eventTypes.includes(event.type);
        const keywordMatch = rule.keywords ? rule.keywords.some(rx => rx.test(event.description) || rx.test(event.title)) : false;
        
        if (keywordMatch) {
          matchedPriority = rule.priority;
          break;
        } else if (typeMatch) {
          if (priorityOrder[rule.priority] > priorityOrder[matchedPriority]) {
            matchedPriority = rule.priority;
          }
        }
      }
      if (priorityOrder[matchedPriority] > priorityOrder[memoryPriority]) {
        memoryPriority = matchedPriority;
      }
    }

    // 6. Focus Suggestion Rule Check
    let focusSuggestion: 'goal' | 'challenge' | 'identity' | 'milestone' | 'decision' | 'relationship' = 'goal';
    for (const rule of FOCUS_PRIORITY_RULES) {
      if (rule.trigger(trace, context, newEvents)) {
        focusSuggestion = rule.focus;
        break;
      }
    }

    // 7. Last Meaningful Turn Tracking
    const userMessages = context.chatHistory ? context.chatHistory.filter((m: any) => m.sender === 'user') : [];
    const currentTurnCount = userMessages.length;
    const hasMeaningfulChange = storyShift || newEvents.some(e => ['achievement', 'setback', 'decision', 'realization', 'milestone'].includes(e.type)) || trace.storyState?.arcStage !== previousStory?.arcStage;
    const lastMeaningfulTurn = hasMeaningfulChange ? currentTurnCount : previousProgress?.lastMeaningfulTurn || 0;

    // 8. Evidence and Confidence
    const evidence: string[] = [];
    if (storyShift) evidence.push(`Story pivot from "${previousArc}" to "${currentArc}" (reason: ${storyShiftReason})`);
    if (stagnationCount > 0) evidence.push(`Stagnant for ${stagnationCount} turns with active challenges: ${activeChallenges.join(', ')}`);
    if (newEvents.length > 0) evidence.push(`New event(s) detected: ${newEvents.map(e => e.type).join(', ')}`);

    trace.storyProgress = {
      linkedArc: currentArc,
      continuityStatus,
      progressScore,
      stagnationCount,
      memoryPriority,
      focusSuggestion,
      storyShift,
      storyShiftReason,
      confidence: 0.9,
      evidence,
      lastMeaningfulTurn
    };

    return trace;
  }
}
