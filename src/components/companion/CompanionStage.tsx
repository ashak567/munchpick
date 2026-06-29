'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Mascot, { MascotCharacter, AttentionTarget } from '../Mascot';

interface CompanionStageProps {
  character: MascotCharacter;
  expression: string;
  attentionTarget?: AttentionTarget;
  pupilOffsets?: { x: number; y: number };
  microReaction?: import('../mascot-config').MicroReaction;
  animationBudget?: import('../mascot-config').AnimationBudget;
  layoutMode: 'compact' | 'comfortable' | 'expanded';
  mascotScale: number;
  className?: string;
}

export default function CompanionStage({
  character,
  expression,
  attentionTarget = 'user',
  pupilOffsets = { x: 0, y: 0 },
  microReaction = 'none',
  animationBudget = 'medium',
  layoutMode,
  mascotScale,
  className = ''
}: CompanionStageProps) {
  const isReduced = animationBudget === 'reduced-motion';

  // Mascot size mapping per layout mode
  const getMascotSize = () => {
    switch (layoutMode) {
      case 'compact':
        return 72; // 72px on mobile
      case 'comfortable':
        return 100; // 100px on tablet
      case 'expanded':
      default:
        return 140; // 140px on desktop
    }
  };

  const baseSize = getMascotSize();
  const scaledSize = baseSize * mascotScale;

  return (
    <div 
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{
        height: layoutMode === 'expanded' ? '280px' : 'auto',
        perspective: 800
      }}
    >
      {/* Dynamic Companion Stage Platform Shadow Overlay */}
      <motion.div 
        className="absolute bottom-2 w-3/4 max-w-[120px] h-3 bg-[#4A4A4A]/8 rounded-full blur-[6px] pointer-events-none"
        animate={isReduced ? {} : {
          scaleX: [1, 1.12, 1],
          opacity: [0.35, 0.22, 0.35]
        }}
        transition={{
          duration: 5.0,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* Mascot Placement Wrapper with Floating Spacers */}
      <motion.div
        className="relative z-10 flex items-center justify-center filter drop-shadow-md"
        animate={isReduced ? {} : {
          y: [0, -4, 0]
        }}
        transition={{
          duration: 6.0,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      >
        <Mascot
          character={character}
          expression={expression}
          attentionTarget={attentionTarget}
          pupilOffsets={pupilOffsets}
          microReaction={microReaction}
          animationBudget={animationBudget}
          size={scaledSize}
        />
      </motion.div>
    </div>
  );
}
export type { CompanionStageProps };
