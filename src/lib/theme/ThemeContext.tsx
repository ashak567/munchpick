'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  userId: string | null;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Calculates whether browser-local time is currently light (06:00 - 17:59:59)
 * or dark (18:00 - 05:59:59).
 */
export function getAutoTimeResolvedTheme(): ResolvedTheme {
  const now = new Date();
  const hours = now.getHours();
  // 06:00 AM (inclusive) to 06:00 PM (exclusive) -> LIGHT
  if (hours >= 6 && hours < 18) {
    return 'light';
  }
  return 'dark';
}

/**
 * Calculates milliseconds until the next 6:00 AM or 6:00 PM boundary.
 */
export function getMsUntilNextThemeThreshold(): number {
  const now = new Date();
  const next = new Date(now);

  const hours = now.getHours();
  if (hours < 6) {
    // Next threshold is 6:00 AM today
    next.setHours(6, 0, 0, 0);
  } else if (hours < 18) {
    // Next threshold is 6:00 PM (18:00) today
    next.setHours(18, 0, 0, 0);
  } else {
    // Next threshold is 6:00 AM tomorrow
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }

  const diff = next.getTime() - now.getTime();
  // Ensure minimum positive duration with slight buffer (e.g. 500ms)
  return Math.max(diff + 500, 1000);
}

function getStorageKey(userId?: string | null): string {
  return `munch_theme_preference_${userId || 'guest'}`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [currentTimeTheme, setCurrentTimeTheme] = useState<ResolvedTheme>(getAutoTimeResolvedTheme);

  // 1. Resolve user ID for user-isolated preference persistence
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const currentId = user ? user.id : 'guest';
      setUserId(currentId);

      // Load saved preference for this specific user
      try {
        const saved = localStorage.getItem(getStorageKey(currentId));
        if (saved === 'light' || saved === 'dark' || saved === 'auto') {
          setThemeModeState(saved as ThemeMode);
        } else {
          setThemeModeState('auto');
        }
      } catch {
        setThemeModeState('auto');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newId = session?.user ? session.user.id : 'guest';
      setUserId(newId);
      try {
        const saved = localStorage.getItem(getStorageKey(newId));
        if (saved === 'light' || saved === 'dark' || saved === 'auto') {
          setThemeModeState(saved as ThemeMode);
        } else {
          setThemeModeState('auto');
        }
      } catch {
        setThemeModeState('auto');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Real-time next-threshold scheduler & event triggers
  useEffect(() => {
    const updateTimeTheme = () => {
      const nextTheme = getAutoTimeResolvedTheme();
      setCurrentTimeTheme((prev) => (prev !== nextTheme ? nextTheme : prev));
    };

    let timerId: NodeJS.Timeout;
    const scheduleNext = () => {
      const ms = getMsUntilNextThemeThreshold();
      timerId = setTimeout(() => {
        updateTimeTheme();
        scheduleNext();
      }, ms);
    };

    scheduleNext();

    // Event listeners to handle tab visibility, focus, wake from sleep, system clock shift
    const handleVisibilityOrFocus = () => {
      updateTimeTheme();
    };

    // Periodic safety check every 60s (zero performance overhead)
    const intervalId = setInterval(updateTimeTheme, 60000);

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);

    return () => {
      clearTimeout(timerId);
      clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
    };
  }, []);

  // 3. Resolve active effective theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (themeMode === 'light') return 'light';
    if (themeMode === 'dark') return 'dark';
    return currentTimeTheme;
  }, [themeMode, currentTimeTheme]);

  // 4. Synchronize DOM classes and CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (resolvedTheme === 'dark') {
      root.classList.add('dark', 'dark-theme');
      body.classList.add('dark', 'dark-theme');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark', 'dark-theme');
      body.classList.remove('dark', 'dark-theme');
      root.style.colorScheme = 'light';
    }
  }, [resolvedTheme]);

  // 5. Update and persist user preference
  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setThemeModeState(mode);
      try {
        localStorage.setItem(getStorageKey(userId), mode);
      } catch {
        // localStorage errors ignored gracefully
      }
    },
    [userId]
  );

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
      userId
    }),
    [themeMode, resolvedTheme, setThemeMode, userId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside provider
    const autoTheme = getAutoTimeResolvedTheme();
    return {
      themeMode: 'auto',
      resolvedTheme: autoTheme,
      setThemeMode: () => {},
      userId: null
    };
  }
  return context;
}
