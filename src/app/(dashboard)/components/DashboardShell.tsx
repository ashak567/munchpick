'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import CompanionSidebar from '@/components/workspace/CompanionSidebar'
import { createClient } from '@/utils/supabase/client'

const SIDEBAR_COLLAPSE_KEY = 'munch_sidebar_collapsed'

interface DashboardShellProps {
  children: React.ReactNode
  userName: string
  userInitial: string
}

export default function DashboardShell({
  children,
  userName,
  userInitial,
}: DashboardShellProps) {
  const pathname = usePathname()
  const isChatRoute = pathname === '/dashboard'

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [preferredMascot, setPreferredMascot] = useState<any>('munch')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY)
      if (stored !== null) setIsCollapsed(JSON.parse(stored) === true)
    } catch {
      // localStorage unavailable
    }
  }, [])

  useEffect(() => {
    async function loadMascot() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferred_mascot')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.preferred_mascot) {
            setPreferredMascot(profile.preferred_mascot)
          }
        }
      } catch (err) {
        console.error('Failed to load sidebar mascot:', err)
      }
    }
    loadMascot()
  }, [pathname])

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // ── Chat route: full-screen with responsive navigation ─────────────────────
  if (isChatRoute) {
    return (
      <div className="flex-1 flex overflow-hidden h-full w-full min-h-0">
        {/* Desktop Sidebar (lg+ only) */}
        <div className="hidden lg:flex h-full flex-shrink-0">
          <CompanionSidebar
            activeMascot={preferredMascot}
            activeExpression="idle"
            isCollapsed={isCollapsed}
            onToggleCollapse={toggleCollapse}
          />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden relative">
          <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
            {children}
          </div>

          {/* Mobile Bottom Nav */}
          <div className="lg:hidden flex-shrink-0">
            <BottomNav />
          </div>
        </div>
      </div>
    )
  }

  // ── Non-chat routes (Journal, Conversations, Profile) ────────────────────
  return (
    <div className="flex-1 flex overflow-hidden h-full w-full min-h-0">
      {/* ── Desktop Sidebar (lg+ only) ─────────────────────────────────── */}
      <div className="hidden lg:flex h-full flex-shrink-0">
        <CompanionSidebar
          activeMascot={preferredMascot}
          activeExpression="idle"
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* ── Main content column ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden h-full min-h-0">
        {/* Mobile-only Top App Bar */}
        <header className="lg:hidden sticky top-0 z-40 glass-panel border-b border-white/40 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-1.5">
            <span className="text-2xl">🍀</span>
            <span className="font-display text-xl font-bold text-primary-dark">
              Munch
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-charcoal/70 hidden sm:inline">
              Hi, <span className="font-semibold text-charcoal">{userName}</span>
            </span>
            <div className="w-8 h-8 rounded-full bg-secondary text-secondary-dark flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">
              {userInitial}
            </div>
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto pb-28 lg:pb-8 min-h-0 scrollbar-thin">
          <div className="max-w-lg mx-auto w-full px-4 pt-6 lg:max-w-2xl lg:px-8 lg:pt-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Nav (hidden on desktop — sidebar handles desktop nav) */}
        <div className="lg:hidden flex-shrink-0">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
