import { MascotCharacter } from '../mascots/registry';
import { MASCOT_SELF_IDENTITIES, detectSelfReference } from '../mascots/self-identity';

export type TableEventType =
  | 'USER_MESSAGE'
  | 'CHARACTER_SPEAK'
  | 'CHARACTER_INTERRUPT'
  | 'CHARACTER_REACT'
  | 'CHARACTER_AGREE'
  | 'CHARACTER_DISAGREE'
  | 'CHARACTER_TEASE'
  | 'CHARACTER_ROAST'
  | 'CHARACTER_SILENCE'
  | 'DISCUSSION_END';

export type CharacterVisualState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'reacting'
  | 'interrupted'
  | 'surprised'
  | 'amused';

export type SocialReactionKind =
  | 'nod'
  | 'smile'
  | 'look_at_speaker'
  | 'surprised'
  | 'laugh'
  | 'eye_roll'
  | 'agree'
  | 'disagree'
  | 'cheer';

export type TurnIntent =
  | 'lead_response'
  | 'agree_build'
  | 'disagree_reframe'
  | 'playful_tease'
  | 'playful_roast'
  | 'protective_intervene'
  | 'de_escalate'
  | 'conclude_settle'
  | 'silent';

export interface PlannedCharacterTurn {
  characterId: MascotCharacter;
  intent: TurnIntent;
  targetCharacterId?: MascotCharacter | 'user';
  isInterruption: boolean;
  interruptReason?: string;
  interruptPriority: number; // 0.0 to 1.0
  promptGuidance: string;
}

export interface CharacterReactionEvent {
  characterId: MascotCharacter;
  reaction: SocialReactionKind;
  targetSpeakerId: MascotCharacter | 'user';
  intensity: number; // 0.1 to 1.0
  thoughtSnippet?: string;
}

export interface TableMessage {
  id: string;
  senderId: MascotCharacter | 'user';
  senderName: string;
  content: string;
  eventType: TableEventType;
  intent?: TurnIntent;
  targetSpeakerId?: MascotCharacter | 'user';
  interruptedSpeakerId?: MascotCharacter;
  reactions?: CharacterReactionEvent[];
  timestamp: number;
}

export interface TableSessionState {
  activeSpeakerId: MascotCharacter | 'user' | null;
  interruptedSpeakerId: MascotCharacter | null;
  speakingStartTime: number | null;
  characterStates: Record<MascotCharacter, CharacterVisualState>;
  characterReactions: Record<MascotCharacter, SocialReactionKind | null>;
  messages: TableMessage[];
  currentTopic: string;
  isProcessing: boolean;
}

export const ALL_TABLE_CHARACTERS: MascotCharacter[] = [
  'munch',
  'ollie',
  'ellie',
  'pandy',
  'dobby',
  'coco',
  'froggy',
  'bubbles',
  'chicky'
];

/**
 * Canonical dynamic relationships and conversational friction between characters.
 */
export const CHARACTER_DYNAMICS: Record<
  MascotCharacter,
  {
    teaseTargets: MascotCharacter[];
    frequentPartners: MascotCharacter[];
    contrastTriggers: { condition: (text: string) => boolean; target: MascotCharacter; reason: string }[];
  }
> = {
  munch: {
    teaseTargets: ['dobby'],
    frequentPartners: ['ollie', 'ellie'],
    contrastTriggers: []
  },
  dobby: {
    teaseTargets: ['pandy', 'ollie'],
    frequentPartners: ['chicky', 'munch'],
    contrastTriggers: [
      {
        condition: (text) => /tired|nap|slow|wait|tomorrow|rest/i.test(text),
        target: 'pandy',
        reason: 'Dobby gets impatient with excessive rest and wants immediate momentum.'
      }
    ]
  },
  pandy: {
    teaseTargets: ['dobby'],
    frequentPartners: ['froggy', 'ellie'],
    contrastTriggers: [
      {
        condition: (text) => /fast|now|rush|hurry|crush|momentum/i.test(text),
        target: 'dobby',
        reason: 'Pandy wants to protect the user from burnout and slow down Dobby.'
      }
    ]
  },
  ollie: {
    teaseTargets: ['dobby', 'coco'],
    frequentPartners: ['munch', 'ellie'],
    contrastTriggers: [
      {
        condition: (text) => /just do it|no thinking|blind|easy/i.test(text),
        target: 'dobby',
        reason: 'Ollie demands analyzing the underlying problem before blindly acting.'
      }
    ]
  },
  coco: {
    teaseTargets: ['ollie', 'dobby'],
    frequentPartners: ['bubbles', 'munch'],
    contrastTriggers: [
      {
        condition: (text) => /analysis|theoretically|perspective|angles/i.test(text),
        target: 'ollie',
        reason: 'Coco playfully mocks Ollie when he gets too academic or wordy.'
      }
    ]
  },
  ellie: {
    teaseTargets: [],
    frequentPartners: ['munch', 'pandy'],
    contrastTriggers: [
      {
        condition: (text) => /failure|mistake|hopeless|worthless|stress/i.test(text),
        target: 'munch',
        reason: 'Ellie urgently steps in to protect the user from self-blame.'
      }
    ]
  },
  froggy: {
    teaseTargets: ['dobby'],
    frequentPartners: ['pandy', 'bubbles'],
    contrastTriggers: [
      {
        condition: (text) => /panic|chaos|overload|screaming/i.test(text),
        target: 'munch',
        reason: 'Froggy provides a grounding breath to de-escalate group tension.'
      }
    ]
  },
  bubbles: {
    teaseTargets: ['ollie'],
    frequentPartners: ['coco', 'froggy'],
    contrastTriggers: []
  },
  chicky: {
    teaseTargets: ['pandy'],
    frequentPartners: ['dobby', 'munch'],
    contrastTriggers: [
      {
        condition: (text) => /win|did it|progress|milestone|fixed/i.test(text),
        target: 'munch',
        reason: 'Chicky cannot contain excitement and bursts in to celebrate.'
      }
    ]
  }
};

/**
 * Initializes clean state for all 9 seated characters around the table.
 */
export function createInitialTableState(initialTopic: string = 'Welcome to the Munch Table!'): TableSessionState {
  const characterStates: Record<MascotCharacter, CharacterVisualState> = {
    munch: 'idle',
    ollie: 'idle',
    ellie: 'idle',
    pandy: 'idle',
    dobby: 'idle',
    coco: 'idle',
    froggy: 'idle',
    bubbles: 'idle',
    chicky: 'idle'
  };

  const characterReactions: Record<MascotCharacter, SocialReactionKind | null> = {
    munch: null,
    ollie: null,
    ellie: null,
    pandy: null,
    dobby: null,
    coco: null,
    froggy: null,
    bubbles: null,
    chicky: null
  };

  return {
    activeSpeakerId: null,
    interruptedSpeakerId: null,
    speakingStartTime: null,
    characterStates,
    characterReactions,
    messages: [
      {
        id: 'msg-intro',
        senderId: 'munch',
        senderName: 'Munch',
        content: 'Welcome to the circle! Everyone is here at the table with you. What’s on your mind today?',
        eventType: 'CHARACTER_SPEAK',
        intent: 'lead_response',
        timestamp: Date.now()
      }
    ],
    currentTopic: initialTopic,
    isProcessing: false
  };
}

/**
 * Structured Participation Planner:
 * Evaluates the user input and determines exactly 1–3 active characters, their specific turn intent,
 * whether an interruption should occur, and instructions for how they engage with prior speakers.
 */
export function planGroupDiscussionTurns(
  userMessage: string,
  history: Array<{ senderId: string; content: string }> = []
): PlannedCharacterTurn[] {
  const textLower = (userMessage || '').toLowerCase();
  const turns: PlannedCharacterTurn[] = [];

  // Track recent speakers to ensure diverse table participation
  const recentSpeakerCounts: Record<MascotCharacter, number> = {
    munch: 0, ollie: 0, ellie: 0, pandy: 0, dobby: 0, coco: 0, froggy: 0, bubbles: 0, chicky: 0
  };
  for (const h of history.slice(-10)) {
    if (h.senderId && h.senderId in recentSpeakerCounts) {
      recentSpeakerCounts[h.senderId as MascotCharacter]++;
    }
  }

  // 1. Identify direct mascot name mention or self-reference
  let leadSpeaker: MascotCharacter | null = null;

  for (const char of ALL_TABLE_CHARACTERS) {
    const identity = MASCOT_SELF_IDENTITIES[char];
    const nameRegex = new RegExp(`\\b(?:${identity.displayName.toLowerCase()}|${identity.id}|${identity.aliases.map(a => a.toLowerCase()).join('|')})\\b`, 'i');
    if (nameRegex.test(textLower)) {
      leadSpeaker = char;
      break;
    }
    const selfRef = detectSelfReference(userMessage, char, history.map(h => ({ role: h.senderId === 'user' ? 'user' : 'assistant', content: h.content })));
    if (selfRef.isSelfReference) {
      leadSpeaker = char;
      break;
    }
  }

  // 2. If no direct name mention, detect by topic keywords
  if (!leadSpeaker) {
    if (/\b(?:tired|exhausted|burnout|rest|sleep|slow down|relax|nap)\b/i.test(textLower)) {
      leadSpeaker = 'pandy';
    } else if (/\b(?:start|action|motivate|let's go|win|push|stuck|momentum|build|difficult)\b/i.test(textLower)) {
      leadSpeaker = 'dobby';
    } else if (/\b(?:why|how|analyze|think|curious|perspective|reason|logic|angle)\b/i.test(textLower)) {
      leadSpeaker = 'ollie';
    } else if (/\b(?:anxious|scared|fear|overwhelmed|worry|safe|comfort|panic|protect)\b/i.test(textLower)) {
      leadSpeaker = 'ellie';
    } else if (/\b(?:fun|creative|play|joke|kitty|idea|weird|different|game)\b/i.test(textLower)) {
      leadSpeaker = 'coco';
    } else if (/\b(?:breathe|calm|zen|peace|quiet|stress|still|breath)\b/i.test(textLower)) {
      leadSpeaker = 'froggy';
    } else if (/\b(?:flow|drift|current|float|swim|ease|water|gentle)\b/i.test(textLower)) {
      leadSpeaker = 'bubbles';
    } else if (/\b(?:yay|happy|celebrate|cheer|smile|awesome|great|fixed|sun)\b/i.test(textLower)) {
      leadSpeaker = 'chicky';
    }
  }

  // 3. Fallback: If user asks about the circle ("others", "everyone", "table", "silent") or general greeting,
  // pick character who hasn't spoken recently
  if (!leadSpeaker) {
    const sortedByLeastSpoken = [...ALL_TABLE_CHARACTERS].sort((a, b) => recentSpeakerCounts[a] - recentSpeakerCounts[b]);
    leadSpeaker = sortedByLeastSpoken[0] || 'munch';
  }

  // Turn 1: Lead Speaker
  turns.push({
    characterId: leadSpeaker,
    intent: 'lead_response',
    targetCharacterId: 'user',
    isInterruption: false,
    interruptPriority: 0,
    promptGuidance: `Respond directly to the user in your authentic voice (${MASCOT_SELF_IDENTITIES[leadSpeaker].speakingStyle}).`
  });

  // 2. Evaluate Secondary Character for lively banter or collaborative response
  let secondarySpeaker: MascotCharacter | null = null;
  let secondaryIntent: TurnIntent = 'agree_build';
  let isInterruption = false;
  let interruptReason = '';
  let interruptPriority = 0.5;

  if (leadSpeaker === 'pandy' && (textLower.includes('action') || textLower.includes('do') || Math.random() > 0.3)) {
    secondarySpeaker = 'dobby';
    secondaryIntent = 'disagree_reframe';
    isInterruption = true;
    interruptReason = 'Dobby wants to push for action and cannot stand sitting still.';
    interruptPriority = 0.85;
  } else if (leadSpeaker === 'dobby' && (textLower.includes('tired') || textLower.includes('stress') || Math.random() > 0.3)) {
    secondarySpeaker = 'pandy';
    secondaryIntent = 'protective_intervene';
    isInterruption = true;
    interruptReason = 'Pandy steps in to prevent Dobby from burning the user out.';
    interruptPriority = 0.82;
  } else if (leadSpeaker === 'ollie' && (textLower.includes('fun') || textLower.includes('joke') || Math.random() > 0.4)) {
    secondarySpeaker = 'coco';
    secondaryIntent = 'playful_tease';
    isInterruption = false;
    interruptReason = 'Coco playfully teases Ollie for overanalyzing.';
    interruptPriority = 0.6;
  } else if (leadSpeaker === 'ellie') {
    secondarySpeaker = 'ollie';
    secondaryIntent = 'agree_build';
    isInterruption = false;
  } else if (leadSpeaker === 'coco') {
    secondarySpeaker = 'bubbles';
    secondaryIntent = 'agree_build';
    isInterruption = false;
  } else if (leadSpeaker === 'froggy') {
    secondarySpeaker = 'pandy';
    secondaryIntent = 'agree_build';
    isInterruption = false;
  } else if (leadSpeaker === 'bubbles') {
    secondarySpeaker = 'chicky';
    secondaryIntent = 'agree_build';
    isInterruption = false;
  } else if (leadSpeaker === 'chicky') {
    secondarySpeaker = 'dobby';
    secondaryIntent = 'agree_build';
    isInterruption = false;
  } else if (leadSpeaker === 'munch') {
    // Pick least recently spoken companion to ensure full table variety
    const remaining = ALL_TABLE_CHARACTERS.filter(c => c !== 'munch').sort((a, b) => recentSpeakerCounts[a] - recentSpeakerCounts[b]);
    secondarySpeaker = remaining[0] || 'ollie';
    secondaryIntent = 'agree_build';
  } else {
    const candidateDynamics = CHARACTER_DYNAMICS[leadSpeaker];
    if (candidateDynamics?.frequentPartners && candidateDynamics.frequentPartners.length > 0) {
      secondarySpeaker = candidateDynamics.frequentPartners[0];
    } else {
      const remaining = ALL_TABLE_CHARACTERS.filter(c => c !== leadSpeaker).sort((a, b) => recentSpeakerCounts[a] - recentSpeakerCounts[b]);
      secondarySpeaker = remaining[0] || 'munch';
    }
  }

  if (secondarySpeaker && secondarySpeaker !== leadSpeaker) {
    let guidance = '';
    const isChallengingOrTeasing: boolean =
      secondaryIntent === 'disagree_reframe' ||
      secondaryIntent === 'playful_tease' ||
      (secondaryIntent as string) === 'playful_roast';

    if (isChallengingOrTeasing) {
      guidance = `React directly to ${MASCOT_SELF_IDENTITIES[leadSpeaker].displayName}'s statement. Challenge, tease, or offer a contrasting perspective in your distinct voice.`;
    } else {
      guidance = `Acknowledge and build on what ${MASCOT_SELF_IDENTITIES[leadSpeaker].displayName} said, adding your own unique angle without repeating their points.`;
    }

    turns.push({
      characterId: secondarySpeaker,
      intent: secondaryIntent,
      targetCharacterId: leadSpeaker,
      isInterruption,
      interruptReason,
      interruptPriority,
      promptGuidance: guidance
    });

    // 3. Optional Third Turn: Natural Group Settlement or Cheer
    const isBigGroupTopic = /\b(?:everyone|all of you|team|table|who is|fight|debate|silent|all)\b/i.test(textLower);
    if (isBigGroupTopic) {
      const remaining = ALL_TABLE_CHARACTERS.filter(c => c !== leadSpeaker && c !== secondarySpeaker).sort((a, b) => recentSpeakerCounts[a] - recentSpeakerCounts[b]);
      const thirdSpeaker = remaining[0];
      if (thirdSpeaker) {
        turns.push({
          characterId: thirdSpeaker,
          intent: 'agree_build',
          targetCharacterId: 'user',
          isInterruption: false,
          interruptPriority: 0,
          promptGuidance: `Join the conversation with ${MASCOT_SELF_IDENTITIES[leadSpeaker].displayName} and ${MASCOT_SELF_IDENTITIES[secondarySpeaker].displayName} from your distinct perspective as ${MASCOT_SELF_IDENTITIES[thirdSpeaker].displayName}.`
        });
      }
    }
  }

  return turns;
}

/**
 * Evaluates which characters should react non-verbally when a speaker talks.
 * Generates natural, personality-aligned social reactions without spamming text responses.
 */
export function generateSocialReactions(
  speakerId: MascotCharacter | 'user',
  messageText: string,
  turnIntent: TurnIntent = 'lead_response'
): CharacterReactionEvent[] {
  const reactions: CharacterReactionEvent[] = [];
  const textLower = messageText.toLowerCase();

  for (const char of ALL_TABLE_CHARACTERS) {
    if (char === speakerId) continue;

    let reaction: SocialReactionKind = 'look_at_speaker';

    if (turnIntent === 'playful_tease' || turnIntent === 'playful_roast') {
      if (char === 'coco' || char === 'chicky') reaction = 'laugh';
      else if (char === 'ollie') reaction = 'eye_roll';
      else reaction = 'smile';
    } else if (turnIntent === 'disagree_reframe') {
      if (char === 'froggy' || char === 'ellie') reaction = 'surprised';
      else if (char === 'dobby') reaction = 'nod';
      else reaction = 'look_at_speaker';
    } else {
      if (char === 'chicky' && /yay|win|success|good|great|awesome|fixed|built|happy/i.test(textLower)) {
        reaction = 'cheer';
      } else if (char === 'pandy' && /tired|exhausted|rest|slow|nap|break/i.test(textLower)) {
        reaction = 'agree';
      } else if (char === 'dobby' && /action|let's go|start|fast|momentum|try/i.test(textLower)) {
        reaction = 'nod';
      } else if (char === 'ollie' && /why|how|think|wonder|curious|reason|question/i.test(textLower)) {
        reaction = 'nod';
      } else if (char === 'coco' && /funny|silly|joke|weird|strange|cat/i.test(textLower)) {
        reaction = 'laugh';
      } else if (char === 'ellie' && /anxious|worry|scared|hard|stress|help/i.test(textLower)) {
        reaction = 'smile';
      } else if (char === 'froggy') {
        reaction = 'nod';
      } else if (char === 'bubbles') {
        reaction = 'smile';
      } else if (char === 'munch') {
        reaction = 'agree';
      }
    }

    reactions.push({
      characterId: char,
      reaction,
      targetSpeakerId: speakerId,
      intensity: 0.75
    });
  }

  return reactions;
}
