'use client'

import React from 'react'
import { useWelcome } from '@/lib/envelope/WelcomeContext'
import { usePathname } from 'next/navigation'
import AmbientBackground from '@/components/motion/AmbientBackground'

export default function WelcomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { state } = useWelcome()
  const pathname = usePathname()
  const isChatRoute = pathname === '/dashboard'

  const scene = state?.visual_scene || 'default'

  // Map visual scenes to gradients
  const bgClasses: Record<string, string> = {
    morning_sun: 'bg-gradient-to-b from-amber-50/60 via-orange-50/40 to-cream/80',
    afternoon_warmth: 'bg-gradient-to-b from-cream via-white to-primary-light/5',
    twilight_glow: 'bg-gradient-to-b from-indigo-50/70 via-purple-50/40 to-pink-100/20',
    midnight_peace: 'bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white/90',
    clover_garden: 'bg-gradient-to-b from-emerald-50/40 via-cream to-teal-50/30',
    default: 'bg-cream'
  }

  const bgClass = bgClasses[scene] || bgClasses.default

  return (
    <div 
      className={`flex-1 flex flex-col min-h-screen relative transition-all duration-1000 overflow-hidden ${
        scene === 'midnight_peace' ? 'dark-theme' : ''
      } ${bgClass}`}
    >
      {/* Background Particles */}
      {!isChatRoute && <AmbientBackground />}

      {/* Main Workspace Inner content */}
      <div className="flex-1 flex flex-col relative z-10">
        {children}
      </div>
    </div>
  )
}
