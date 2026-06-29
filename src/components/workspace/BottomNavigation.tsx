'use client';

import React from 'react';
import CompanionNavigation from './CompanionNavigation';
import { WorkspacePage } from './WorkspaceController';
import { Insets } from '../companion/LayoutManager';

interface BottomNavigationProps {
  activePage: WorkspacePage;
  onNavigate: (page: WorkspacePage) => void;
  safeArea: Insets;
  className?: string;
}

export default function BottomNavigation({
  activePage,
  onNavigate,
  safeArea,
  className = ''
}: BottomNavigationProps) {
  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 w-full z-40 bg-white/80 border-t border-white/90 backdrop-blur-lg shadow-lg flex-shrink-0 ${className}`}
      style={{
        paddingBottom: `${safeArea.bottom}px`,
        contentVisibility: 'auto'
      }}
    >
      <div className="w-full max-w-md mx-auto px-4 py-2">
        <CompanionNavigation
          activePage={activePage}
          onNavigate={onNavigate}
          variant="bottom-bar"
        />
      </div>
    </div>
  );
}
export type { BottomNavigationProps };
