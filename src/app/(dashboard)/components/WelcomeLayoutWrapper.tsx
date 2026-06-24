'use client'

import React, { useEffect, useState } from 'react'
import { useWelcome } from '@/lib/envelope/WelcomeContext'
import { motion, AnimatePresence } from 'framer-motion'

export default function WelcomeLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { state } = useWelcome()
  const [particles, setParticles] = useState<{ id: number; char: string; left: string; size: string; delay: number; duration: number }[]>([])

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

  // Generate particles based on active scene
  useEffect(() => {
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
  }, [scene])

  // Tiny Moments System: Floating leaf drifting across screen sometimes
  const [showDrift, setShowDrift] = useState(false)
  useEffect(() => {
    // Occasionally trigger a leaf/clover drifting across the screen
    const interval = setInterval(() => {
      if (Math.random() < 0.35) {
        setShowDrift(true)
        setTimeout(() => setShowDrift(false), 9000)
      }
    }, 20000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div 
      className={`flex-1 flex flex-col min-h-screen relative transition-all duration-1000 overflow-hidden ${
        scene === 'midnight_peace' ? 'dark-theme' : ''
      } ${bgClass}`}
    >
      {/* Background Particles */}
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

      {/* Main Workspace Inner content */}
      <div className="flex-1 flex flex-col relative z-10">
        {children}
      </div>
    </div>
  )
}
