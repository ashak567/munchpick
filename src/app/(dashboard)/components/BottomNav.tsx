'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, History, BarChart3, User } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Pick', icon: Sparkles },
    { href: '/history', label: 'History', icon: History },
    { href: '/insights', label: 'Insights', icon: BarChart3 },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-40">
      <div className="glass-panel border border-white/50 rounded-2xl py-2 px-4 shadow-lg flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 cursor-pointer group"
            >\n              <div
                className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-dark scale-110 shadow-sm'
                    : 'text-charcoal/60 group-hover:text-charcoal/90 group-hover:scale-105'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary-dark font-semibold' : 'text-charcoal/50 group-hover:text-charcoal/70'
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
