'use client'

import React from 'react'
import Link from 'next/link'
import { PlusCircle, Compass, History, Sparkles } from 'lucide-react'
import Mascot from '@/components/Mascot'
import { MotionTap, MotionCard } from '@/components/motion/MotionWrapper'
import { useWelcome } from '@/lib/envelope/WelcomeContext'

export default function DashboardPage() {
  const { state, loading } = useWelcome()

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center h-64">
        <div className="animate-spin text-3xl">🍀</div>
      </div>
    )
  }

  const greeting = state?.greeting || 'Hello!'
  const character = state?.mascot_character || 'munch'
  const expression = state?.mascot_expression || 'happy'
  const message = state?.mascot_message || 'What is on your mind?'
  const notices = state?.notices || []

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-6 text-center">
      {/* Dynamic Hello Greeting Header */}
      <div className="mb-6">
        <h1 className="font-display text-4xl font-extrabold text-charcoal tracking-tight capitalize">
          {greeting}
        </h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Take a breath. Let&apos;s find what feels right today.
        </p>
      </div>

      {/* Munch Notices Card */}
      {notices.length > 0 && (
        <div className="glass-panel rounded-3xl p-5 border border-white/60 w-full max-w-sm mb-6 text-left space-y-2 relative overflow-hidden bg-white/40 animate-fade-in">
          <div className="flex items-center gap-1.5 text-primary-dark">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider block">Munch Notices</span>
          </div>
          <ul className="space-y-1.5 pl-1.5 text-2xs text-charcoal/80 leading-normal">
            {notices.map((notice, idx) => (
              <li key={idx} className="flex gap-2 items-start">
                <span className="text-primary-dark mt-0.5">•</span>
                <span>{notice}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mascot character waving card */}
      <div className="glass-panel rounded-3xl p-8 shadow-xl w-full max-w-sm mb-8 flex flex-col items-center relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-primary/20 blur-xl" />
        <div className="absolute -bottom-12 -left-12 w-24 h-24 rounded-full bg-secondary/20 blur-xl" />

        {/* Dynamic Waving Mascot */}
        <Mascot character={character} expression={expression} size="xl" className="mb-4" />

        <h3 className="font-display font-bold text-xl text-charcoal mb-2 capitalize">
          {character}
        </h3>
        <p className="text-xs text-charcoal/70 leading-relaxed mb-6 italic px-2">
          &ldquo;{message}&rdquo;
        </p>

        {/* Start Decision Button */}
        <MotionTap className="w-full">
          <Link
            href="/dashboard/new"
            className="w-full py-3 px-6 btn-clay-primary text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
          >
            <PlusCircle className="w-5 h-5" />
            Share My Thoughts
          </Link>
        </MotionTap>
      </div>

      {/* Quick stats / suggestions cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <MotionCard className="w-full">
          <Link
            href="/history"
            className="glass-card hover:bg-white/95 transition-all duration-200 rounded-2xl p-4 text-center cursor-pointer flex flex-col items-center gap-2 border border-white/50 h-full bg-white/70"
          >
            <div className="p-2 rounded-xl bg-secondary/30 text-secondary-dark">
              <History className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-charcoal">Past Reflections</span>
          </Link>
        </MotionCard>

        <MotionCard className="w-full">
          <Link
            href="/dashboard/new?quick=food"
            className="glass-card hover:bg-white/95 transition-all duration-200 rounded-2xl p-4 text-center cursor-pointer flex flex-col items-center gap-2 border border-white/50 h-full bg-white/70"
          >
            <div className="p-2 rounded-xl bg-primary/30 text-primary-dark">
              <Compass className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-charcoal">Cozy Meal Thoughts</span>
          </Link>
        </MotionCard>
      </div>
    </div>
  )
}
