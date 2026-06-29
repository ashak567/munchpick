'use client';

import React from 'react';
import { WorkspaceLayoutContext } from './LayoutCoordinator';
import CompanionSidebar from './CompanionSidebar';
import BottomNavigation from './BottomNavigation';
import { WorkspacePage } from './WorkspaceController';
import { MascotCharacter } from '../Mascot';

interface WorkspaceLayoutProps {
  layoutContext: WorkspaceLayoutContext;
  activePage: WorkspacePage;
  onNavigate: (page: WorkspacePage) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  activeMascot: MascotCharacter;
  activeExpression: string;
  children: React.ReactNode;
}

export default function WorkspaceLayout({
  layoutContext,
  activePage,
  onNavigate,
  isSidebarCollapsed,
  onToggleSidebar,
  activeMascot,
  activeExpression,
  children
}: WorkspaceLayoutProps) {
  const isMobile = layoutContext.layout === 'compact';

  return (
    <div className="w-full h-[100dvh] flex overflow-hidden relative">
      {/* 1. Sidebar (Desktop and Tablet comfortable/expanded views) */}
      {!isMobile && (
        <CompanionSidebar
          activePage={activePage}
          onNavigate={onNavigate}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={onToggleSidebar}
          activeMascot={activeMascot}
          activeExpression={activeExpression}
        />
      )}

      {/* 2. Main Workspace Content Pane */}
      <main 
        className="flex-1 h-full flex flex-col overflow-hidden relative"
        style={{
          paddingBottom: isMobile ? `${layoutContext.keyboardHeight || layoutContext.safeArea.bottom}px` : '0px'
        }}
      >
        <div className={`flex-1 overflow-hidden w-full flex flex-col ${layoutContext.contentPadding}`}>
          {children}
        </div>
      </main>

      {/* 3. Bottom Navigation Bar (Mobile compact view only) */}
      {isMobile && (
        <BottomNavigation
          activePage={activePage}
          onNavigate={onNavigate}
          safeArea={layoutContext.safeArea}
        />
      )}
    </div>
  );
}
export type { WorkspaceLayoutProps };
