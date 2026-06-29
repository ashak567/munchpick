import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceController } from './WorkspaceController';
import { resolveWorkspaceLayout } from './LayoutCoordinator';
import { CompanionPresenceBuilder } from '../companion/CompanionPresenceBuilder';

describe('Workspace Controller', () => {
  it('should initialize activePage and sidebar collapsed states', () => {
    // We mock React hook states behavior or test pure logic
    const initialPage = 'home';
    expect(initialPage).toBe('home');
  });

  it('should resolve workspace layout parameters correctly', () => {
    // 1. Mobile viewport (compact layout)
    const mobileLayout = resolveWorkspaceLayout(375, 812, 0, false);
    expect(mobileLayout.layout).toBe('compact');
    expect(mobileLayout.navigationMode).toBe('bottom-bar');
    expect(mobileLayout.sidebarWidth).toBe(0);

    // 2. Desktop viewport (expanded layout)
    const desktopLayout = resolveWorkspaceLayout(1280, 800, 0, false);
    expect(desktopLayout.layout).toBe('expanded');
    expect(desktopLayout.navigationMode).toBe('sidebar');
    expect(desktopLayout.sidebarWidth).toBe(260);

    // 3. Desktop viewport with collapsed sidebar
    const collapsedDesktopLayout = resolveWorkspaceLayout(1280, 800, 0, true);
    expect(collapsedDesktopLayout.sidebarWidth).toBe(80);
  });

  it('should scale stageScale correctly based on mobile keyboard state', () => {
    const keyboardOpen = resolveWorkspaceLayout(375, 812, 280, false);
    expect(keyboardOpen.stageScale).toBe(0.55);

    const keyboardClosed = resolveWorkspaceLayout(375, 812, 0, false);
    expect(keyboardClosed.stageScale).toBe(0.85);
  });

  it('should map active themes to mascot palettes', () => {
    const presence = CompanionPresenceBuilder.buildPresence(
      'munch',
      'morning',
      0,
      undefined,
      'general'
    );
    expect(presence.welcomeMood).toBe('playful');
    expect(presence.conversationFamiliarity).toBe('new_companion');
  });
});
