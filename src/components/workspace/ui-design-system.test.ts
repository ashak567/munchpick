import { describe, it, expect } from 'vitest';
import { SPRINGS, TRANSITIONS, MOTION_SYSTEM_VARIANTS } from './motion-system';
import { SURFACE_SYSTEM } from './surface-system';
import { resolveWorkspaceLayout } from './ResponsiveCoordinator';

describe('UI Motion Design System', () => {
  it('should define and resolve spring stiffness/damping pairs', () => {
    expect(SPRINGS.snap.stiffness).toBe(380);
    expect(SPRINGS.smooth.damping).toBe(24);
    expect(SPRINGS.loose.stiffness).toBe(120);
  });

  it('should expose standardized transition durations', () => {
    expect(TRANSITIONS.tiny.duration).toBe(0.12);
    expect(TRANSITIONS.small.duration).toBe(0.2);
    expect(TRANSITIONS.medium.duration).toBe(0.35);
    expect(TRANSITIONS.large.duration).toBe(0.5);
  });

  it('should register valid Framer Motion variants', () => {
    expect(MOTION_SYSTEM_VARIANTS.pageFade).toBeDefined();
    expect(MOTION_SYSTEM_VARIANTS.sidebarSlide).toBeDefined();
    expect(MOTION_SYSTEM_VARIANTS.messageEntrance).toBeDefined();
    expect(MOTION_SYSTEM_VARIANTS.bubbleTyping).toBeDefined();
  });
});

describe('UI Surface Design System', () => {
  it('should configure uniform border-radius options', () => {
    expect(SURFACE_SYSTEM.radius.sm).toBe('8px');
    expect(SURFACE_SYSTEM.radius.lg).toBe('16px');
    expect(SURFACE_SYSTEM.radius.xxl).toBe('28px');
  });

  it('should define standard backdrop blurs', () => {
    expect(SURFACE_SYSTEM.blur.none).toBe('blur(0px)');
    expect(SURFACE_SYSTEM.blur.low).toBe('blur(6px)');
    expect(SURFACE_SYSTEM.blur.medium).toBe('blur(12px)');
    expect(SURFACE_SYSTEM.blur.high).toBe('blur(20px)');
  });

  it('should maintain distinct glass surface opacity settings', () => {
    expect(SURFACE_SYSTEM.glass.panel.backdropBlur).toBe('blur(20px)');
    expect(SURFACE_SYSTEM.glass.card.backdropBlur).toBe('blur(12px)');
    expect(SURFACE_SYSTEM.glass.composer.backdropBlur).toBe('blur(8px)');
  });
});

describe('Responsive Coordinator Breakpoints', () => {
  it('should classify screen resolution widths correctly', () => {
    const compact = resolveWorkspaceLayout(320, 568, 0, false);
    expect(compact.layout).toBe('compact');
    expect(compact.navigationMode).toBe('bottom-bar');

    const comfortable = resolveWorkspaceLayout(768, 1024, 0, false);
    expect(comfortable.layout).toBe('comfortable');

    const expanded = resolveWorkspaceLayout(1440, 900, 0, false);
    expect(expanded.layout).toBe('expanded');
    expect(expanded.sidebarWidth).toBe(260);
  });

  it('should adjust mascot stage scale to fit virtual keyboards on mobile viewports', () => {
    const closed = resolveWorkspaceLayout(360, 640, 0, false);
    expect(closed.stageScale).toBe(0.85);

    const open = resolveWorkspaceLayout(360, 640, 240, false);
    expect(open.stageScale).toBe(0.55);
  });
});
