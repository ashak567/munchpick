'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, History, MessageSquare, User, Users } from 'lucide-react'
import { useResponsiveLayout } from '@/components/companion/LayoutManager'

export default function BottomNav() {
  const pathname = usePathname()
  const layout = useResponsiveLayout()

  const navItems = [
    { href: '/dashboard', label: 'Munch', icon: Sparkles },
    { href: '/table', label: 'Table', icon: Users },
    { href: '/history', label: 'Journal', icon: History },
    { href: '/our-conversations', label: 'Conversations', icon: MessageSquare },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  // Hide the floating bottom nav when the keyboard is open on mobile to prevent layout overlaps
  if (layout.keyboardHeight > 0) {
    return null
  }

  return (
    <nav 
      className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-40"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        height: 'var(--bottom-nav-height)',
      }}
    >
      <div className="glass-panel border border-white/50 dark:border-white/10 rounded-2xl py-2 px-4 shadow-lg flex items-center justify-around h-full">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer group"
            >
              <div
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary dark:bg-primary/30 text-primary-dark dark:text-emerald-300 scale-110 shadow-sm'
                    : 'text-charcoal/60 dark:text-slate-400 group-hover:text-charcoal/90 dark:group-hover:text-white group-hover:scale-105'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary-dark dark:text-emerald-300 font-semibold' : 'text-charcoal/50 dark:text-slate-400 group-hover:text-charcoal/70 dark:group-hover:text-slate-200'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
