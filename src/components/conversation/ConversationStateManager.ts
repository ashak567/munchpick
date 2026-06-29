/**
 * ConversationStateManager.ts
 *
 * Centralized presentation controller for the conversation lifecycle.
 *
 * Responsibilities:
 *   - Manages the presentation state machine (idle → listening → thinking → …)
 *   - Enforces state lifetimes from conversation-config
 *   - Produces a unified ConversationPresentationOutput consumed by all UI layers
 *   - Synchronizes mascot expression, attention target, and micro-reaction
 *   - Coordinates natural conversation pacing (acknowledgment, response, reading)
 *   - Respects accessibility profiles (reduced-motion, static)
 *
 * Non-responsibilities (must NEVER be done here):
 *   - Modifying memories, emotions, or story state
 *   - Reasoning or inference
 *   - Prompt construction
 *   - Accessing the database or network
 */

import {
  ConversationPresentationState,
  PresentationProfile,
  PacingProfile,
  PACING_TIMINGS,
  PRESENTATION_STATE_CONFIG,
  PRESENTATION_STATE_EXPRESSIONS,
  ACCESSIBILITY_PROFILES,
  CONVERSATION_TRANSITION_MATRIX,
  PresentationPreferences,
  DEFAULT_PRESENTATION_PREFERENCES,
  PRESENTATION_PREFERENCES_STORAGE_KEY,
} from './conversation-config';
import type { AttentionTarget } from './mascot-config-types';

// ---------------------------------------------------------------------------
// Output shape consumed by all UI components
// ---------------------------------------------------------------------------

export interface ConversationPresentationOutput {
  /** Current state machine node */
  state: ConversationPresentationState;
  /** Recommended mascot expression key */
  expression: string;
  /** Recommended eye pupil attention direction */
  attentionTarget: AttentionTarget;
  /** Whether the response has finished streaming */
  isResponding: boolean;
  /** Whether the user is currently reading the latest message */
  isReading: boolean;
  /** Whether the mascot is in its idle ambient state */
  isIdle: boolean;
  /** Whether animations should be suppressed due to accessibility settings */
  suppressAnimations: boolean;
  /** Whether micro-reactions (nod, tilt) are allowed */
  allowMicroReactions: boolean;
  /** Whether particle effects (sparkles) are allowed */
  allowParticles: boolean;
  /** Whether the typing indicator should be shown */
  showTypingIndicator: boolean;
  /** Transition blend duration to apply when switching states (ms) */
  transitionDuration: number;
  /** Active accessibility profile */
  profile: PresentationProfile;
}

// ---------------------------------------------------------------------------
// External event inputs (produced by the chat page, never computed internally)
// ---------------------------------------------------------------------------

export interface ConversationEvent {
  type:
    | 'user_typing_started'
    | 'user_typing_stopped'
    | 'message_submitted'
    | 'response_started'
    | 'response_completed'
    | 'reading_started'
    | 'reading_completed'
    | 'session_resumed'
    | 'idle_requested';
  /** Optional backend expression override from cognitive pipeline */
  backendExpression?: string;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class ConversationStateManager {
  private state: ConversationPresentationState = 'idle';
  private previousState: ConversationPresentationState = 'idle';
  private stateEnteredAt: number = Date.now();
  private backendExpression: string = 'idle';
  private preferences: PresentationPreferences;
  private pendingTransition: ConversationPresentationState | null = null;
  private transitionScheduledAt: number | null = null;

  constructor(preferences?: Partial<PresentationPreferences>) {
    this.preferences = { ...DEFAULT_PRESENTATION_PREFERENCES, ...preferences };
  }

  // ---------------------------------------------------------------------------
  // Preferences management
  // ---------------------------------------------------------------------------

  public setPreferences(prefs: Partial<PresentationPreferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
  }

  public getPreferences(): PresentationPreferences {
    return { ...this.preferences };
  }

  /** Persist presentation preferences to localStorage (never persists animation state) */
  public persistPreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        PRESENTATION_PREFERENCES_STORAGE_KEY,
        JSON.stringify(this.preferences)
      );
    } catch {
      // localStorage not available — silently skip
    }
  }

  /** Restore previously persisted presentation preferences */
  public restorePreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(PRESENTATION_PREFERENCES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<PresentationPreferences>;
        this.preferences = { ...DEFAULT_PRESENTATION_PREFERENCES, ...parsed };
      }
    } catch {
      // Corrupt storage — fall back to defaults silently
    }
  }

  /** Detect OS-level reduced-motion preference and apply if set */
  public applySystemAccessibility(): void {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced && this.preferences.profile === 'standard') {
      this.preferences.profile = 'reduced-motion';
    }
  }

  // ---------------------------------------------------------------------------
  // Event-driven state transitions
  // ---------------------------------------------------------------------------

  public dispatch(event: ConversationEvent): void {
    if (event.backendExpression) {
      this.backendExpression = event.backendExpression;
    }

    switch (event.type) {
      case 'user_typing_started':
        this.transitionTo('listening');
        break;

      case 'user_typing_stopped':
        // Return to idle only if we haven't submitted
        if (this.state === 'listening') {
          this.scheduleTransition('waiting', 600);
        }
        break;

      case 'message_submitted':
        this.transitionTo('waiting');
        break;

      case 'response_started':
        // Brief waiting → thinking → responding sequence
        this.transitionTo('thinking');
        break;

      case 'response_completed':
        this.transitionTo('finishing');
        // After finishing, auto-advance to reading then eventually idle
        this.scheduleTransition('reading', PACING_TIMINGS[this.preferences.pacingProfile].completionPause);
        break;

      case 'reading_started':
        if (this.state !== 'responding') {
          this.transitionTo('reading');
        }
        break;

      case 'reading_completed':
        this.transitionTo('returning_to_idle');
        this.scheduleTransition('idle', PACING_TIMINGS[this.preferences.pacingProfile].idleRecoveryDelay);
        break;

      case 'session_resumed':
        this.transitionTo('idle');
        break;

      case 'idle_requested':
        this.transitionTo('returning_to_idle');
        this.scheduleTransition('idle', PACING_TIMINGS[this.preferences.pacingProfile].idleRecoveryDelay);
        break;
    }
  }

  /**
   * Called on every tick (e.g. every 100ms from a React interval).
   * Processes pending transitions and returns the current presentation output.
   */
  public tick(): ConversationPresentationOutput {
    const now = Date.now();

    // Process any scheduled deferred transitions
    if (this.pendingTransition && this.transitionScheduledAt !== null) {
      const elapsed = now - this.transitionScheduledAt;
      const stateConfig = PRESENTATION_STATE_CONFIG[this.state];
      const canLeave = stateConfig.interruptible || elapsed >= stateConfig.minDuration;
      if (canLeave) {
        this.transitionTo(this.pendingTransition);
        this.pendingTransition = null;
        this.transitionScheduledAt = null;
      }
    }

    return this.buildOutput();
  }

  // ---------------------------------------------------------------------------
  // Internal transition engine
  // ---------------------------------------------------------------------------

  private transitionTo(next: ConversationPresentationState): void {
    if (next === this.state) return;

    const stateConfig = PRESENTATION_STATE_CONFIG[this.state];
    const elapsed = Date.now() - this.stateEnteredAt;

    // Enforce minimum duration for non-interruptible states
    if (!stateConfig.interruptible && elapsed < stateConfig.minDuration) {
      // Queue as pending instead of forcing it
      this.pendingTransition = next;
      this.transitionScheduledAt = this.stateEnteredAt + stateConfig.minDuration;
      return;
    }

    this.previousState = this.state;
    this.state = next;
    this.stateEnteredAt = Date.now();
    this.pendingTransition = null;
    this.transitionScheduledAt = null;
  }

  private scheduleTransition(next: ConversationPresentationState, delayMs: number): void {
    this.pendingTransition = next;
    this.transitionScheduledAt = Date.now() + delayMs;
  }

  // ---------------------------------------------------------------------------
  // Output assembly
  // ---------------------------------------------------------------------------

  private buildOutput(): ConversationPresentationOutput {
    const stateConfig = PRESENTATION_STATE_CONFIG[this.state];
    const accessibilityConfig = ACCESSIBILITY_PROFILES[this.preferences.profile];

    // Expression: use backend override when present, fall back to state mapping
    const expression =
      this.state === 'thinking' || this.state === 'responding'
        ? PRESENTATION_STATE_EXPRESSIONS[this.state]
        : this.backendExpression !== 'idle'
        ? this.backendExpression
        : PRESENTATION_STATE_EXPRESSIONS[this.state];

    // Transition duration: prefer matrix override, fall back to 300ms default
    const matrixOverride =
      CONVERSATION_TRANSITION_MATRIX[this.previousState]?.[this.state];
    const transitionDuration = matrixOverride ?? 300;

    // Scale transition duration by accessibility animation scale
    const scaledTransitionDuration = transitionDuration * accessibilityConfig.animationScale;

    const isResponding = this.state === 'responding' || this.state === 'thinking' || this.state === 'waiting';
    const isReading = this.state === 'reading';
    const isIdle = this.state === 'idle' || this.state === 'returning_to_idle';

    return {
      state: this.state,
      expression,
      attentionTarget: stateConfig.defaultAttention,
      isResponding,
      isReading,
      isIdle,
      suppressAnimations: !accessibilityConfig.enableBreathing,
      allowMicroReactions:
        accessibilityConfig.enableMicroReactions && !stateConfig.suppressAmbient,
      allowParticles: accessibilityConfig.enableParticles,
      showTypingIndicator: isResponding,
      transitionDuration: scaledTransitionDuration,
      profile: this.preferences.profile,
    };
  }

  // ---------------------------------------------------------------------------
  // Accessors (for testing)
  // ---------------------------------------------------------------------------

  public getCurrentState(): ConversationPresentationState {
    return this.state;
  }

  public getPreviousState(): ConversationPresentationState {
    return this.previousState;
  }
}
