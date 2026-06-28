import { CognitiveEngine, CognitiveTrace, ContextPackage } from '../reflection/types';
import { StoryState } from './types';

const GOAL_PATTERNS = [
  { key: 'getting fit', keywords: [/\b(fit|fitness|gym|workout|exercise|running|run|diet|lose weight)\b/i] },
  { key: 'learning programming', keywords: [/\b(programming|coding|code|programmer|javascript|python|typescript|learn to code)\b/i] },
  { key: 'building startup', keywords: [/\b(startup|mvp|product|launch|founder|build a product|building my startup)\b/i] },
  { key: 'preparing exams', keywords: [/\b(exam|exams|study|studying|midterm|final|test|prepare)\b/i] },
  { key: 'improving relationships', keywords: [/\b(relationship|relationships|partner|marriage|boyfriend|girlfriend|spouse|family)\b/i] },
  { key: 'finding career', keywords: [/\b(career|job|recruit|recruiter|interview|resign|quit|new role)\b/i] },
  { key: 'starting business', keywords: [/\b(business|start a business|side hustle|company|launch company)\b/i] }
];

const CHALLENGE_PATTERNS = [
  { key: 'procrastination', keywords: [/\b(procrastinat|procrastination|procrastinating|lazy|put off|delay)\b/i] },
  { key: 'fear', keywords: [/\b(fear|scared|afraid|anxious|panic|terrified|fail)\b/i] },
  { key: 'burnout', keywords: [/\b(burnout|exhausted|tired|drained|fatigue|overworked|burnt out)\b/i] },
  { key: 'lack of confidence', keywords: [/\b(confidence|self-doubt|not good enough|imposter|insecure)\b/i] },
  { key: 'confusion', keywords: [/\b(confus|confusion|lost|unsure|stuck|clarity)\b/i] },
  { key: 'time pressure', keywords: [/\b(time|busy|deadline|hectic|hurry|rushed|no time)\b/i] }
];

const IDENTITY_ROLES = ['builder', 'student', 'founder', 'developer', 'artist', 'leader', 'mentor'];

const IDENTITY_PREFIXES = [
  /i\s+want\s+to\s+become\s+(?:an?\s+)?([a-z0-9\-]+)/i,
  /i\s+am\s+(?:an?\s+)?([a-z0-9\-]+)/i,
  /i\s+want\s+people\s+to\s+see\s+me\s+as\s+(?:an?\s+)?([a-z0-9\-]+)/i
];

const GOAL_EXPLICIT_PREFIXES = /\b(my goal is to|i want to|i am trying to|i need to|i'm trying to|i decided to|focused on|focusing on|aiming to)\b/i;

const PROGRESS_KEYWORDS = /\b(progress|worked on|accomplished|achieved|made headway|did a lot|working on)\b/i;
const TRANSITION_KEYWORDS = /\b(pivot|change mind|change direction|instead|switching|instead of)\b/i;
const COMPLETION_KEYWORDS = /\b(finished|completed|passed|got the job|launched|all done|succeeded|made it)\b/i;

export class StoryEngine implements CognitiveEngine {
  public name = 'Story Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const userInput = context.user_input || '';
    const chatHistory = context.chatHistory || [];
    const previousStory = trace.storyState;

    const userMessages = chatHistory
      .filter((m: any) => m.sender === 'user')
      .map((m: any) => m.content);

    const activeGoalsSet = new Set<string>();
    const activeChallengesSet = new Set<string>();
    const identitySignalsSet = new Set<string>();
    const evidenceList: string[] = [];

    // Helper to calculate confidence for a specific item
    const calculateConfidenceForItem = (
      itemKey: string,
      currentText: string,
      historyTexts: string[],
      matchPatterns: { key: string; keywords: RegExp[] }[],
      isGoal = false
    ): { detected: boolean; confidence: number; isExplicit: boolean } => {
      let detected = false;
      let score = 0.0;
      let isExplicit = false;

      const pattern = matchPatterns.find(p => p.key === itemKey);
      if (!pattern) return { detected, confidence: 0, isExplicit };

      // Check current turn
      const inCurrent = pattern.keywords.some(kw => kw.test(currentText));
      if (inCurrent) {
        detected = true;
        if (isGoal && GOAL_EXPLICIT_PREFIXES.test(currentText)) {
          score += 0.5;
          isExplicit = true;
        } else {
          score += 0.3;
        }
      }

      // Check history (limit to last 10 messages context)
      const recentHistory = historyTexts.slice(-10);
      let historyMatches = 0;
      for (const hText of recentHistory) {
        if (pattern.keywords.some(kw => kw.test(hText))) {
          historyMatches++;
          detected = true;
        }
      }
      score += historyMatches * 0.1;

      return { detected, confidence: score, isExplicit };
    };

    // 1. Process Goals
    const detectedGoals: Array<{ goal: string; confidence: number; isExplicit: boolean }> = [];
    for (const pattern of GOAL_PATTERNS) {
      const result = calculateConfidenceForItem(
        pattern.key,
        userInput,
        userMessages,
        GOAL_PATTERNS,
        true
      );
      if (result.detected) {
        detectedGoals.push({
          goal: pattern.key,
          confidence: result.confidence,
          isExplicit: result.isExplicit
        });
      }
    }

    // 2. Process Challenges
    const detectedChallenges: Array<{ challenge: string; confidence: number }> = [];
    for (const pattern of CHALLENGE_PATTERNS) {
      const result = calculateConfidenceForItem(
        pattern.key,
        userInput,
        userMessages,
        CHALLENGE_PATTERNS,
        false
      );
      if (result.detected) {
        detectedChallenges.push({
          challenge: pattern.key,
          confidence: result.confidence
        });
      }
    }

    // 3. Process Identities
    // Parse current message
    for (const prefix of IDENTITY_PREFIXES) {
      const match = prefix.exec(userInput);
      if (match && match[1]) {
        const role = match[1].toLowerCase();
        if (IDENTITY_ROLES.includes(role)) {
          identitySignalsSet.add(role);
          evidenceList.push(`Explicit identity statement in current turn: "${userInput}"`);
        }
      }
    }

    // Parse history (last 10 messages)
    const recentHistory = userMessages.slice(-10);
    for (const hText of recentHistory) {
      for (const prefix of IDENTITY_PREFIXES) {
        const match = prefix.exec(hText);
        if (match && match[1]) {
          const role = match[1].toLowerCase();
          if (IDENTITY_ROLES.includes(role)) {
            identitySignalsSet.add(role);
          }
        }
      }
    }

    // Merge previous StoryState if available (carry-over and decay logic)
    if (previousStory) {
      // Check if previous goals are still present in history/current context.
      // If a goal is in previousStory but not in the active turn or history window, it decays (forgotten).
      for (const prevGoal of previousStory.activeGoals) {
        const stillInHistory = userMessages.slice(-10).some(hText =>
          GOAL_PATTERNS.find(p => p.key === prevGoal)?.keywords.some(kw => kw.test(hText))
        );
        const inCurrent = GOAL_PATTERNS.find(p => p.key === prevGoal)?.keywords.some(kw => kw.test(userInput));
        if (stillInHistory || inCurrent) {
          activeGoalsSet.add(prevGoal);
        }
      }

      for (const prevChallenge of previousStory.activeChallenges) {
        const stillInHistory = userMessages.slice(-10).some(hText =>
          CHALLENGE_PATTERNS.find(p => p.key === prevChallenge)?.keywords.some(kw => kw.test(hText))
        );
        const inCurrent = CHALLENGE_PATTERNS.find(p => p.key === prevChallenge)?.keywords.some(kw => kw.test(userInput));
        if (stillInHistory || inCurrent) {
          activeChallengesSet.add(prevChallenge);
        }
      }

      for (const prevId of previousStory.identitySignals) {
        const stillInHistory = userMessages.slice(-10).some(hText =>
          IDENTITY_PREFIXES.some(prefix => {
            const match = prefix.exec(hText);
            return match !== null && match[1]?.toLowerCase() === prevId;
          })
        );
        const inCurrent = IDENTITY_PREFIXES.some(prefix => {
          const match = prefix.exec(userInput);
          return match !== null && match[1]?.toLowerCase() === prevId;
        });
        if (stillInHistory || inCurrent) {
          identitySignalsSet.add(prevId);
        }
      }
    }

    // Add newly detected items to active sets
    detectedGoals.forEach(dg => activeGoalsSet.add(dg.goal));
    detectedChallenges.forEach(dc => activeChallengesSet.add(dc.challenge));

    // Compile goals evidence
    detectedGoals.forEach(dg => {
      evidenceList.push(`Goal detected: "${dg.goal}" (Confidence: ${dg.confidence.toFixed(2)})`);
    });

    detectedChallenges.forEach(dc => {
      evidenceList.push(`Challenge detected: "${dc.challenge}" (Confidence: ${dc.confidence.toFixed(2)})`);
    });

    // 4. Prioritize and determine Current Arc
    const activeGoals = Array.from(activeGoalsSet);
    const activeChallenges = Array.from(activeChallengesSet);
    const identitySignals = Array.from(identitySignalsSet);

    // Sort active goals by confidence (dominant goal is first)
    activeGoals.sort((a, b) => {
      const confA = detectedGoals.find(dg => dg.goal === a)?.confidence || 0.1;
      const confB = detectedGoals.find(dg => dg.goal === b)?.confidence || 0.1;
      return confB - confA;
    });

    let currentArc = 'General Exploration';
    if (activeGoals.length > 0) {
      // Capitalize first goal to represent current arc name
      const primaryGoal = activeGoals[0];
      currentArc = primaryGoal.charAt(0).toUpperCase() + primaryGoal.slice(1);
    }

    // 5. Determine Arc Stage
    let arcStage: StoryState['arcStage'] = 'starting';
    if (activeGoals.length > 0) {
      const primaryGoal = activeGoals[0];
      const goalPattern = GOAL_PATTERNS.find(p => p.key === primaryGoal);
      const isMentionedInCurrent = goalPattern ? goalPattern.keywords.some(kw => kw.test(userInput)) : false;

      // Check if mentioned in history prior to current turn
      const wasMentionedInHistory = userMessages.some(hText =>
        goalPattern ? goalPattern.keywords.some(kw => kw.test(hText)) : false
      );

      if (isMentionedInCurrent && COMPLETION_KEYWORDS.test(userInput)) {
        arcStage = 'completed';
      } else if (isMentionedInCurrent && TRANSITION_KEYWORDS.test(userInput)) {
        arcStage = 'transitioning';
      } else if (isMentionedInCurrent && PROGRESS_KEYWORDS.test(userInput)) {
        arcStage = 'progressing';
      } else if (isMentionedInCurrent && wasMentionedInHistory) {
        arcStage = 'developing';
      } else {
        arcStage = 'starting';
      }
    }

    // 6. Compute overall confidence score
    // Sum weights of all detected items and clamp to [0.0, 1.0]
    let totalConfidence = 0.0;
    detectedGoals.forEach(dg => {
      totalConfidence += dg.confidence;
    });
    detectedChallenges.forEach(dc => {
      totalConfidence += dc.confidence;
    });
    if (identitySignalsSet.size > 0) {
      // Add weight for identity signal evidence
      totalConfidence += 0.3 * identitySignalsSet.size;
    }

    // Clamp confidence
    const confidence = Math.min(1.0, Math.max(0.3, Number(totalConfidence.toFixed(2))));

    const storyState: StoryState = {
      currentArc,
      arcStage,
      activeGoals,
      activeChallenges,
      identitySignals,
      confidence,
      evidence: evidenceList,
      events: previousStory?.events || []
    };

    return {
      ...trace,
      storyState
    };
  }
}
