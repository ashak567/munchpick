'use client';

import { useState, useEffect } from 'react';
import { Insets } from '../companion/LayoutManager';

export interface WorkspaceLayoutContext {
  layout: 'compact' | 'comfortable' | 'expanded';
  safeArea: Insets;
  sidebarWidth: number;
  keyboardHeight: number;
  orientation: 'portrait' | 'landscape';
  viewport: { width: number; height: number };
  stageScale: number;
  navigationMode: 'sidebar' | 'bottom-bar';
  contentPadding: string;
}

export function resolveWorkspaceLayout(
  width: number,
  height: number,
  keyboardHeight: number,
  isSidebarCollapsed: boolean
): WorkspaceLayoutContext {
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  let layout: 'compact' | 'comfortable' | 'expanded' = 'comfortable';
  if (isMobile) {
    layout = 'compact';
  } else if (isDesktop) {
    layout = 'expanded';
  }

  const orientation = width > height ? 'landscape' : 'portrait';
  const navigationMode = layout === 'compact' ? 'bottom-bar' : 'sidebar';

  let sidebarWidth = 0;
  if (layout !== 'compact') {
    sidebarWidth = isSidebarCollapsed ? 80 : 260;
  }

  const safeArea: Insets = {
    top: isMobile ? 44 : 0,
    bottom: isMobile ? 34 : 0,
    left: 0,
    right: 0
  };

  let stageScale = 1.0;
  if (layout === 'compact') {
    stageScale = keyboardHeight > 0 ? 0.55 : 0.85;
  } else if (layout === 'comfortable') {
    stageScale = 1.0;
  } else {
    stageScale = 1.25;
  }

  let contentPadding = 'p-4';
  if (layout === 'comfortable') {
    contentPadding = 'p-6';
  } else if (layout === 'expanded') {
    contentPadding = 'p-8';
  }

  return {
    layout,
    safeArea,
    sidebarWidth,
    keyboardHeight,
    orientation,
    viewport: { width, height },
    stageScale,
    navigationMode,
    contentPadding
  };
}

export function useResponsiveCoordinator(isSidebarCollapsed: boolean): WorkspaceLayoutContext {
  const [context, setContext] = useState<WorkspaceLayoutContext>(() => {
    return {
      layout: 'comfortable',
      safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
      sidebarWidth: 260,
      keyboardHeight: 0,
      orientation: 'portrait',
      viewport: { width: 1024, height: 768 },
      stageScale: 1.0,
      navigationMode: 'sidebar',
      contentPadding: 'p-6'
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      let kh = 0;
      if (window.visualViewport) {
        kh = Math.max(0, h - window.visualViewport.height);
      }

      setContext(resolveWorkspaceLayout(w, h, kh, isSidebarCollapsed));
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [isSidebarCollapsed]);

  return context;
}
