'use client';

import React from 'react';
import { Sparkles, Heart } from 'lucide-react';
import { MascotCharacter } from '../Mascot';
import CompanionStage from '../companion/CompanionStage';

interface CompanionProfileCardProps {
  character: MascotCharacter;
  name: string;
  description: string;
  currentPresence: string; // presentation presence mood e.g. warm, quiet, thoughtful
  layoutMode: 'compact' | 'comfortable' | 'expanded';
  className?: string;
}

export default function CompanionProfileCard({
  character,
  name,
  description,
  currentPresence,
  layoutMode,
  className = ''
}: CompanionProfileCardProps) {
  return (
    <div 
      className={`glass-card border border-white/60 rounded-3xl p-5 shadow-sm max-w-sm mx-auto flex flex-col items-center text-center space-y-4 ${className}`}
    >
      {/* Platform Stage */}
      <CompanionStage
        character={character}
        expression="idle"
        layoutMode={layoutMode}
        mascotScale={1.0}
        className="w-full"
      />

      <div className="space-y-1">
        <h3 className="font-display font-black text-lg text-charcoal">
          {name}
        </h3>
        <span className="text-[9px] font-black uppercase tracking-widest text-primary-dark bg-primary/10 border border-primary/20 px-2 py-1 rounded-full inline-flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" />
          <span>Presence: {currentPresence}</span>
        </span>
      </div>

      <p className="text-xs text-charcoal/65 leading-relaxed">
        {description}
      </p>

      <div className="w-full pt-2 border-t border-charcoal/5 flex items-center justify-center gap-1.5 text-secondary-dark text-[10px] font-black uppercase tracking-wider select-none">
        <Heart className="w-3.5 h-3.5 fill-current animate-pulse" />
        <span>Your Companion Space</span>
      </div>
    </div>
  );
}
export type { CompanionProfileCardProps };
