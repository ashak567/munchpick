import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAutoTimeResolvedTheme,
  getMsUntilNextThemeThreshold
} from './ThemeContext';

describe('Adaptive Day/Night Theme Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves LIGHT mode between 06:00 AM and 05:59:59 PM', () => {
    // 06:00 AM
    vi.setSystemTime(new Date('2026-08-30T06:00:00'));
    expect(getAutoTimeResolvedTheme()).toBe('light');

    // 12:00 PM
    vi.setSystemTime(new Date('2026-08-30T12:00:00'));
    expect(getAutoTimeResolvedTheme()).toBe('light');

    // 05:59:59 PM (17:59:59)
    vi.setSystemTime(new Date('2026-08-30T17:59:59'));
    expect(getAutoTimeResolvedTheme()).toBe('light');
  });

  it('resolves DARK mode between 06:00 PM and 05:59:59 AM', () => {
    // 06:00 PM (18:00)
    vi.setSystemTime(new Date('2026-08-30T18:00:00'));
    expect(getAutoTimeResolvedTheme()).toBe('dark');

    // 11:30 PM (23:30)
    vi.setSystemTime(new Date('2026-08-30T23:30:00'));
    expect(getAutoTimeResolvedTheme()).toBe('dark');

    // 02:00 AM
    vi.setSystemTime(new Date('2026-08-30T02:00:00'));
    expect(getAutoTimeResolvedTheme()).toBe('dark');

    // 05:59:59 AM
    vi.setSystemTime(new Date('2026-08-30T05:59:59'));
    expect(getAutoTimeResolvedTheme()).toBe('dark');
  });

  it('calculates exact milliseconds until next theme transition boundary', () => {
    // At 5:59 PM (17:59:00), exactly 60 seconds until 6:00 PM
    vi.setSystemTime(new Date('2026-08-30T17:59:00'));
    const msTo6PM = getMsUntilNextThemeThreshold();
    // 60,000 ms + 500ms safety buffer = ~60,500ms
    expect(msTo6PM).toBeGreaterThanOrEqual(60000);
    expect(msTo6PM).toBeLessThanOrEqual(61000);

    // At 5:59 AM (05:59:00), exactly 60 seconds until 6:00 AM
    vi.setSystemTime(new Date('2026-08-30T05:59:00'));
    const msTo6AM = getMsUntilNextThemeThreshold();
    expect(msTo6AM).toBeGreaterThanOrEqual(60000);
    expect(msTo6AM).toBeLessThanOrEqual(61000);
  });
});
