'use client';

import { MascotCharacter } from '../Mascot';

export type PresenceExperienceState =
  | 'sessionStarted'
  | 'firstConversation'
  | 'conversationPaused'
  | 'conversationEnded'
  | 'returnAfterMinutes'
  | 'returnTomorrow';

export interface AmbientStep {
  reaction: import('../mascot-config').MicroReaction;
  duration: number; // Duration of this step in ms
}

// Configurable Ambient Sequence per Mascot
export const MASCOT_AMBIENT_SEQUENCES: Record<MascotCharacter, import('../mascot-config').MicroReaction[]> = {
  munch: ['blink', 'tilt', 'blink'],
  ollie: ['tilt', 'blink', 'head_turn'],
  pandy: ['blink', 'bounce', 'blink'],
  ellie: ['blink', 'tilt', 'head_turn'],
  dobby: ['bounce', 'blink', 'tilt'],
  froggy: ['blink', 'tilt', 'blink'],
  coco: ['tilt', 'blink', 'head_turn'],
  bubbles: ['blink', 'blink', 'tilt'],
  chicky: ['bounce', 'blink', 'bounce']
};

export class PresenceExperienceManager {
  private currentState: PresenceExperienceState = 'sessionStarted';
  private lastActiveTime: number = Date.now();
  private isTabActive: boolean = true;

  // Ambient Scheduler Sequence tracking
  private activeSequenceIndex: number = 0;
  private lastSequenceTickTime: number = Date.now();

  constructor() {
    if (typeof window !== 'undefined') {
      this.isTabActive = !document.hidden;
      
      const handleVisibilityChange = () => {
        this.isTabActive = !document.hidden;
        if (this.isTabActive) {
          this.lastActiveTime = Date.now();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  }

  public setTabActiveState(active: boolean) {
    this.isTabActive = active;
  }

  public getTabActiveState(): boolean {
    return this.isTabActive;
  }

  /**
   * Tracks session visibility events to resolve return state and idle time.
   */
  public handleSessionInteraction(event: 'open' | 'active_check' | 'message_sent'): PresenceExperienceState {
    const now = Date.now();
    const elapsedMinutes = (now - this.lastActiveTime) / 60000;
    this.lastActiveTime = now;

    if (event === 'message_sent') {
      this.currentState = 'firstConversation';
      return this.currentState;
    }

    if (elapsedMinutes >= 1440) {
      this.currentState = 'returnTomorrow';
    } else if (elapsedMinutes >= 30) {
      this.currentState = 'returnAfterMinutes';
    }

    return this.currentState;
  }

  /**
   * Increments the ambient rotation loop config. Pauses when tab is inactive.
   */
  public tickAmbientSequence(character: MascotCharacter): import('../mascot-config').MicroReaction {
    if (!this.isTabActive) {
      return 'none'; // Pause all movements when tab is inactive to save CPU/battery
    }

    const now = Date.now();
    const elapsed = now - this.lastSequenceTickTime;

    // Trigger next reaction phase every 8 seconds
    if (elapsed >= 8000) {
      this.lastSequenceTickTime = now;
      const sequence = MASCOT_AMBIENT_SEQUENCES[character] || MASCOT_AMBIENT_SEQUENCES.munch;
      
      this.activeSequenceIndex = (this.activeSequenceIndex + 1) % sequence.length;
      return sequence[this.activeSequenceIndex];
    }

    return 'none';
  }

  public getCurrentExperienceState(): PresenceExperienceState {
    return this.currentState;
  }
}
