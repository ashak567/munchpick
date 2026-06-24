'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { WelcomeState } from './types'

interface WelcomeContextType {
  state: WelcomeState | null
  loading: boolean
  refresh: () => Promise<void>
  markRead: (letterId: string) => Promise<void>
}

const WelcomeContext = createContext<WelcomeContextType | undefined>(undefined)

export function WelcomeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WelcomeState | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchState = async () => {
    try {
      const res = await fetch('/api/envelope/current')
      if (res.ok) {
        const data = await res.json()
        setState(data)
      }
    } catch (err) {
      console.warn('[WelcomeContext] Failed to fetch welcome state:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchState()
  }, [])

  const markRead = async (letterId: string) => {
    try {
      const res = await fetch('/api/envelope/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterId })
      })
      if (res.ok) {
        // Fetch fresh state after marking read
        await fetchState()
      }
    } catch (err) {
      console.error('[WelcomeContext] Failed to mark envelope as read:', err)
    }
  }

  return (
    <WelcomeContext.Provider value={{ state, loading, refresh: fetchState, markRead }}>
      {children}
    </WelcomeContext.Provider>
  )
}

export function useWelcome() {
  const context = useContext(WelcomeContext)
  if (context === undefined) {
    throw new Error('useWelcome must be used within a WelcomeProvider')
  }
  return context
}
