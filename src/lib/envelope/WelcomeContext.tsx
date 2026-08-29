'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { WelcomeState, EnvelopeLetter } from './types'

interface OpenEnvelopeOptions {
  chatId?: string
  message?: string
  cognitiveState?: any
  currentTopic?: string
}

interface WelcomeContextType {
  state: WelcomeState | null
  loading: boolean
  isEnvelopeOpen: boolean
  refresh: () => Promise<void>
  markRead: (letterId: string) => Promise<void>
  openEnvelope: (options?: OpenEnvelopeOptions) => Promise<void>
  closeEnvelope: () => Promise<void>
}

const WelcomeContext = createContext<WelcomeContextType | undefined>(undefined)

export function WelcomeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WelcomeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/envelope/current')
      if (res.ok) {
        const data = await res.json()
        setState(data)
        // If an unread letter exists, open envelope
        if (data?.letter && !data.letter.is_read && data.presentation_type === 'envelope') {
          setIsEnvelopeOpen(true)
        }
      }
    } catch (err) {
      console.warn('[WelcomeContext] Failed to fetch welcome state:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  const markRead = async (letterId: string) => {
    try {
      const res = await fetch('/api/envelope/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterId })
      })
      if (res.ok) {
        setIsEnvelopeOpen(false)
        await fetchState()
      }
    } catch (err) {
      console.error('[WelcomeContext] Failed to mark envelope as read:', err)
    }
  }

  const openEnvelope = async (options?: OpenEnvelopeOptions) => {
    // If we already have an unread letter in state, open it
    if (state?.letter && !state.letter.is_read) {
      setIsEnvelopeOpen(true)
      return
    }

    // Otherwise generate a fresh conversational envelope on-demand
    try {
      const res = await fetch('/api/envelope/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          chatId: options?.chatId,
          message: options?.message,
          cognitiveState: options?.cognitiveState,
          currentTopic: options?.currentTopic
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.letter) {
          setState((prev) => ({
            greeting: prev?.greeting || 'Hello friend!',
            presentation_type: 'envelope',
            letter: data.letter,
            mascot_character: data.letter.mascot_character_used || 'munch',
            mascot_expression: data.letter.mascot_expression || 'happy',
            mascot_message: "Here's a gentle note for you. 🍀",
            visual_scene: data.letter.scene_used || 'default',
            notices: prev?.notices || []
          }))
          setIsEnvelopeOpen(true)
        }
      }
    } catch (err) {
      console.error('[WelcomeContext] Failed to generate on-demand envelope:', err)
    }
  }

  const closeEnvelope = async () => {
    if (state?.letter?.id) {
      await markRead(state.letter.id)
    }
    setIsEnvelopeOpen(false)
  }

  return (
    <WelcomeContext.Provider
      value={{
        state,
        loading,
        isEnvelopeOpen,
        refresh: fetchState,
        markRead,
        openEnvelope,
        closeEnvelope
      }}
    >
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
