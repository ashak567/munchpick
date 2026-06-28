import { CognitiveEngine, CognitiveTrace, ContextPackage } from '../reflection/types';
import { StoryEvent, StoryState } from './types';

// Deterministic Event Patterns
const EVENT_PATTERNS = [
  {
    type: 'achievement' as const,
    keywords: [/\b(i passed|i got selected|i finally finished|i completed|i won|i achieved)\b/i]
  },
  {
    type: 'progress' as const,
    keywords: [/\b(i started|i worked on|i improved|i practiced|i built|i deployed)\b/i]
  },
  {
    type: 'setback' as const,
    keywords: [/\b(i failed|i lost|i couldn't|i couldn’t|i gave up|i messed up|i got rejected)\b/i]
  },
  {
    type: 'decision' as const,
    keywords: [/\b(i've decided|i’ve decided|i decided|i will|i won't|i won’t|i chose|i am going to|i'm going to|i’m going to)\b/i]
  },
  {
    type: 'realization' as const,
    keywords: [/\b(i realized|i understood|i figured out|now i know|i learned)\b/i]
  },
  {
    type: 'transition' as const,
    keywords: [/\b(i'm moving|i’m moving|i'm changing|i’m changing|switching|leaving|starting over|pivot)\b/i]
  }
];

function getEventTitle(type: string, matchedKeyword: string): string {
  const capKeyword = matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1);
  switch (type) {
    case 'achievement': return `Achievement: ${capKeyword}`;
    case 'progress': return `Progress: ${capKeyword}`;
    case 'setback': return `Setback: ${capKeyword}`;
    case 'decision': return `Decision: ${capKeyword}`;
    case 'realization': return `Realization: ${capKeyword}`;
    case 'transition': return `Transition: ${capKeyword}`;
    default: return `Narrative Event: ${capKeyword}`;
  }
}

export class StoryEventsEngine implements CognitiveEngine {
  public name = 'Story Events Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const userInput = context.user_input || '';
    const previousStory = context.previousStoryState as StoryState | undefined;
    const existingEvents = previousStory?.events || [];
    const newEvents: StoryEvent[] = [];

    const activeArc = trace.storyState?.currentArc || 'General Exploration';
    const activeEmotion = trace.detectedEmotion?.primaryEmotion || trace.emotions[0] || 'calm';

    // 1. Detect New Events based on current userInput keywords
    let matchedEvent: StoryEvent | null = null;
    for (const pattern of EVENT_PATTERNS) {
      for (const rx of pattern.keywords) {
        const match = rx.exec(userInput);
        if (match) {
          const matchedKeyword = match[0].toLowerCase();
          
          // Determine significance
          const significant = ['achievement', 'setback', 'decision', 'realization'].includes(pattern.type);
          
          const eventTitle = getEventTitle(pattern.type, matchedKeyword);

          matchedEvent = {
            id: `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`, // unique fallback ID format
            type: pattern.type,
            title: eventTitle,
            description: userInput.trim(),
            confidence: 0.9,
            relatedArc: activeArc,
            createdAt: new Date().toISOString(),
            evidence: [`Keyword match "${matchedKeyword}" in user input`],
            significant,
            emotion: activeEmotion
          };
          break;
        }
      }
      if (matchedEvent) break;
    }

    // 2. Identity Change Milestone Detection
    // Check if a new identity signal was added in the trace
    const previousIdentities = previousStory?.identitySignals || [];
    const currentIdentities = trace.storyState?.identitySignals || [];
    const newIdentities = currentIdentities.filter(id => !previousIdentities.includes(id));

    if (newIdentities.length > 0) {
      const newIdentity = newIdentities[0];
      const capIdentity = newIdentity.charAt(0).toUpperCase() + newIdentity.slice(1);
      
      const identityEvent: StoryEvent = {
        id: `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: 'milestone',
        title: `Identity Shift: ${capIdentity}`,
        description: `User identified as a ${newIdentity}: "${userInput}"`,
        confidence: 0.9,
        relatedArc: activeArc,
        createdAt: new Date().toISOString(),
        evidence: [`New identity signal detected: ${newIdentity}`],
        significant: true,
        emotion: activeEmotion
      };

      newEvents.push(identityEvent);
    }

    // 3. Milestone Promotion for detected events
    if (matchedEvent) {
      const isCompletedStage = trace.storyState?.arcStage === 'completed';
      const isAchievement = matchedEvent.type === 'achievement';
      
      if (isCompletedStage || isAchievement) {
        matchedEvent.type = 'milestone';
        matchedEvent.significant = true;
      }
      newEvents.push(matchedEvent);
    }

    // 4. Duplicate Protection
    const uniqueNewEvents: StoryEvent[] = [];
    for (const newEvent of newEvents) {
      const isDuplicate = existingEvents.some(
        (e: any) =>
          e.title === newEvent.title &&
          (e.type === newEvent.type || (newEvent.type === 'milestone' && e.type === 'achievement') || (newEvent.type === 'achievement' && e.type === 'milestone')) &&
          e.relatedArc === newEvent.relatedArc
      );
      if (!isDuplicate) {
        uniqueNewEvents.push(newEvent);
      }
    }

    // 5. Update timeline on StoryState
    if (trace.storyState) {
      trace.storyState.events = [
        ...existingEvents,
        ...uniqueNewEvents
      ];
    }

    return trace;
  }
}
