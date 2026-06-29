'use client';

import React from 'react';
import { Home, BookOpen, Heart, Settings, LucideIcon } from 'lucide-react';
import { WORKSPACE_NAVIGATION_CONFIG, NavigationItem } from './workspace-navigation';
import { WorkspacePage } from './WorkspaceController';

const ICON_MAP: Record<NavigationItem['iconName'], LucideIcon> = {
  Home,
  BookOpen,
  Heart,
  Settings
};

interface CompanionNavigationProps {
  activePage: WorkspacePage;
  onNavigate: (page: WorkspacePage) => void;
  variant: 'sidebar' | 'bottom-bar';
  isCollapsed?: boolean;
}

export default function CompanionNavigation({
  activePage,
  onNavigate,
  variant,
  isCollapsed = false
}: CompanionNavigationProps) {
  return (
    <nav 
      className={`flex ${
        variant === 'sidebar' ? 'flex-col gap-2 w-full' : 'flex-row items-center justify-around w-full'
      }`}
    >
      {WORKSPACE_NAVIGATION_CONFIG.map((item) => {
        const Icon = ICON_MAP[item.iconName] || Home;
        const isActive = activePage === item.id;

        if (variant === 'sidebar') {
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-3 p-3.5 rounded-2xl font-semibold text-xs transition-all cursor-pointer select-none group w-full ${
                isActive
                  ? 'bg-primary/20 text-primary-dark border border-primary/30 shadow-3xs'
                  : 'text-charcoal/60 hover:text-charcoal hover:bg-white/40 border border-transparent'
              }`}
              style={{ minHeight: '44px' }}
              title={item.label}
            >
              <Icon 
                className={`w-4 h-4 flex-shrink-0 transition-transform ${
                  isActive ? 'scale-110 text-primary-dark' : 'group-hover:scale-105'
                }`} 
              />
              {!isCollapsed && (
                <span className="animate-fade-in truncate">
                  {item.label}
                </span>
              )}
            </button>
          );
        }

        // Bottom bar mobile style
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all cursor-pointer relative select-none ${
              isActive ? 'text-primary-dark' : 'text-charcoal/50 hover:text-charcoal'
            }`}
            style={{ minWidth: '44px', minHeight: '44px' }}
            title={item.label}
          >
            <Icon 
              className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} 
            />
            <span className="text-[9px] font-bold mt-1 tracking-wide">
              {item.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 w-4 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
export type { CompanionNavigationProps };
export { ICON_MAP };
