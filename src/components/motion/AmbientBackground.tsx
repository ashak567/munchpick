'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';
import { useConversationPresence } from '@/hooks/useConversationPresence';

interface AmbientBackgroundProps {
  scene?: string;
  isReduced?: boolean;
}

interface CloverElement {
  id: number;
  type: 'clover-4leaf' | 'clover-leaf' | 'sparkle' | 'starlight' | 'soft-mote';
  zone: 'top-left' | 'top' | 'top-right' | 'middle-left' | 'middle' | 'middle-right' | 'bottom-left' | 'bottom' | 'bottom-right';
  left: number; // percentage (0 - 100)
  top: number; // percentage (0 - 100)
  size: number; // px
  scale: number;
  duration: number; // seconds
  delay: number; // seconds
  depth: number; // 0 (far) to 1 (near foreground)
  rotX: number; // deg
  rotY: number; // deg
  rotZ: number; // deg
  opacity: number;
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
}

// 3D Dimensional 4-leaf clover with gradient & highlights
function FourLeafClover3D({ color, glow }: { color: string; glow?: boolean }) {
  const filterId = glow ? 'glow-clover' : undefined;
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full drop-shadow-md"
      style={{
        filter: glow
          ? 'drop-shadow(0 0 8px rgba(143, 217, 168, 0.6)) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25))'
          : 'drop-shadow(0 4px 6px rgba(107, 191, 138, 0.25))'
      }}
    >
      <defs>
        <radialGradient id="clover-shading" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <stop offset="60%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </radialGradient>
      </defs>
      {/* Stem with 3D curve */}
      <path
        d="M 50 50 Q 52 74 64 88"
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Top Leaf with dimensional curvature */}
      <path
        d="M 50 50 Q 30 32 50 16 Q 70 32 50 50 Z"
        fill="url(#clover-shading)"
      />
      {/* Left Leaf */}
      <path
        d="M 50 50 Q 32 64 16 50 Q 32 30 50 50 Z"
        fill="url(#clover-shading)"
      />
      {/* Right Leaf */}
      <path
        d="M 50 50 Q 68 64 84 50 Q 68 30 50 50 Z"
        fill="url(#clover-shading)"
      />
      {/* Bottom Leaf */}
      <path
        d="M 50 50 Q 32 68 50 82 Q 68 68 50 50 Z"
        fill="url(#clover-shading)"
      />
      {/* Center 3D embossed bead */}
      <circle cx="50" cy="50" r="3.5" fill="#FFF9F5" opacity="0.8" />
    </svg>
  );
}

// 3D Single clover petal
function SingleLeaf3D({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 60"
      className="w-full h-full drop-shadow-sm"
      style={glow ? { filter: 'drop-shadow(0 0 5px rgba(168, 230, 190, 0.5))' } : undefined}
    >
      <defs>
        <linearGradient id="leaf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path
        d="M 30 52 C 14 42 8 22 28 10 C 48 20 44 42 30 52 Z"
        fill="url(#leaf-grad)"
      />
    </svg>
  );
}

// 3D Ambient sparkle / star
function Sparkle3D({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className="w-full h-full"
      style={glow ? { filter: 'drop-shadow(0 0 6px rgba(255, 224, 138, 0.8))' } : undefined}
    >
      <path
        d="M 20 0 Q 20 20 40 20 Q 20 20 20 40 Q 20 20 0 20 Q 20 20 20 0 Z"
        fill={color}
        opacity="0.9"
      />
    </svg>
  );
}

export default function AmbientBackground({ isReduced: propIsReduced }: AmbientBackgroundProps) {
  const { resolvedTheme } = useTheme();
  const { preferences } = useConversationPresence();
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const isReduced = propIsReduced ?? preferences.profile === 'reduced-motion';
  const isDark = resolvedTheme === 'dark';

  // 9-Zone organic distribution across the FULL 100vw x 100vh viewport
  const elements: CloverElement[] = useMemo(() => {
    const zones: Array<{
      name: CloverElement['zone'];
      xRange: [number, number];
      yRange: [number, number];
    }> = [
      { name: 'top-left', xRange: [2, 30], yRange: [3, 28] },
      { name: 'top', xRange: [35, 65], yRange: [2, 25] },
      { name: 'top-right', xRange: [70, 96], yRange: [3, 28] },
      { name: 'middle-left', xRange: [2, 28], yRange: [34, 62] },
      { name: 'middle', xRange: [38, 62], yRange: [36, 60] },
      { name: 'middle-right', xRange: [72, 96], yRange: [34, 62] },
      { name: 'bottom-left', xRange: [3, 30], yRange: [68, 94] },
      { name: 'bottom', xRange: [35, 65], yRange: [70, 95] },
      { name: 'bottom-right', xRange: [70, 96], yRange: [68, 94] }
    ];

    const types: CloverElement['type'][] = [
      'clover-4leaf',
      'sparkle',
      'clover-leaf',
      'soft-mote',
      'clover-4leaf',
      'starlight',
      'clover-leaf',
      'sparkle',
      'clover-4leaf'
    ];

    const items: CloverElement[] = [];
    let idCounter = 0;

    zones.forEach((zone, zoneIdx) => {
      // 2 to 3 elements per zone for rich yet uncrowded full-screen distribution (24 total)
      const count = zone.name === 'middle' ? 2 : 3;

      for (let i = 0; i < count; i++) {
        const id = idCounter++;
        const p1 = (Math.sin(id * 9.17 + zoneIdx * 3.7) + 1) / 2;
        const p2 = (Math.cos(id * 5.43 + zoneIdx * 2.3) + 1) / 2;
        const p3 = (Math.sin(id * 11.89) + 1) / 2;

        const left = zone.xRange[0] + p1 * (zone.xRange[1] - zone.xRange[0]);
        const top = zone.yRange[0] + p2 * (zone.yRange[1] - zone.yRange[0]);

        const type = types[(id + zoneIdx) % types.length];
        const isClover = type === 'clover-4leaf';
        const isLeaf = type === 'clover-leaf';

        const size = isClover
          ? 28 + Math.round(p3 * 18) // 28px - 46px
          : isLeaf
          ? 20 + Math.round(p3 * 14)
          : 12 + Math.round(p3 * 10);

        // Continuous natural motion: 8-18s for noticeable floating objects, 18-30s for slower background motes
        const duration = isClover || isLeaf ? 9 + p1 * 8 : 18 + p2 * 10;
        const delay = -(p3 * 25); // Negative delay so all particles are immediately alive
        const depth = 0.2 + p3 * 0.8; // 0.2 (far background) to 1.0 (foreground)

        const rotX = (p1 - 0.5) * 35;
        const rotY = (p2 - 0.5) * 40;
        const rotZ = (p3 - 0.5) * 60;

        const opacity = isDark ? 0.22 + p3 * 0.32 : 0.18 + p3 * 0.28;

        const hideOnMobile = id >= 10;
        const hideOnTablet = id >= 18;

        items.push({
          id,
          type,
          zone: zone.name,
          left,
          top,
          size,
          scale: 0.75 + p3 * 0.45,
          duration,
          delay,
          depth,
          rotX,
          rotY,
          rotZ,
          opacity,
          hideOnMobile,
          hideOnTablet
        });
      }
    });

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

  // 60-120fps Cursor Interaction & Parallax Engine via requestAnimationFrame (Zero React State Re-renders)
  useEffect(() => {
    if (isReduced) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;
    let rafId: number;

    const handlePointerMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const currentOffsets = new Map<number, { x: number; y: number }>();
    elements.forEach((el) => {
      currentOffsets.set(el.id, { x: 0, y: 0 });
    });

    const updateFrame = () => {
      // Smooth cursor interpolation (damping)
      mouseX += (targetMouseX - mouseX) * 0.08;
      mouseY += (targetMouseY - mouseY) * 0.08;

      const viewportWidth = window.innerWidth || 1920;
      const viewportHeight = window.innerHeight || 1080;

      // Parallax norm (-1 to 1)
      const normX = (mouseX / viewportWidth - 0.5) * 2;
      const normY = (mouseY / viewportHeight - 0.5) * 2;

      elements.forEach((el) => {
        const domNode = elementsRef.current.get(el.id);
        if (!domNode) return;

        // Base pixel position of element on screen
        const posX = (el.left / 100) * viewportWidth;
        const posY = (el.top / 100) * viewportHeight;

        // Proximity calculation
        const dx = mouseX - posX;
        const dy = mouseY - posY;
        const dist = Math.hypot(dx, dy);

        // Repel / Orbit zone: within 220px
        const repelRadius = 220;
        let repelX = 0;
        let repelY = 0;

        if (dist < repelRadius && dist > 1) {
          const force = (1 - dist / repelRadius) * (38 * el.depth);
          const angle = Math.atan2(dy, dx);
          // Gently push away & add slight organic orbit swirl
          repelX = -Math.cos(angle + 0.2) * force;
          repelY = -Math.sin(angle + 0.2) * force;
        }

        // Viewport Parallax: Depth-scaled (distant elements move 5-8px, foreground 18-25px)
        const parallaxX = -normX * (el.depth * 22);
        const parallaxY = -normY * (el.depth * 22);

        // Target combined offset
        const targetX = repelX + parallaxX;
        const targetY = repelY + parallaxY;

        const curr = currentOffsets.get(el.id) || { x: 0, y: 0 };
        curr.x += (targetX - curr.x) * 0.09;
        curr.y += (targetY - curr.y) * 0.09;
        currentOffsets.set(el.id, curr);

        // Apply 3D translate and tilt to the inner interactive wrapper
        domNode.style.transform = `translate3d(${curr.x.toFixed(2)}px, ${curr.y.toFixed(2)}px, 0px) rotateX(${(el.rotX + curr.y * 0.3).toFixed(1)}deg) rotateY(${(el.rotY - curr.x * 0.3).toFixed(1)}deg)`;
      });

      rafId = requestAnimationFrame(updateFrame);
    };

    rafId = requestAnimationFrame(updateFrame);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(rafId);
    };
  }, [elements, isReduced]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
      style={{
        width: '100vw',
        height: '100vh',
        perspective: '1200px',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Background radial gradient atmospheric veil */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 20% 25%, rgba(143, 217, 168, 0.05) 0%, transparent 60%), radial-gradient(ellipse at 80% 75%, rgba(205, 180, 255, 0.06) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 15% 20%, rgba(205, 180, 255, 0.14) 0%, transparent 50%), radial-gradient(ellipse at 85% 25%, rgba(143, 217, 168, 0.14) 0%, transparent 50%), radial-gradient(ellipse at 50% 85%, rgba(255, 224, 138, 0.14) 0%, transparent 50%)'
        }}
      />

      {/* 3D Floating Elements with Full Viewport Organic Distribution */}
      {elements.map((el) => {
        let node: React.ReactNode = null;
        if (el.type === 'clover-4leaf') {
          node = <FourLeafClover3D color={colors.clover} glow={isDark} />;
        } else if (el.type === 'clover-leaf') {
          node = <SingleLeaf3D color={colors.leaf} glow={isDark} />;
        } else if (el.type === 'sparkle' || el.type === 'starlight') {
          node = (
            <Sparkle3D
              color={el.type === 'starlight' ? colors.starlight : colors.sparkle}
              glow={isDark}
            />
          );
        } else {
          node = (
            <div
              className="w-full h-full rounded-full blur-[1px]"
              style={{
                backgroundColor: colors.mote,
                boxShadow: isDark ? `0 0 8px ${colors.mote}` : undefined
              }}
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
                transform: `rotate(${el.rotZ}deg) scale(${el.scale})`
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
              transform: `translate3d(0, 0, 0) scale(${el.scale})`,
              transformStyle: 'preserve-3d'
            }}
          >
            <div
              ref={(dom) => {
                if (dom) elementsRef.current.set(el.id, dom);
                else elementsRef.current.delete(el.id);
              }}
              style={{
                width: '100%',
                height: '100%',
                animation: `munch-ambient-sway ${el.duration * 0.75}s ease-in-out infinite alternate`,
                animationDelay: `${el.delay * 0.5}s`,
                transformStyle: 'preserve-3d'
              }}
            >
              {node}
            </div>
          </div>
        );
      })}

      {/* Embedded High-Performance CSS Keyframes with 3D rotations */}
      <style jsx global>{`
        @keyframes munch-ambient-float {
          0% {
            transform: translate3d(0px, 0px, 0px) rotateZ(0deg);
          }
          33% {
            transform: translate3d(18px, -24px, 12px) rotateZ(10deg);
          }
          66% {
            transform: translate3d(-14px, -42px, -8px) rotateZ(-8deg);
          }
          100% {
            transform: translate3d(0px, 0px, 0px) rotateZ(0deg);
          }
        }

        @keyframes munch-ambient-sway {
          0% {
            transform: scale(0.95) rotateZ(-6deg) rotateX(-5deg);
          }
          50% {
            transform: scale(1.05) rotateZ(8deg) rotateX(6deg);
          }
          100% {
            transform: scale(0.95) rotateZ(-6deg) rotateX(-5deg);
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
