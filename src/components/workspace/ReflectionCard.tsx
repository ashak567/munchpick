'use client';

import React from 'react';
import { BookOpen, Sparkles, PlusCircle } from 'lucide-react';
import { MotionTap } from '../motion/MotionWrapper';

interface ReflectionCardProps {
  className?: string;
  onLaunch?: (type: string) => void;
}

export default function ReflectionCard({
  className = '',
  onLaunch
}: ReflectionCardProps) {
  const launcherTabs = [
    { id: 'journal', label: 'Journal Log', emoji: '📖' },
    { id: 'mood', label: 'Mood Track', emoji: '✨' },
    { id: 'dream', label: 'Dream Log', emoji: '🌙' },
    { id: 'thoughts', label: 'Quick Notes', emoji: '📝' }
  ];

  return (
    <div 
      className={`glass-panel border border-white/50 rounded-3xl p-6 shadow-sm w-full max-w-sm mx-auto space-y-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/20 text-primary-dark rounded-2xl">
          <BookOpen className="w-5 h-5 text-primary-dark" />
        </div>
        <div>
          <h3 className="font-display font-black text-sm text-charcoal leading-tight">
            Reflection Space
          </h3>
          <span className="text-[9px] text-charcoal/40 font-bold uppercase tracking-wider block mt-0.5">
            Log your inner reflections
          </span>
        </div>
      </div>

      <p className="text-xs text-charcoal/65 leading-relaxed">
        Record how your heart feels, log dynamic dreams, or capture quiet moments. This space will keep your pages safe.
      </p>

      {/* Grid of Launcher Options */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        {launcherTabs.map((tab) => (
          <MotionTap key={tab.id}>
            <button
              onClick={() => onLaunch?.(tab.id)}
              className="w-full p-3 rounded-2xl border border-charcoal/5 bg-white/70 hover:bg-white hover:border-primary/20 text-left transition-all cursor-pointer flex items-center justify-between group shadow-3xs"
              style={{ minHeight: '44px' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm select-none">{tab.emoji}</span>
                <span className="text-[10px] font-bold text-charcoal group-hover:text-primary-dark transition-colors">
                  {tab.label}
                </span>
              </div>
              <PlusCircle className="w-3.5 h-3.5 text-charcoal/20 group-hover:text-primary-dark transition-all" />
            </button>
          </MotionTap>
        ))}
      </div>
    </div>
  );
}
export type { ReflectionCardProps };
