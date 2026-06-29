/**
 * conversation-config.ts
 *
 * Centralized configuration registry for all conversation presentation behaviors.
 * All timing values, pacing profiles, and accessibility preferences must originate
 * here rather than being embedded in components or managers.
 *
 * This module is purely declarative — it performs no logic, no side effects.
 */

// ---------------------------------------------------------------------------
// Presentation States
// All states must be declared as string literals in the union.
// New states can be added here without changing any other file.
// ---------------------------------------------------------------------------

export type ConversationPresentationState =
  | 'idle'
  | 'listening'
  | 'waiting'
  | 'thinking'
  | 'responding'
  | 'reading'
  | 'finishing'
  | 'returning_to_idle';

// ---------------------------------------------------------------------------
// Accessibility Presentation Profiles
// Controls the overall motion and animation level.
// ---------------------------------------------------------------------------

export type PresentationProfile = 'standard' | 'reduced-motion' | 'static';

// ---------------------------------------------------------------------------
// Pacing Profiles
// Named profiles that describe how responses should be timed and presented.
// ---------------------------------------------------------------------------

export type PacingProfile = 'natural' | 'quick' | 'deliberate';

// ---------------------------------------------------------------------------
// Transition Configuration
// Defines minimum time spent in each presentation state before transitioning.
// All durations are in milliseconds.
// ---------------------------------------------------------------------------

export interface PresentationStateConfig {
  /** Minimum duration in this state before any transition is allowed (ms) */
  minDuration: number;
  /** Maximum duration before automatically advancing to next state (ms) */
  maxDuration?: number;
  /** Whether an external event can interrupt this state early */
  interruptible: boolean;
  /** Target mascot attention during this state */
  defaultAttention: import('./mascot-config-types').AttentionTarget;
  /** Whether to suppress ambient micro-reactions during this state */
  suppressAmbient: boolean;
}

// ---------------------------------------------------------------------------
// Pacing Timing Registry
// Per-pacing-profile timing values for each phase of a response.
// ---------------------------------------------------------------------------

export interface PacingTimings {
  /** Delay between user message submission and thinking indicator (ms) */
  acknowledgmentDelay: number;
  /** Delay before first character of response appears after loading (ms) */
  responseStartDelay: number;
  /** Delay between individual message paragraphs during streaming (ms) */
  paragraphPauseDelay: number;
  /** Duration of "finishing" state after last token arrives (ms) */
  completionPause: number;
  /** Duration before returning to idle after finishing (ms) */
  idleRecoveryDelay: number;
}

export const PACING_TIMINGS: Record<PacingProfile, PacingTimings> = {
  natural: {
    acknowledgmentDelay: 350,
    responseStartDelay: 200,
    paragraphPauseDelay: 180,
    completionPause: 800,
    idleRecoveryDelay: 1200,
  },
  quick: {
    acknowledgmentDelay: 100,
    responseStartDelay: 50,
    paragraphPauseDelay: 60,
    completionPause: 300,
    idleRecoveryDelay: 500,
  },
  deliberate: {
    acknowledgmentDelay: 600,
    responseStartDelay: 400,
    paragraphPauseDelay: 350,
    completionPause: 1400,
    idleRecoveryDelay: 2000,
  },
};

// ---------------------------------------------------------------------------
// Per-State Lifecycle Configuration
// Controls how long each presentation state persists.
// ---------------------------------------------------------------------------

export const PRESENTATION_STATE_CONFIG: Record<ConversationPresentationState, PresentationStateConfig> = {
  idle: {
    minDuration: 0,
    interruptible: true,
    defaultAttention: 'user',
    suppressAmbient: false,
  },
  listening: {
    minDuration: 300,
    interruptible: true,
    defaultAttention: 'composer',
    suppressAmbient: false,
  },
  waiting: {
    minDuration: 500,
    interruptible: true,
    defaultAttention: 'user',
    suppressAmbient: false,
  },
  thinking: {
    minDuration: 800,
    interruptible: false,
    defaultAttention: 'thinking',
    suppressAmbient: true,
  },
  responding: {
    minDuration: 400,
    interruptible: false,
    defaultAttention: 'message',
    suppressAmbient: true,
  },
  reading: {
    minDuration: 600,
    interruptible: true,
    defaultAttention: 'message',
    suppressAmbient: true,
  },
  finishing: {
    minDuration: 600,
    maxDuration: 2000,
    interruptible: true,
    defaultAttention: 'user',
    suppressAmbient: true,
  },
  returning_to_idle: {
    minDuration: 400,
    interruptible: true,
    defaultAttention: 'user',
    suppressAmbient: false,
  },
};

// ---------------------------------------------------------------------------
// Mascot Expression Mapping
// Maps each conversation presentation state to a recommended expression.
// Expressions remain configuration-driven — not hardcoded in components.
// ---------------------------------------------------------------------------

export const PRESENTATION_STATE_EXPRESSIONS: Record<ConversationPresentationState, string> = {
  idle: 'idle',
  listening: 'listening',
  waiting: 'idle',
  thinking: 'thinking',
  responding: 'listening',
  reading: 'calm',
  finishing: 'happy',
  returning_to_idle: 'calm',
};

// ---------------------------------------------------------------------------
// Accessibility Profile Configuration
// Describes how each profile modifies presentation behavior.
// ---------------------------------------------------------------------------

export interface AccessibilityProfileConfig {
  /** Scale factor for all animation durations (1.0 = normal, 0 = none) */
  animationScale: number;
  /** Whether breathing / floating animations are enabled */
  enableBreathing: boolean;
  /** Whether particle effects (sparkles, glows) are enabled */
  enableParticles: boolean;
  /** Whether micro-reactions (nod, tilt, blink) are enabled */
  enableMicroReactions: boolean;
  /** Whether transition blending between states is enabled */
  enableTransitionBlend: boolean;
  /** Whether the typing indicator is animated */
  enableTypingIndicatorAnimation: boolean;
}

export const ACCESSIBILITY_PROFILES: Record<PresentationProfile, AccessibilityProfileConfig> = {
  standard: {
    animationScale: 1.0,
    enableBreathing: true,
    enableParticles: true,
    enableMicroReactions: true,
    enableTransitionBlend: true,
    enableTypingIndicatorAnimation: true,
  },
  'reduced-motion': {
    animationScale: 0.3,
    enableBreathing: true,
    enableParticles: false,
    enableMicroReactions: false,
    enableTransitionBlend: false,
    enableTypingIndicatorAnimation: true,
  },
  static: {
    animationScale: 0,
    enableBreathing: false,
    enableParticles: false,
    enableMicroReactions: false,
    enableTransitionBlend: false,
    enableTypingIndicatorAnimation: false,
  },
};

// ---------------------------------------------------------------------------
// Transition Matrix
// Per-state-pair blend durations in milliseconds (overrides defaults).
// ---------------------------------------------------------------------------

export const CONVERSATION_TRANSITION_MATRIX: Partial<
  Record<ConversationPresentationState, Partial<Record<ConversationPresentationState, number>>>
> = {
  idle: { listening: 200, thinking: 300 },
  thinking: { responding: 400, finishing: 600 },
  responding: { finishing: 500, reading: 300 },
  reading: { returning_to_idle: 600 },
  finishing: { returning_to_idle: 800, idle: 600 },
  returning_to_idle: { idle: 400 },
};

// ---------------------------------------------------------------------------
// Persistable Presentation Preferences
// Only these lightweight values should survive page refreshes.
// Animation state, timers, and interaction positions must never be persisted.
// ---------------------------------------------------------------------------

export interface PresentationPreferences {
  profile: PresentationProfile;
  pacingProfile: PacingProfile;
}

export const DEFAULT_PRESENTATION_PREFERENCES: PresentationPreferences = {
  profile: 'standard',
  pacingProfile: 'natural',
};

export const PRESENTATION_PREFERENCES_STORAGE_KEY = 'munch_presentation_prefs';
