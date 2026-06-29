import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveLayout } from './LayoutManager';
import { CompanionPresenceBuilder } from './CompanionPresenceBuilder';
import { PresenceExperienceManager } from './PresenceExperienceManager';

describe('Responsive Layout Manager', () => {
  it('should resolve compact layout for mobile viewports', () => {
    const layout = resolveLayout(375, 667, 0);
    expect(layout.mode).toBe('compact');
    expect(layout.isMobile).toBe(true);
    expect(layout.isTablet).toBe(false);
    expect(layout.isDesktop).toBe(false);
    expect(layout.mascotScale).toBe(0.85); // base mobile scale
  });

  it('should shrink mascot scale on mobile when keyboard is open', () => {
    const layout = resolveLayout(375, 667, 280);
    expect(layout.mode).toBe('compact');
    expect(layout.mascotScale).toBe(0.55); // shrunken mobile scale
    expect(layout.keyboardAware).toBe(true);
  });

  it('should resolve comfortable layout for tablet viewports', () => {
    const layout = resolveLayout(768, 1024, 0);
    expect(layout.mode).toBe('comfortable');
    expect(layout.isMobile).toBe(false);
    expect(layout.isTablet).toBe(true);
    expect(layout.isDesktop).toBe(false);
    expect(layout.mascotScale).toBe(1.0);
  });

  it('should resolve expanded layout for desktop viewports', () => {
    const layout = resolveLayout(1280, 800, 0);
    expect(layout.mode).toBe('expanded');
    expect(layout.isMobile).toBe(false);
    expect(layout.isTablet).toBe(false);
    expect(layout.isDesktop).toBe(true);
    expect(layout.mascotScale).toBe(1.25);
  });
});

describe('Companion Presence Builder', () => {
  it('should build presence output with returning familiarity', () => {
    const output = CompanionPresenceBuilder.buildPresence(
      'munch',
      'afternoon',
      0, // first minute
      120, // 2 hours ago
      'career_growth'
    );
    expect(output.shouldGreet).toBe(true);
    expect(output.conversationFamiliarity).toBe('recent_conversation');
    expect(output.referencePreviousConversation).toBe(true);
  });

  it('should build quiet mood at night', () => {
    const output = CompanionPresenceBuilder.buildPresence(
      'pandy',
      'night',
      10, // session ongoing
      undefined, // first session
      'general'
    );
    expect(output.shouldGreet).toBe(false);
    expect(output.welcomeMood).toBe('quiet');
    expect(output.conversationFamiliarity).toBe('new_companion');
  });
});

describe('Presence Experience Manager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should rotate ambient sequence steps for munch', () => {
    const manager = new PresenceExperienceManager();
    manager.setTabActiveState(true);

    const step1 = manager.tickAmbientSequence('munch');
    expect(step1).toBe('none'); // not elapsed yet

    vi.advanceTimersByTime(8500);
    const step2 = manager.tickAmbientSequence('munch');
    expect(step2).toBe('tilt'); // first step in munch sequence

    vi.advanceTimersByTime(8500);
    const step3 = manager.tickAmbientSequence('munch');
    expect(step3).toBe('blink');
  });

  it('should pause ambient scheduler loop when browser tab is inactive', () => {
    const manager = new PresenceExperienceManager();
    manager.setTabActiveState(false); // Inactive browser tab

    vi.advanceTimersByTime(9000);
    const step = manager.tickAmbientSequence('munch');
    expect(step).toBe('none'); // Paused
  });

  it('should track session interaction milestones correctly', () => {
    const manager = new PresenceExperienceManager();
    
    // Simulate first conversation sending
    const state1 = manager.handleSessionInteraction('message_sent');
    expect(state1).toBe('firstConversation');

    // Simulate returning after 40 minutes
    const state2 = manager.handleSessionInteraction('active_check');
    expect(state2).toBe('firstConversation'); // baseline not changed unless elapsed
  });
});
