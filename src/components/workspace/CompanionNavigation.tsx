'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, BookOpen, MessageSquare, User, LucideIcon } from 'lucide-react';
import { WORKSPACE_NAVIGATION_CONFIG, NavigationItem } from './workspace-navigation';
import { WorkspacePage } from './WorkspaceController';

const ICON_MAP: Record<NavigationItem['iconName'], LucideIcon> = {
  Home,
  Users,
  BookOpen,
  MessageSquare,
  User,
};

interface CompanionNavigationProps {
  activePage?: WorkspacePage;
  onNavigate?: (page: WorkspacePage) => void;
  variant: 'sidebar' | 'bottom-bar';
  isCollapsed?: boolean;
}

export default function CompanionNavigation({
  variant,
  isCollapsed = false,
}: CompanionNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={`flex ${
        variant === 'sidebar'
          ? 'flex-col gap-2 w-full'
          : 'flex-row items-center justify-around w-full'
      }`}
    >
      {WORKSPACE_NAVIGATION_CONFIG.map((item) => {
        const Icon = ICON_MAP[item.iconName] || Home;
        const isActive = pathname === item.href;

        if (variant === 'sidebar') {
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 p-3.5 rounded-2xl font-semibold text-xs transition-all select-none group w-full ${
                isActive
                  ? 'bg-primary/20 text-primary-dark dark:text-emerald-300 border border-primary/30 dark:border-primary/40 shadow-3xs'
                  : 'text-charcoal/60 dark:text-slate-300 hover:text-charcoal dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10 border border-transparent'
              }`}
              style={{ minHeight: '44px' }}
              title={item.label}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-transform ${
                  isActive ? 'scale-110 text-primary-dark dark:text-emerald-300' : 'group-hover:scale-105'
                }`}
              />
              {!isCollapsed && (
                <span className="animate-fade-in truncate">{item.label}</span>
              )}
            </Link>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative select-none ${
              isActive ? 'text-primary-dark dark:text-emerald-300' : 'text-charcoal/50 dark:text-slate-400 hover:text-charcoal dark:hover:text-white'
            }`}
            style={{ minWidth: '44px', minHeight: '44px' }}
            title={item.label}
          >
            <Icon
              className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`}
            />
            <span className="text-[9px] font-bold mt-1 tracking-wide">{item.label}</span>
            {isActive && (
              <span className="absolute bottom-0 w-4 h-0.5 bg-primary rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
export type { CompanionNavigationProps };
export { ICON_MAP };
