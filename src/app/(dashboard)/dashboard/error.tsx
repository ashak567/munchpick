'use client';

import React, { useEffect } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { SURFACE_SYSTEM } from '@/components/workspace/surface-system';

interface DashboardErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardErrorBoundary({
  error,
  reset
}: DashboardErrorBoundaryProps) {
  useEffect(() => {
    // Log the error to production monitoring console
    console.error('[Dashboard Error Boundary] Caught rendering failure:', error);
  }, [error]);

  return (
    <div className="flex-grow flex flex-col items-center justify-center min-h-[60dvh] px-4 text-center select-none z-10">
      <div 
        className="glass-panel border border-white/50 rounded-3xl p-8 max-w-sm mx-auto space-y-6 shadow-lg"
        style={{
          borderRadius: SURFACE_SYSTEM.radius.xl,
          boxShadow: SURFACE_SYSTEM.shadows.lg
        }}
      >
        <div className="mx-auto w-12 h-12 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h2 className="font-display font-black text-lg text-charcoal">
            Quiet Interruption
          </h2>
          <p className="text-xs text-charcoal/65 leading-relaxed">
            Munch encountered a small bump in the path. Don't worry, your conversation and reflections are safe.
          </p>
        </div>

        <button
          onClick={() => reset()}
          className="w-full py-3.5 bg-primary hover:bg-primary-dark text-primary-dark font-bold rounded-2xl border border-primary-dark flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-3xs"
          style={{ minHeight: '44px' }}
        >
          <RotateCcw className="w-4 h-4 animate-spin-slow" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}
