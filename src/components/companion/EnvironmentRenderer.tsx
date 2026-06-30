'use client';

import React from 'react';
import { motion } from 'framer-motion';

export type EnvironmentTime = 'morning' | 'afternoon' | 'evening' | 'night';
export type UserPreference = 'light' | 'dark' | 'system';
export type AccessibilityProfile = 'standard' | 'reduced-motion';

export interface EnvironmentTheme {
  time: EnvironmentTime;
  userPreference: UserPreference;
  accessibility: AccessibilityProfile;
  mascotPalette: string; // e.g. green, violet, monochrome, brown, blue, orange, green, cyan, yellow
}

interface EnvironmentRendererProps {
  theme: EnvironmentTheme;
  children?: React.ReactNode;
}

const PALETTE_BG_COLORS: Record<string, string> = {
  green: 'rgba(143, 217, 168, 0.12)',
  violet: 'rgba(205, 180, 255, 0.12)',
  blue: 'rgba(213, 239, 255, 0.12)',
  monochrome: 'rgba(74, 74, 74, 0.08)',
  brown: 'rgba(234, 213, 195, 0.12)',
  orange: 'rgba(255, 175, 122, 0.12)',
  cyan: 'rgba(188, 227, 255, 0.12)',
  yellow: 'rgba(255, 224, 138, 0.12)'
};

import AmbientBackground from '@/components/motion/AmbientBackground';

export default function EnvironmentRenderer({ theme, children }: EnvironmentRendererProps) {
  const isReduced = theme.accessibility === 'reduced-motion';
  const isDark = theme.userPreference === 'dark';

  // Get background gradients according to time of day
  const getThemeGradient = () => {
    if (isDark || theme.time === 'night') {
      return 'from-[#0C0F1A] via-[#151B30] to-[#0A0D14]';
    }
    switch (theme.time) {
      case 'morning':
        return 'from-[#FFEAD1] via-[#FFF9F5] to-[#E3F2E9]';
      case 'afternoon':
        return 'from-[#E3F2FD] via-[#FFF9F5] to-[#FFF9F5]';
      case 'evening':
        return 'from-[#EDE7F6] via-[#FFF9F5] to-[#FFE0B2]';
      default:
        return 'from-[#FFF9F5] via-[#FFF9F5] to-[#FFF9F5]';
    }
  };

  const paletteColor = PALETTE_BG_COLORS[theme.mascotPalette] || PALETTE_BG_COLORS.green;

  return (
    <div 
      className={`fixed inset-0 w-full h-full overflow-hidden bg-gradient-to-br ${getThemeGradient()} transition-colors duration-1000 z-0`}
      style={{
        contentVisibility: 'auto'
      }}
    >
      {/* Dynamic Ambient Blur Nodes */}
      {!isReduced && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          {/* Main mascot palette accent circle */}
          <motion.div 
            className="absolute top-[20%] left-[10%] w-[320px] h-[320px] rounded-full blur-[110px]"
            style={{ backgroundColor: paletteColor }}
            animate={{
              x: [0, 40, 0],
              y: [0, -30, 0],
              scale: [1, 1.15, 1]
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
          {/* Second passive accent circle */}
          <motion.div 
            className="absolute bottom-[20%] right-[10%] w-[360px] h-[360px] rounded-full blur-[130px] opacity-75"
            style={{ backgroundColor: isDark ? 'rgba(107, 191, 138, 0.05)' : 'rgba(255, 224, 138, 0.08)' }}
            animate={{
              x: [0, -50, 0],
              y: [0, 40, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
        </div>
      )}

      {/* Ambient Motion Layer */}
      <AmbientBackground isReduced={isReduced} />

      {/* Decorative environment content wrapper */}
      <div className="relative w-full h-full flex flex-col z-10">
        {children}
      </div>
    </div>
  );
}
export type { EnvironmentRendererProps };
