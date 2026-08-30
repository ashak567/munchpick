'use client'

import React from 'react'
import { useWelcome } from '@/lib/envelope/WelcomeContext'
import { usePathname } from 'next/navigation'
import AmbientBackground from '@/components/motion/AmbientBackground'
import { useTheme } from '@/lib/theme/ThemeContext'

export default function WelcomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { state } = useWelcome()
  const { resolvedTheme } = useTheme()
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
    default: resolvedTheme === 'dark' ? 'bg-[#0C0F1A]' : 'bg-cream'
  }

  const bgClass = resolvedTheme === 'dark' && scene === 'default'
    ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white/90'
    : (bgClasses[scene] || bgClasses.default)

  return (
    <div 
      className={`h-[100dvh] w-full flex flex-col relative transition-all duration-1000 overflow-hidden ${
        resolvedTheme === 'dark' || scene === 'midnight_peace' ? 'dark-theme' : ''
      } ${bgClass}`}
    >
      {/* Background Particles */}
      {!isChatRoute && <AmbientBackground />}

      {/* Main Workspace Inner content */}
      <div className="flex-1 flex flex-col relative z-10 min-h-0 h-full overflow-hidden">
        {children}
      </div>
    </div>
  )
}
