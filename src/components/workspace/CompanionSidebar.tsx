'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import CompanionNavigation from './CompanionNavigation';
import { WorkspacePage } from './WorkspaceController';
import { MascotCharacter } from '../Mascot';
import CompanionStage from '../companion/CompanionStage';
import { MOTION_SYSTEM_VARIANTS } from './motion-system';

interface CompanionSidebarProps {
  activePage?: WorkspacePage;
  onNavigate?: (page: WorkspacePage) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeMascot: MascotCharacter;
  activeExpression: string;
  className?: string;
}

export default function CompanionSidebar({
  isCollapsed,
  onToggleCollapse,
  activeMascot,
  activeExpression,
  className = ''
}: CompanionSidebarProps) {
  const pathname = usePathname();
  const isProfileActive = pathname === '/profile';

  return (
    <motion.aside
      variants={MOTION_SYSTEM_VARIANTS.sidebarSlide}
      animate={isCollapsed ? 'collapsed' : 'expanded'}
      className={`h-full max-h-[100dvh] flex flex-col justify-between border-r border-white/50 bg-white/75 backdrop-blur-md relative p-4 flex-shrink-0 z-30 overflow-y-auto overflow-x-hidden scrollbar-none ${className}`}
    >
      <div className="flex flex-col gap-6 items-center">
        {/* Toggle Collapse Trigger */}
        <div className="flex w-full items-center justify-between">
          {!isCollapsed && (
            <span className="font-display font-black text-base text-charcoal tracking-wide">
              MUNCH
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-white/90 rounded-xl cursor-pointer text-charcoal/60 hover:text-charcoal transition-all shadow-3xs"
            style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Mascot Avatar Stage */}
        <div className="w-full flex justify-center py-2">
          <CompanionStage
            character={activeMascot}
            expression={activeExpression}
            layoutMode="compact"
            mascotScale={isCollapsed ? 0.7 : 0.95}
          />
        </div>

        {/* Navigation list */}
        <div className="w-full">
          <CompanionNavigation
            variant="sidebar"
            isCollapsed={isCollapsed}
          />
        </div>
      </div>

      {/* Profile link at bottom of sidebar */}
      <div className="w-full flex flex-col gap-2 border-t border-charcoal/5 pt-4">
        <Link
          href="/profile"
          className={`flex items-center gap-3 p-3.5 rounded-2xl font-semibold text-xs transition-all w-full border ${
            isProfileActive
              ? 'bg-primary/20 text-primary-dark border-primary/30 shadow-3xs'
              : 'text-charcoal/60 hover:text-charcoal hover:bg-white/40 border-transparent'
          }`}
          style={{ minHeight: '44px' }}
        >
          <User className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span className="truncate">Profile</span>}
        </Link>
      </div>
    </motion.aside>
  );
}
export type { CompanionSidebarProps };
