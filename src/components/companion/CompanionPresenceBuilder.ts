'use client';

import { MascotCharacter } from '../Mascot';
import { EnvironmentTime } from './EnvironmentRenderer';

export type WelcomeMood = 'warm' | 'quiet' | 'playful' | 'thoughtful' | 'cheerful';
export type GreetingIntensity = 'low' | 'medium' | 'high';
export type ConversationFamiliarity = 
  | 'new_companion' 
  | 'returning_companion' 
  | 'long_absence' 
  | 'same_day' 
  | 'recent_conversation';

export interface CompanionPresenceOutput {
  shouldGreet: boolean;
  welcomeMood: WelcomeMood;
  greetingIntensity: GreetingIntensity;
  conversationFamiliarity: ConversationFamiliarity;
  animationToPlay: string;
  referencePreviousConversation: boolean;
}

export class CompanionPresenceBuilder {
  /**
   * Resolves presence metadata based on conversation familiarity metrics and context.
   */
  public static buildPresence(
    character: MascotCharacter,
    time: EnvironmentTime,
    sessionAgeMinutes: number,
    minutesSinceLastSession: number | undefined,
    activeTopicKey: string
  ): CompanionPresenceOutput {
    // 1. Resolve conversation familiarity
    let conversationFamiliarity: ConversationFamiliarity = 'new_companion';
    if (minutesSinceLastSession !== undefined) {
      if (minutesSinceLastSession < 30) {
        conversationFamiliarity = 'same_day';
      } else if (minutesSinceLastSession < 180) {
        conversationFamiliarity = 'recent_conversation';
      } else if (minutesSinceLastSession < 1440) {
        conversationFamiliarity = 'returning_companion';
      } else {
        conversationFamiliarity = 'long_absence';
      }
    }

    // 2. Resolve welcome mood based on mascot type and environment time
    let welcomeMood: WelcomeMood = 'warm';
    if (time === 'night') {
      welcomeMood = 'quiet';
    } else if (time === 'morning') {
      welcomeMood = character === 'dobby' || character === 'chicky' ? 'cheerful' : 'playful';
    } else if (time === 'evening') {
      welcomeMood = 'thoughtful';
    }

    // 3. Resolve greeting intensity based on familiarity
    let greetingIntensity: GreetingIntensity = 'medium';
    if (conversationFamiliarity === 'same_day') {
      greetingIntensity = 'low';
    } else if (conversationFamiliarity === 'long_absence') {
      greetingIntensity = 'high';
    }

    // 4. Decide whether previous conversation should be referenced
    const hasTopic = activeTopicKey !== 'general' && activeTopicKey !== 'listening';
    const referencePreviousConversation = hasTopic && (
      conversationFamiliarity === 'returning_companion' || 
      conversationFamiliarity === 'recent_conversation'
    );

    // 5. Determine starting animation
    let animationToPlay = 'float';
    if (welcomeMood === 'cheerful') {
      animationToPlay = 'celebrate';
    } else if (welcomeMood === 'quiet') {
      animationToPlay = 'calm';
    }

    const shouldGreet = sessionAgeMinutes === 0;

    return {
      shouldGreet,
      welcomeMood,
      greetingIntensity,
      conversationFamiliarity,
      animationToPlay,
      referencePreviousConversation
    };
  }
}
