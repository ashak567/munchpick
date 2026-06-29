'use client';

import { useState, useEffect } from 'react';

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ResponsiveLayout {
  mode: 'compact' | 'comfortable' | 'expanded';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  mascotScale: number;
  chatWidth: number;
  stageHeight: number;
  safeAreaInsets: Insets;
  keyboardAware: boolean;
  keyboardHeight: number;
  orientation: 'portrait' | 'landscape';
  viewportWidth: number;
  viewportHeight: number;
}

export function resolveLayout(width: number, height: number, keyboardHeight: number): ResponsiveLayout {
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  let mode: 'compact' | 'comfortable' | 'expanded' = 'comfortable';
  if (isMobile) {
    mode = 'compact';
  } else if (isDesktop) {
    mode = 'expanded';
  }

  const orientation = width > height ? 'landscape' : 'portrait';

  // Mascot scale factor based on viewport size & keyboard presence
  let mascotScale = 1.0;
  if (mode === 'compact') {
    mascotScale = keyboardHeight > 0 ? 0.55 : 0.85;
  } else if (mode === 'comfortable') {
    mascotScale = 1.0;
  } else {
    mascotScale = 1.25;
  }

  // Safe area fallback insets
  const safeAreaInsets: Insets = {
    top: isMobile ? 44 : 0,
    bottom: isMobile ? 34 : 0,
    left: 0,
    right: 0
  };

  // Chat container width targets
  let chatWidth = 440; // compact
  if (mode === 'comfortable') {
    chatWidth = 560;
  } else if (mode === 'expanded') {
    chatWidth = 680;
  }

  // Stage height allocations
  let stageHeight = 120;
  if (mode === 'comfortable') {
    stageHeight = 180;
  } else if (mode === 'expanded') {
    stageHeight = 240;
  }

  return {
    mode,
    isMobile,
    isTablet,
    isDesktop,
    mascotScale,
    chatWidth,
    stageHeight,
    safeAreaInsets,
    keyboardAware: keyboardHeight > 0,
    keyboardHeight,
    orientation,
    viewportWidth: width,
    viewportHeight: height
  };
}

export function useResponsiveLayout(): ResponsiveLayout {
  const [layout, setLayout] = useState<ResponsiveLayout>(() => {
    // Return dummy default for Server-Side Rendering
    return {
      mode: 'comfortable',
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      mascotScale: 1.0,
      chatWidth: 560,
      stageHeight: 180,
      safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
      keyboardAware: false,
      keyboardHeight: 0,
      orientation: 'portrait',
      viewportWidth: 1024,
      viewportHeight: 768
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      // Calculate keyboard height using visualViewport if supported
      let kh = 0;
      if (window.visualViewport) {
        kh = Math.max(0, h - window.visualViewport.height);
      }

      setLayout(resolveLayout(w, h, kh));
    };

    // Initial run
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
  }, []);

  return layout;
}
