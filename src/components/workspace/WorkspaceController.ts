'use client';

import { useState, useEffect, useCallback } from 'react';

export type WorkspacePage = 'home' | 'journal' | 'companion' | 'settings';

export interface WorkspaceControllerState {
  activePage: WorkspacePage;
  isSidebarCollapsed: boolean;
  isMobileDrawerOpen: boolean;
}

const SIDEBAR_COLLAPSE_KEY = 'munch_sidebar_collapsed';

export function useWorkspaceController(initialPage: WorkspacePage = 'home') {
  const [activePage, setActivePageState] = useState<WorkspacePage>(initialPage);
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Restore sidebar collapse state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      if (stored) {
        setIsSidebarCollapsedState(JSON.parse(stored) === true);
      }
    } catch {
      // localStorage corrupt or unavailable
    }
  }, []);

  const setActivePage = useCallback((page: WorkspacePage) => {
    setActivePageState(page);
    // Automatically close mobile drawer after navigation transition
    setIsMobileDrawerOpen(false);
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsedState(collapsed);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(collapsed));
      } catch {
        // Silently catch localStorage writes failures
      }
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!isSidebarCollapsed);
  }, [isSidebarCollapsed, setSidebarCollapsed]);

  const toggleMobileDrawer = useCallback(() => {
    setIsMobileDrawerOpen(prev => !prev);
  }, []);

  return {
    activePage,
    setActivePage,
    isSidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    toggleMobileDrawer
  };
}
export type UseWorkspaceControllerReturn = ReturnType<typeof useWorkspaceController>;
export { SIDEBAR_COLLAPSE_KEY };
