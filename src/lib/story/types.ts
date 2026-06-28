/**
 * IMPORTANT NOTE:
 * All examples, keywords, phrases, goals, identities, challenges, events, transitions, priorities, and scenarios
 * are illustrative examples only. They are provided to explain the intended behavior of the engine and must not be
 * treated as an exhaustive or fixed list.
 *
 * The implementation must remain generic, extensible, and deterministic. Use configurable pattern maps, reusable
 * matching logic, and modular rules rather than hardcoded checks.
 */

export interface StoryEvent {
  id: string;
  type: 'achievement' | 'progress' | 'setback' | 'decision' | 'realization' | 'transition' | 'milestone';
  title: string;
  description: string;
  confidence: number;
  relatedArc: string;
  createdAt: string;
  evidence: string[];
  significant: boolean;
  emotion?: string; // Captured emotional context
}

export interface StoryState {
  currentArc: string;
  arcStage: 'starting' | 'developing' | 'progressing' | 'transitioning' | 'completed';
  activeGoals: string[];
  activeChallenges: string[];
  identitySignals: string[];
  confidence: number;
  evidence: string[];
  events: StoryEvent[];
}

export interface StoryProgress {
  linkedArc: string;
  continuityStatus: 'new' | 'continuing' | 'progressing' | 'stagnating' | 'pivoting' | 'completed';
  progressScore: number;
  stagnationCount: number;
  memoryPriority: 'low' | 'medium' | 'high' | 'critical';
  focusSuggestion: 'goal' | 'challenge' | 'identity' | 'milestone' | 'decision' | 'relationship';
  storyShift: boolean;
  storyShiftReason: string | null;
  confidence: number;
  evidence: string[];
  lastMeaningfulTurn?: number;
}

export interface StoryPattern {
  id: string;
  category:
    | 'strength'
    | 'struggle'
    | 'motivation'
    | 'fear'
    | 'habit'
    | 'value'
    | 'decision_style'
    | 'growth'
    | 'recurring_goal';
  title: string;
  description: string;
  occurrences: number;
  confidence: number;
  evidence: string[];
  firstObserved: string;
  lastObserved: string;
  active: boolean;
}

export interface StoryInsight {
  recurringPatterns: StoryPattern[];
  dominantMotivations: string[];
  dominantValues: string[];
  recurringFears: string[];
  unresolvedThreads: string[];
  personalStrengths: string[];
  growthAreas: string[];
  confidence: number;
  evidence: string[];
}

export interface ConsolidatedMemory {
  id: string;
  category: 'goal' | 'identity' | 'achievement' | 'habit' | 'preference' | 'challenge' | 'life_event' | 'skill';
  title: string;
  summary: string;
  strength: number;
  stability: number;
  confidence: number;
  firstObserved: string;
  lastReinforced: string;
  reinforcementCount: number;
  archived: boolean;
  evidence: string[];
  isCore?: boolean;
  // Future proofing fields
  linkedEvents?: string[];
  linkedMilestones?: string[];
  lastAccessed?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryState {
  memories: ConsolidatedMemory[];
}
