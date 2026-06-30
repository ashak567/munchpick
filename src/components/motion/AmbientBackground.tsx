'use client'

import React, { useEffect, useState } from 'react'
import { useWelcome } from '@/lib/envelope/WelcomeContext'
import { useConversationPresence } from '@/hooks/useConversationPresence'
import { motion, AnimatePresence } from 'framer-motion'

interface AmbientBackgroundProps {
  scene?: string
  isReduced?: boolean
}

export default function AmbientBackground({ scene: propScene, isReduced: propIsReduced }: AmbientBackgroundProps) {
  const { state } = useWelcome()
  const { preferences } = useConversationPresence()

  const scene = propScene || state?.visual_scene || 'default'
  const isReduced = propIsReduced ?? (preferences.profile === 'reduced-motion')

  const [particles, setParticles] = useState<{
    id: number
    char: string
    left: string
    size: string
    delay: number
    duration: number
  }[]>([])

  // Generate particles based on active scene
  useEffect(() => {
    if (isReduced) {
      setParticles([])
      return
    }

    let pList: string[] = []
    if (scene === 'morning_sun') pList = ['✨', '☀️', '✨']
    else if (scene === 'afternoon_warmth') pList = ['🍀', '✨', '🍀']
    else if (scene === 'twilight_glow') pList = ['✨', '⭐', '🌟']
    else if (scene === 'midnight_peace') pList = ['⭐', '✨', '🌟', '✨']
    else if (scene === 'clover_garden') pList = ['🍀', '🍃', '🍀', '🍃']

    if (pList.length === 0) {
      setParticles([])
      return
    }

    const newParticles = Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      char: pList[i % pList.length],
      left: `${10 + Math.random() * 80}%`,
      size: `${14 + Math.random() * 20}px`,
      delay: Math.random() * 4,
      duration: 10 + Math.random() * 15
    }))
    setParticles(newParticles)
  }, [scene, isReduced])

  // Tiny Moments System: Floating leaf drifting across screen sometimes
  const [showDrift, setShowDrift] = useState(false)
  useEffect(() => {
    if (isReduced) {
      setShowDrift(false)
      return
    }

    const interval = setInterval(() => {
      if (Math.random() < 0.35) {
        setShowDrift(true)
        setTimeout(() => setShowDrift(false), 9000)
      }
    }, 20000)

    return () => clearInterval(interval)
  }, [isReduced])

  if (isReduced) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={`${scene}-${p.id}`}
            initial={{ y: '105vh', opacity: 0, rotate: 0 }}
            animate={{
              y: '-10vh',
              opacity: [0, 0.45, 0.45, 0],
              rotate: 360
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'linear'
            }}
            style={{
              position: 'absolute',
              left: p.left,
              fontSize: p.size,
            }}
          >
            {p.char}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Tiny Moment: Floating leaf drifting across the screen */}
      <AnimatePresence>
        {showDrift && (
          <motion.div
            initial={{ x: '-10vw', y: '20vh', rotate: 0, opacity: 0 }}
            animate={{
              x: '110vw',
              y: ['20vh', '35vh', '25vh', '40vh'],
              rotate: 720,
              opacity: [0, 0.6, 0.6, 0]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 9, ease: 'easeInOut' }}
            className="absolute text-2xl z-30"
          >
            🍃
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
