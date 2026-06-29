'use client';

/**
 * useConversationPresence.ts
 *
 * A reusable React hook that exposes the current conversation presentation state
 * to any UI component that needs it.
 *
 * The rest of the UI must consume this hook exclusively — components must never
 * maintain their own local presentation state or derive it from network events.
 *
 * Usage:
 *   const { output, dispatch, preferences, setPreferences } = useConversationPresence()
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ConversationStateManager,
  ConversationPresentationOutput,
  ConversationEvent,
} from '@/components/conversation/ConversationStateManager';
import {
  PresentationPreferences,
  PresentationProfile,
  PacingProfile,
} from '@/components/conversation/conversation-config';

const TICK_INTERVAL_MS = 100;

export interface UseConversationPresenceReturn {
  /** Current fully-resolved presentation output */
  output: ConversationPresentationOutput;
  /** Dispatch a conversation lifecycle event to the manager */
  dispatch: (event: ConversationEvent) => void;
  /** Current user presentation preferences */
  preferences: PresentationPreferences;
  /** Update presentation preferences (persisted to localStorage) */
  setPreferences: (prefs: Partial<PresentationPreferences>) => void;
}

export function useConversationPresence(
  initialPreferences?: Partial<PresentationPreferences>
): UseConversationPresenceReturn {
  const [manager] = useState(() => {
    const mgr = new ConversationStateManager(initialPreferences);
    mgr.restorePreferences();
    mgr.applySystemAccessibility();
    return mgr;
  });

  const [output, setOutput] = useState<ConversationPresentationOutput>(() =>
    manager.tick()
  );

  const [preferences, setPreferencesState] = useState<PresentationPreferences>(() =>
    manager.getPreferences()
  );

  // Tick loop — drives the state machine forward every TICK_INTERVAL_MS
  useEffect(() => {
    const interval = setInterval(() => {
      setOutput(manager.tick());
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [manager]);

  // Stable dispatch callback
  const dispatch = useCallback(
    (event: ConversationEvent) => {
      manager.dispatch(event);
      // Immediately snapshot current output after dispatching
      setOutput(manager.tick());
    },
    [manager]
  );

  // Stable preferences setter
  const setPreferences = useCallback(
    (prefs: Partial<PresentationPreferences>) => {
      manager.setPreferences(prefs);
      manager.persistPreferences();
      setPreferencesState(manager.getPreferences());
    },
    [manager]
  );

  return { output, dispatch, preferences, setPreferences };
}
