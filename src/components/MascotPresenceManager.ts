import {
  PresenceMode,
  PresenceIntensity,
  AttentionTarget,
  InteractionState,
  MicroReaction,
  MASCOT_EXPRESSION_REGISTRY,
  MASCOT_TRANSITION_MATRIX
} from './mascot-config';

export interface MascotPresenceState {
  mode: PresenceMode;
  intensity: PresenceIntensity;
  expression: string; // Semantic emotional state (idle, happy, curious, calm, wry, etc.)
  attentionTarget: AttentionTarget;
  interactionState: InteractionState;
}

export class MascotPresenceManager {
  private currentExpression: string = 'idle';
  private expressionHistory: string[] = ['idle'];
  private expressionQueue: string[] = [];
  
  // Lifetimes
  private lastExpressionChangeTime: number = 0;
  private currentMinDuration: number = 0;
  private currentInterruptible: boolean = true;

  // Ambient Scheduler variables
  private lastAmbientActionTime: number = 0;
  private activeMicroReaction: MicroReaction = 'none';
  private microReactionEndTime: number = 0;

  // Attention Offsets
  private pupilOffsetX: number = 0;
  private pupilOffsetY: number = 0;

  constructor() {
    const now = Date.now();
    this.lastExpressionChangeTime = now;
    this.lastAmbientActionTime = now;
  }

  /**
   * Translates an AttentionTarget into pupil translation offsets.
   */
  public resolveAttentionOffsets(target: AttentionTarget): { x: number; y: number } {
    switch (target) {
      case 'composer':
        return { x: 0, y: 1.5 }; // Looking down towards input box
      case 'thinking':
        return { x: 0, y: -1.5 }; // Looking up reflecting
      case 'nothing':
        return { x: 1.5, y: -0.5 }; // Distracted look
      case 'message':
      case 'user':
      default:
        return { x: 0, y: 0 }; // Looking directly at user
    }
  }

  /**
   * Resolves the target expression key from the given presence and cognitive state.
   */
  public resolveTargetExpression(presenceState: MascotPresenceState): string {
    const candidates: string[] = [];

    // Map presence state interaction rules to candidates
    if (presenceState.interactionState === 'welcome') {
      candidates.push('happy');
    } else if (presenceState.interactionState === 'goodbye') {
      candidates.push('calm');
    } else if (presenceState.interactionState === 'typing') {
      candidates.push('listening');
    }

    if (presenceState.expression) {
      const key = presenceState.expression.toLowerCase();
      if (MASCOT_EXPRESSION_REGISTRY[key]) {
        candidates.push(key);
      }
    }

    candidates.push('idle');

    // Find candidate with highest priority
    let target = 'idle';
    let highestPriority = -1;

    for (const key of candidates) {
      const config = MASCOT_EXPRESSION_REGISTRY[key];
      if (config && config.priority > highestPriority) {
        highestPriority = config.priority;
        target = key;
      }
    }

    return target;
  }

  /**
   * Updates state, processes queue, and triggers ambient idle events.
   */
  public update(presenceState: MascotPresenceState): {
    expression: string;
    microReaction: MicroReaction;
    pupilOffsets: { x: number; y: number };
  } {
    const now = Date.now();
    const timeSpent = now - this.lastExpressionChangeTime;
    const targetExpr = this.resolveTargetExpression(presenceState);

    // 1. Queue requested expressions
    if (targetExpr !== 'idle' && targetExpr !== this.currentExpression) {
      const lastInQueue = this.expressionQueue[this.expressionQueue.length - 1];
      if (targetExpr !== lastInQueue) {
        this.expressionQueue.push(targetExpr);
      }
    }

    // 2. Enforce Lifetimes
    let canTransition = this.currentInterruptible || timeSpent >= this.currentMinDuration;

    if (canTransition) {
      // Process queue if items exist
      if (this.expressionQueue.length > 0) {
        const nextExpr = this.expressionQueue.shift()!;
        this.transitionTo(nextExpr);
      } else if (this.currentExpression !== targetExpr) {
        // Regress using historical memory
        if (targetExpr === 'idle') {
          if (this.expressionHistory.length > 1) {
            this.expressionHistory.pop();
            const prev = this.expressionHistory[this.expressionHistory.length - 1] || 'idle';
            this.transitionTo(prev, false);
          } else {
            this.transitionTo('idle');
          }
        } else {
          this.transitionTo(targetExpr);
        }
      }
    }

    // 3. Ambient Scheduler
    // Only schedule random events when current expression is idle and not loading/thinking
    const isMascotBusy = this.currentExpression === 'thinking' || presenceState.interactionState === 'typing';
    
    if (!isMascotBusy && this.currentExpression === 'idle') {
      // Clear expired micro reactions
      if (this.activeMicroReaction !== 'none' && now >= this.microReactionEndTime) {
        this.activeMicroReaction = 'none';
      }

      // Roll for random micro reactions every 7 seconds
      const elapsedSinceAmbient = now - this.lastAmbientActionTime;
      if (this.activeMicroReaction === 'none' && elapsedSinceAmbient >= 7000) {
        this.lastAmbientActionTime = now;
        const roll = Math.random();
        if (roll < 0.35) {
          const reactions: MicroReaction[] = ['tilt', 'nod', 'bounce', 'blink'];
          const chosen = reactions[Math.floor(Math.random() * reactions.length)];
          this.activeMicroReaction = chosen;
          this.microReactionEndTime = now + 1200; // Plays for 1.2s
        }
      }
    } else {
      // Clear if busy
      this.activeMicroReaction = 'none';
    }

    // 4. Attention System Offsets
    const targetTarget = this.currentExpression === 'thinking' ? 'thinking' : presenceState.attentionTarget;
    const offsets = this.resolveAttentionOffsets(targetTarget);
    this.pupilOffsetX = offsets.x;
    this.pupilOffsetY = offsets.y;

    return {
      expression: this.currentExpression,
      microReaction: this.activeMicroReaction,
      pupilOffsets: { x: this.pupilOffsetX, y: this.pupilOffsetY }
    };
  }

  private transitionTo(nextExpr: string, pushHistory = true) {
    if (nextExpr === this.currentExpression) return;

    if (pushHistory) {
      const last = this.expressionHistory[this.expressionHistory.length - 1];
      if (last !== nextExpr) {
        this.expressionHistory.push(nextExpr);
      }
      if (this.expressionHistory.length > 5) {
        this.expressionHistory.shift();
      }
    }

    this.currentExpression = nextExpr;
    this.lastExpressionChangeTime = Date.now();

    const config = MASCOT_EXPRESSION_REGISTRY[nextExpr] || MASCOT_EXPRESSION_REGISTRY.idle;
    this.currentMinDuration = config.lifetime.minimumDuration;
    this.currentInterruptible = config.lifetime.interruptible;
  }

  public getCurrentExpression(): string {
    return this.currentExpression;
  }

  /**
   * Helper mapping session milestones to interaction recommendations.
   */
  public static resolveSessionState(sessionAgeMinutes: number, minutesSinceLastSession?: number): InteractionState {
    if (minutesSinceLastSession !== undefined && minutesSinceLastSession > 300) {
      return 'returning'; // Came back after 5 hours
    }
    if (sessionAgeMinutes === 0) {
      return 'welcome';
    }
    if (sessionAgeMinutes >= 30) {
      return 'waiting'; // Relaxed waiting
    }
    return 'idle';
  }

  public static getTransitionDuration(source: string, target: string): number {
    const defaultDuration = 300;
    const sourceMatrix = MASCOT_TRANSITION_MATRIX[source];
    if (sourceMatrix && sourceMatrix[target] !== undefined) {
      return sourceMatrix[target];
    }
    return defaultDuration;
  }
}
