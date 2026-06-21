import React from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { PlusCircle, Compass, History, HelpCircle } from 'lucide-react'
import Mascot from '@/components/Mascot'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'friend'

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-6 text-center">
      {/* Hello Greeting Header */}
      <div className="mb-4">
        <h1 className="font-display text-4xl font-extrabold text-charcoal tracking-tight">
          Hello, {userName}!
        </h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Stop overthinking. Let's make some choices today!
        </p>
      </div>

      {/* Mascot Munch waving card */}
      <div className="glass-panel rounded-3xl p-8 shadow-xl w-full max-w-sm mb-8 flex flex-col items-center relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-primary/20 blur-xl" />
        <div className="absolute -bottom-12 -left-12 w-24 h-24 rounded-full bg-secondary/20 blur-xl" />

        {/* Waving Mascot */}
        <Mascot character="general" expression="happy" size="xl" className="mb-4" />

        <h3 className="font-display font-bold text-xl text-charcoal mb-2">
          Ready to decide?
        </h3>
        <p className="text-xs text-charcoal/70 leading-relaxed mb-6">
          Got options? Tell me what you're stuck between, and I'll pick the best choice for you with absolute confidence!
        </p>

        {/* Start Decision Button */}
        <Link
          href="/dashboard/new"
          className="w-full py-3 px-6 btn-clay-primary text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
        >
          <PlusCircle className="w-5 h-5" />
          New Decision
        </Link>
      </div>

      {/* Quick stats / suggestions cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <Link
          href="/history"
          className="glass-card hover:bg-white/95 transition-all duration-200 rounded-2xl p-4 text-center cursor-pointer flex flex-col items-center gap-2 border border-white/50"
        >
          <div className="p-2 rounded-xl bg-secondary/30 text-secondary-dark">
            <History className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-charcoal">View History</span>
        </Link>

        <Link
          href="/dashboard/new?quick=food"
          className="glass-card hover:bg-white/95 transition-all duration-200 rounded-2xl p-4 text-center cursor-pointer flex flex-col items-center gap-2 border border-white/50"
        >
          <div className="p-2 rounded-xl bg-primary/30 text-primary-dark">
            <Compass className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-charcoal">Quick Dinner Pick</span>
        </Link>
      </div>
    </div>
  )
}
