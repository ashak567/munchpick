import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { Sparkles, History, BarChart3, User, LogOut } from 'lucide-react'
import BottomNav from '@/app/(dashboard)/components/BottomNav'
import BackgroundVideo from '@/components/BackgroundVideo'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {\n  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile name or fall back to email prefix
  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-cream relative">
      {/* Private Background Video Stream */}
      <BackgroundVideo />

      {/* Top App Bar */}
      <header className="sticky top-0 z-40 glass-panel border-b border-white/40 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-1.5">
          <span className="text-2xl">🍀</span>
          <span className="font-display text-xl font-bold text-primary-dark">
            Munch
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-charcoal/70 hidden sm:inline">
              Hi, <span className="font-semibold text-charcoal">{userName}</span>
            </span>
            <div className="w-8 h-8 rounded-full bg-secondary text-secondary-dark flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pb-24 max-w-lg mx-auto w-full px-4 pt-6">
        {children}
      </main>

      {/* Shared Bottom Navigation Component */}
      <BottomNav />
    </div>
  )
}
