import { CognitiveEngine, CognitiveTrace, ContextPackage } from '../reflection/types';
import { StoryEvent, StoryInsight, StoryPattern, StoryState } from './types';

interface RuleDefinition<T extends string> {
  value: T;
  keywords: RegExp[];
}

const MOTIVATION_RULES: RuleDefinition<string>[] = [
  { value: 'achievement', keywords: [/\b(passed|won|completed|achieved|success|succeed|accomplish|launch|attained)\b/i] },
  { value: 'creativity', keywords: [/\b(build|code|coding|design|make|create|write|invent|program|craft)\b/i] },
  { value: 'learning', keywords: [/\b(learn|study|read|understand|figure out|knowledge|course|mastery)\b/i] },
  { value: 'helping others', keywords: [/\b(help|support|share|give|teach|coach|assist|mentor)\b/i] },
  { value: 'independence', keywords: [/\b(independent|freedom|myself|own|founder|startup|self-employed)\b/i] }
];

const VALUE_RULES: RuleDefinition<string>[] = [
  { value: 'discipline', keywords: [/\b(discipline|habit|routine|schedule|practice|daily|every day|focus)\b/i] },
  { value: 'growth', keywords: [/\b(grow|improve|better|learn|progress|develop|evolve)\b/i] },
  { value: 'curiosity', keywords: [/\b(curious|wonder|explore|why|how|research|ask|learn)\b/i] },
  { value: 'responsibility', keywords: [/\b(responsible|duty|obligation|accountable|promise|commit)\b/i] },
  { value: 'freedom', keywords: [/\b(free|choice|quit|leave|liberty|independent)\b/i] }
];

const FEAR_RULES: RuleDefinition<string>[] = [
  { value: 'failure', keywords: [/\b(fail|failure|messed up|screwed up|mistake|lose|lost|drop)\b/i] },
  { value: 'rejection', keywords: [/\b(reject|rejected|dislike|no one|abandoned|alone|criticism|criticize)\b/i] },
  { value: 'uncertainty', keywords: [/\b(unsure|confused|not sure|maybe|difficult to choose|what if|uncertain)\b/i] },
  { value: 'burnout', keywords: [/\b(tired|exhausted|burnout|overwhelmed|too much|stress|stressed|heavy)\b/i] }
];

const STRENGTH_RULES: RuleDefinition<string>[] = [
  { value: 'persistence', keywords: [/\b(keep going|don't give up|stay with it|hard work|try again|persevere|persistence)\b/i] },
  { value: 'creativity', keywords: [/\b(creative|ideas|design|innovative|solved|alternative)\b/i] },
  { value: 'resilience', keywords: [/\b(recover|bounce back|okay now|learned from|getting over|resilient|resilience)\b/i] },
  { value: 'curiosity', keywords: [/\b(curious|exploring|interested|wondering)\b/i] }
];

interface PatternRule {
  category: StoryPattern['category'];
  title: string;
  description: string;
  trigger: (trace: CognitiveTrace, context: ContextPackage, newEvents: StoryEvent[]) => boolean;
}

const PATTERN_RULES: PatternRule[] = [
  {
    category: 'habit',
    title: 'Initiates many paths',
    description: 'The user regularly starts new projects or goals.',
    trigger: (trace, context) => (trace.storyState?.activeGoals || []).length >= 2
  },
  {
    category: 'strength',
    title: 'Finishes goals consistently',
    description: 'The user has successfully finished projects and reached milestones.',
    trigger: (trace, context) => trace.storyState?.arcStage === 'completed'
  },
  {
    category: 'struggle',
    title: 'Frequently changes direction',
    description: 'The user regularly pivots to new focus areas.',
    trigger: (trace, context) => trace.storyProgress?.continuityStatus === 'pivoting'
  },
  {
    category: 'struggle',
    title: 'Repeatedly delays work',
    description: 'The user tends to procrastinate or get stuck on tasks.',
    trigger: (trace, context) => trace.storyProgress?.continuityStatus === 'stagnating'
  },
  {
    category: 'growth',
    title: 'Recovers quickly from setbacks',
    description: 'The user bounces back quickly after encountering obstacles or challenges.',
    trigger: (trace, context, newEvents) => {
      const hasSetback = (trace.storyState?.events || []).some(e => e.type === 'setback');
      const isImproving = trace.emotionDynamics?.emotionalMomentum === 'improving' || trace.storyProgress?.continuityStatus === 'progressing';
      return hasSetback && isImproving;
    }
  }
];

function calculatePatternConfidence(pattern: StoryPattern, trace: CognitiveTrace, context: ContextPackage, triggeredThisTurn: boolean): number {
  let score = 0.3; // base confidence
  
  if (pattern.occurrences > 1) {
    score += Math.min((pattern.occurrences - 1) * 0.20, 0.40);
  }

  const hasMilestones = (trace.storyState?.events || []).some(e => e.type === 'milestone');
  if (hasMilestones) score += 0.20;

  const userInput = context.user_input || '';
  const isExplicit = /\b(i decided|i realize|i am|i want|i will)\b/i.test(userInput);
  if (isExplicit && triggeredThisTurn) score += 0.30;

  const emotionalConsistency = trace.emotionalState?.emotionalConsistency === 'stable';
  if (emotionalConsistency) score += 0.20;

  if (trace.storyProgress?.continuityStatus === 'progressing') score += 0.10;

  return Math.max(0.0, Math.min(score, 1.0));
}

export class StoryIntelligenceEngine implements CognitiveEngine {
  public name = 'Story Intelligence Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const userInput = context.user_input || '';
    const previousInsight = context.previousStoryInsight as StoryInsight | undefined;
    const previousStory = context.previousStoryState as StoryState | undefined;
    const previousProgress = context.previousStoryProgress as any | undefined;

    // Detect new events in current turn
    const prevEventsList = previousStory?.events || [];
    const currEventsList = trace.storyState?.events || [];
    const newEvents = currEventsList.filter(e => !prevEventsList.some(pe => pe.id === e.id));

    // Initialize lists
    const recurringPatterns: StoryPattern[] = previousInsight ? [...previousInsight.recurringPatterns] : [];
    const dominantMotivationsSet = new Set<string>(previousInsight?.dominantMotivations || []);
    const dominantValuesSet = new Set<string>(previousInsight?.dominantValues || []);
    const recurringFearsSet = new Set<string>(previousInsight?.recurringFears || []);
    const personalStrengthsSet = new Set<string>(previousInsight?.personalStrengths || []);
    const growthAreasSet = new Set<string>(previousInsight?.growthAreas || []);

    const evidence: string[] = [];

    // 1. Detect Motivation, Values, Fears, Strengths matching keywords in userInput
    for (const rule of MOTIVATION_RULES) {
      if (rule.keywords.some(rx => rx.test(userInput))) {
        dominantMotivationsSet.add(rule.value);
        evidence.push(`Detected motivation signal: "${rule.value}"`);
      }
    }
    for (const rule of VALUE_RULES) {
      if (rule.keywords.some(rx => rx.test(userInput))) {
        dominantValuesSet.add(rule.value);
        evidence.push(`Detected value signal: "${rule.value}"`);
      }
    }
    for (const rule of FEAR_RULES) {
      if (rule.keywords.some(rx => rx.test(userInput))) {
        recurringFearsSet.add(rule.value);
        evidence.push(`Detected fear signal: "${rule.value}"`);
      }
    }
    for (const rule of STRENGTH_RULES) {
      if (rule.keywords.some(rx => rx.test(userInput))) {
        personalStrengthsSet.add(rule.value);
        evidence.push(`Detected strength signal: "${rule.value}"`);
      }
    }

    // 2. Evaluate Pattern Rules & Evolve/Decay
    const triggeredRuleTitles = new Set<string>();

    for (const rule of PATTERN_RULES) {
      const isTriggered = rule.trigger(trace, context, newEvents);
      if (isTriggered) {
        triggeredRuleTitles.add(rule.title);
        
        // Find existing pattern
        let patternIdx = recurringPatterns.findIndex(p => p.category === rule.category && p.title === rule.title);
        if (patternIdx !== -1) {
          const p = recurringPatterns[patternIdx];
          p.occurrences += 1;
          p.lastObserved = new Date().toISOString();
          p.active = true;
          p.confidence = calculatePatternConfidence(p, trace, context, true);
          p.evidence.push(`Re-occurred during turn with input: "${userInput}"`);
        } else {
          // Create new pattern
          const newPattern: StoryPattern = {
            id: `pattern_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            category: rule.category,
            title: rule.title,
            description: rule.description,
            occurrences: 1,
            confidence: 0.5,
            evidence: [`Initially observed with user input: "${userInput}"`],
            firstObserved: new Date().toISOString(),
            lastObserved: new Date().toISOString(),
            active: true
          };
          newPattern.confidence = calculatePatternConfidence(newPattern, trace, context, true);
          recurringPatterns.push(newPattern);
        }
      }
    }

    // Decay rules for patterns that did NOT trigger this turn
    for (const p of recurringPatterns) {
      if (!triggeredRuleTitles.has(p.title)) {
        p.confidence = Math.max(0.0, p.confidence - 0.05);
        if (p.confidence < 0.20) {
          p.active = false;
        }
      }
    }

    // 3. Growth Areas Identification
    // Growth triggers if stagnation resolves or progress is detected
    const resolvedStagnation = previousProgress?.continuityStatus === 'stagnating' && trace.storyProgress?.continuityStatus === 'progressing';
    if (resolvedStagnation) {
      growthAreasSet.add('overcoming procrastination');
      evidence.push('Growth identified: Resumed progress after stagnation');
    }
    const hasGrowthPattern = recurringPatterns.some(p => p.category === 'growth' && p.active);
    if (hasGrowthPattern) {
      growthAreasSet.add('resilience under setbacks');
    }

    // 4. Unresolved Story Threads Detection
    const unresolvedThreads: string[] = [];
    if (trace.storyState) {
      for (const goal of trace.storyState.activeGoals) {
        const isResolved = trace.storyState.events.some(
          e => e.type === 'milestone' && e.relatedArc === goal && trace.storyState?.arcStage === 'completed'
        );
        if (!isResolved) {
          unresolvedThreads.push(goal);
        }
      }
    }

    trace.storyInsight = {
      recurringPatterns,
      dominantMotivations: Array.from(dominantMotivationsSet),
      dominantValues: Array.from(dominantValuesSet),
      recurringFears: Array.from(recurringFearsSet),
      unresolvedThreads,
      personalStrengths: Array.from(personalStrengthsSet),
      growthAreas: Array.from(growthAreasSet),
      confidence: 0.85,
      evidence
    };

    return trace;
  }
}
