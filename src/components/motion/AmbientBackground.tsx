'use client';

import React, { useMemo } from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useConversationPresence } from '@/hooks/useConversationPresence';

interface AmbientBackgroundProps {
  scene?: string;
  isReduced?: boolean;
}

interface CloverElement {
  id: number;
  type: 'clover-4leaf' | 'clover-leaf' | 'sparkle' | 'starlight' | 'soft-mote';
  left: number; // percentage (0 - 95)
  top: number; // percentage (0 - 95)
  size: number; // in px
  scale: number;
  duration: number; // seconds
  delay: number; // seconds
  driftX: number; // px
  driftY: number; // px
  rotationStart: number; // deg
  rotationEnd: number; // deg
  opacity: number;
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
}

// True 4-leaf clover SVG matching Munch brand
function FourLeafCloverSVG({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      style={glow ? { filter: 'drop-shadow(0 0 6px rgba(143, 217, 168, 0.45))' } : undefined}
    >
      {/* Stem */}
      <path
        d="M 50 50 Q 53 72 62 86"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* 4 Clover Leaves */}
      {/* Top leaf */}
      <path
        d="M 50 50 Q 30 34 50 18 Q 70 34 50 50 Z"
        fill={color}
        opacity="0.85"
      />
      {/* Left leaf */}
      <path
        d="M 50 50 Q 34 62 18 48 Q 34 32 50 50 Z"
        fill={color}
        opacity="0.8"
      />
      {/* Right leaf */}
      <path
        d="M 50 50 Q 66 62 82 48 Q 66 32 50 50 Z"
        fill={color}
        opacity="0.8"
      />
      {/* Bottom leaf */}
      <path
        d="M 50 50 Q 34 66 50 80 Q 66 66 50 50 Z"
        fill={color}
        opacity="0.85"
      />
      {/* Center vein accent */}
      <circle cx="50" cy="50" r="3.5" fill="#FFF9F5" opacity="0.6" />
    </svg>
  );
}

// Single clover leaf petal
function SingleLeafSVG({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      <path
        d="M 30 50 C 15 40 10 20 30 10 C 50 20 45 40 30 50 Z"
        fill={color}
        opacity="0.75"
      />
    </svg>
  );
}

// Ambient star sparkle
function SparkleSVG({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full">
      <path
        d="M 20 0 Q 20 20 40 20 Q 20 20 20 40 Q 20 20 0 20 Q 20 20 20 0 Z"
        fill={color}
        opacity="0.85"
      />
    </svg>
  );
}

export default function AmbientBackground({ isReduced: propIsReduced }: AmbientBackgroundProps) {
  const { resolvedTheme } = useTheme();
  const { preferences } = useConversationPresence();

  const isReduced = propIsReduced ?? (preferences.profile === 'reduced-motion');
  const isDark = resolvedTheme === 'dark';

  // Generate a deterministic, well-scattered grid across the FULL viewport
  const elements: CloverElement[] = useMemo(() => {
    // 20 elements distributed across 4 vertical zones & 5 horizontal zones
    const items: CloverElement[] = [];
    const types: CloverElement['type'][] = [
      'clover-4leaf',
      'sparkle',
      'clover-leaf',
      'clover-4leaf',
      'soft-mote',
      'sparkle',
      'clover-4leaf',
      'clover-leaf',
      'starlight',
      'clover-4leaf',
      'soft-mote',
      'clover-leaf',
      'sparkle',
      'clover-4leaf',
      'starlight',
      'clover-4leaf',
      'soft-mote',
      'clover-leaf',
      'clover-4leaf',
      'sparkle'
    ];

    const gridCols = 5;
    const gridRows = 4;
    let index = 0;

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const cellLeftMin = (c / gridCols) * 92 + 2;
        const cellTopMin = (r / gridRows) * 88 + 4;

        // Deterministic pseudo-random offset based on index
        const pseudoRand1 = Math.sin(index * 13.37) * 0.5 + 0.5;
        const pseudoRand2 = Math.cos(index * 7.19) * 0.5 + 0.5;
        const pseudoRand3 = Math.sin(index * 3.14) * 0.5 + 0.5;

        const left = cellLeftMin + pseudoRand1 * (85 / gridCols);
        const top = cellTopMin + pseudoRand2 * (80 / gridRows);

        const type = types[index % types.length];
        const isClover = type === 'clover-4leaf';
        const isLeaf = type === 'clover-leaf';

        const size = isClover
          ? 26 + Math.round(pseudoRand3 * 18) // 26px - 44px
          : isLeaf
          ? 18 + Math.round(pseudoRand3 * 14)
          : 12 + Math.round(pseudoRand3 * 10);

        const duration = 14 + pseudoRand1 * 14; // 14s - 28s
        const delay = -(pseudoRand2 * 20); // Negative delay so all particles are immediately alive
        const driftX = (pseudoRand1 - 0.5) * 45; // -22px to +22px
        const driftY = -35 - pseudoRand2 * 40; // -35px to -75px gentle upward float
        const rotationStart = (pseudoRand1 - 0.5) * 60;
        const rotationEnd = rotationStart + (pseudoRand3 > 0.5 ? 45 : -45);
        const opacity = isDark
          ? 0.18 + pseudoRand3 * 0.28
          : 0.16 + pseudoRand3 * 0.22;

        // Responsiveness tiering: keep top 7 on mobile, 14 on tablet, 20 on desktop
        const hideOnMobile = index >= 8;
        const hideOnTablet = index >= 14;

        items.push({
          id: index,
          type,
          left,
          top,
          size,
          scale: 0.75 + pseudoRand3 * 0.45,
          duration,
          delay,
          driftX,
          driftY,
          rotationStart,
          rotationEnd,
          opacity,
          hideOnMobile,
          hideOnTablet
        });

        index++;
      }
    }

    return items;
  }, [isDark]);

  // Color palettes tailored to Day vs Night
  const colors = useMemo(() => {
    if (isDark) {
      return {
        clover: '#8FD9A8', // glowing mint green
        leaf: '#A8E6BE',
        sparkle: '#FFE08A', // gentle starlight yellow
        starlight: '#CDB4FF', // lavender nebula glow
        mote: '#79C998'
      };
    }
    return {
      clover: '#6BBF8A', // organic fresh grass green
      leaf: '#8FD9A8',
      sparkle: '#E6C46B', // sunlit golden glimmer
      starlight: '#B899F5',
      mote: '#8FD9A8'
    };
  }, [isDark]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* Background radial gradient veil */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 20% 30%, rgba(143, 217, 168, 0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(205, 180, 255, 0.05) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 15% 20%, rgba(205, 180, 255, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 85% 25%, rgba(143, 217, 168, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 85%, rgba(255, 224, 138, 0.12) 0%, transparent 50%)'
        }}
      />

      {/* Full-viewport floating elements */}
      {elements.map((el) => {
        let node: React.ReactNode = null;
        if (el.type === 'clover-4leaf') {
          node = <FourLeafCloverSVG color={colors.clover} glow={isDark} />;
        } else if (el.type === 'clover-leaf') {
          node = <SingleLeafSVG color={colors.leaf} />;
        } else if (el.type === 'sparkle' || el.type === 'starlight') {
          node = <SparkleSVG color={el.type === 'starlight' ? colors.starlight : colors.sparkle} />;
        } else {
          node = (
            <div
              className="w-full h-full rounded-full blur-[1px]"
              style={{ backgroundColor: colors.mote }}
            />
          );
        }

        const responsiveClass = el.hideOnMobile
          ? 'hidden md:block'
          : el.hideOnTablet
          ? 'hidden lg:block'
          : 'block';

        if (isReduced) {
          // Subtle static decoration without motion
          return (
            <div
              key={el.id}
              className={`absolute ${responsiveClass}`}
              style={{
                left: `${el.left}%`,
                top: `${el.top}%`,
                width: `${el.size}px`,
                height: `${el.size}px`,
                opacity: el.opacity * 0.6,
                transform: `rotate(${el.rotationStart}deg) scale(${el.scale})`
              }}
            >
              {node}
            </div>
          );
        }

        return (
          <div
            key={el.id}
            className={`absolute ${responsiveClass} will-change-transform`}
            style={{
              left: `${el.left}%`,
              top: `${el.top}%`,
              width: `${el.size}px`,
              height: `${el.size}px`,
              opacity: el.opacity,
              animation: `munch-ambient-float ${el.duration}s ease-in-out infinite`,
              animationDelay: `${el.delay}s`,
              transform: `translate3d(0, 0, 0) scale(${el.scale})`
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                animation: `munch-ambient-sway ${el.duration * 0.75}s ease-in-out infinite alternate`,
                animationDelay: `${el.delay * 0.5}s`
              }}
            >
              {node}
            </div>
          </div>
        );
      })}

      {/* Embedded High-Performance CSS Keyframes */}
      <style jsx global>{`
        @keyframes munch-ambient-float {
          0% {
            transform: translate3d(0px, 0px, 0px) rotate(0deg);
          }
          33% {
            transform: translate3d(14px, -18px, 0px) rotate(8deg);
          }
          66% {
            transform: translate3d(-10px, -32px, 0px) rotate(-6deg);
          }
          100% {
            transform: translate3d(0px, 0px, 0px) rotate(0deg);
          }
        }

        @keyframes munch-ambient-sway {
          0% {
            transform: scale(0.96) rotate(-4deg);
          }
          50% {
            transform: scale(1.04) rotate(6deg);
          }
          100% {
            transform: scale(0.96) rotate(-4deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .will-change-transform {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
