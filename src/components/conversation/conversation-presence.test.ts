import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConversationStateManager,
} from './ConversationStateManager';

describe('ConversationStateManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // -------------------------------------------------------------------------
  // 1. State transitions execute deterministically
  // -------------------------------------------------------------------------
  it('should transition states deterministically on events', () => {
    const manager = new ConversationStateManager();
    expect(manager.getCurrentState()).toBe('idle');

    manager.dispatch({ type: 'user_typing_started' });
    expect(manager.getCurrentState()).toBe('listening');

    manager.dispatch({ type: 'message_submitted' });
    expect(manager.getCurrentState()).toBe('waiting');

    manager.dispatch({ type: 'response_started' });
    expect(manager.getCurrentState()).toBe('thinking');
  });

  // -------------------------------------------------------------------------
  // 2. Presentation state recovers correctly after response completion
  // -------------------------------------------------------------------------
  it('should recover to reading then idle after response_completed', () => {
    const manager = new ConversationStateManager();

    manager.dispatch({ type: 'response_started' });
    expect(manager.getCurrentState()).toBe('thinking');

    // Advance past minDuration of thinking (800ms)
    vi.advanceTimersByTime(900);
    manager.dispatch({ type: 'response_completed', backendExpression: 'happy' });
    expect(manager.getCurrentState()).toBe('finishing');

    // Tick once — should be pending a 'reading' transition after completionPause
    manager.tick();

    // Advance through the completion pause (800ms)
    vi.advanceTimersByTime(900);
    manager.tick();
    expect(manager.getCurrentState()).toBe('reading');
  });

  // -------------------------------------------------------------------------
  // 3. Reading state is independent from response generation
  // -------------------------------------------------------------------------
  it('should allow reading state to be entered independently', () => {
    const manager = new ConversationStateManager();

    manager.dispatch({ type: 'reading_started' });
    expect(manager.getCurrentState()).toBe('reading');

    // Completing reading should trigger return to idle
    vi.advanceTimersByTime(700);
    manager.dispatch({ type: 'reading_completed' });
    expect(manager.getCurrentState()).toBe('returning_to_idle');
  });

  // -------------------------------------------------------------------------
  // 4. Reduced-motion profile disables micro-reactions and particles
  // -------------------------------------------------------------------------
  it('should disable micro-reactions and particles in reduced-motion profile', () => {
    const manager = new ConversationStateManager({ profile: 'reduced-motion' });
    const output = manager.tick();

    expect(output.profile).toBe('reduced-motion');
    expect(output.allowMicroReactions).toBe(false);
    expect(output.allowParticles).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 5. Session restoration correctly restores presentation preferences
  // -------------------------------------------------------------------------
  it('should restore persisted preferences from localStorage', () => {
    const localStorageMock = {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, val: string) { this.store[key] = val; },
      removeItem(key: string) { delete this.store[key]; },
    };
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', { localStorage: localStorageMock, matchMedia: () => ({ matches: false }) });

    const manager = new ConversationStateManager({ profile: 'reduced-motion', pacingProfile: 'quick' });
    manager.persistPreferences();

    const manager2 = new ConversationStateManager();
    manager2.restorePreferences();
    const prefs = manager2.getPreferences();

    expect(prefs.profile).toBe('reduced-motion');
    expect(prefs.pacingProfile).toBe('quick');
  });

  // -------------------------------------------------------------------------
  // 6. Conversation pacing follows configuration
  // -------------------------------------------------------------------------
  it('should use the configured pacing timings for idleRecoveryDelay', () => {
    const manager = new ConversationStateManager({ pacingProfile: 'quick' });

    // Simulate finishing state
    manager.dispatch({ type: 'response_started' });
    vi.advanceTimersByTime(900);
    manager.dispatch({ type: 'response_completed' });
    manager.tick();

    // Advance through reading state
    vi.advanceTimersByTime(400); // quick completionPause = 300
    manager.tick();
    expect(manager.getCurrentState()).toBe('reading');

    // Complete reading
    manager.dispatch({ type: 'reading_completed' });
    expect(manager.getCurrentState()).toBe('returning_to_idle');

    // Quick profile idleRecoveryDelay = 500
    vi.advanceTimersByTime(600);
    manager.tick();
    expect(manager.getCurrentState()).toBe('idle');
  });

  // -------------------------------------------------------------------------
  // 7. Mascot receives expression from centralized manager, not from local state
  // -------------------------------------------------------------------------
  it('should expose backend expression in output after response_completed', () => {
    const manager = new ConversationStateManager();

    manager.dispatch({ type: 'response_started' });
    vi.advanceTimersByTime(900);
    manager.dispatch({ type: 'response_completed', backendExpression: 'curious' });

    // Advance to reading state
    vi.advanceTimersByTime(900);
    manager.tick();
    const output = manager.tick();

    // In reading state the output should use backendExpression over default
    expect(output.expression).toBe('curious');
  });
});
