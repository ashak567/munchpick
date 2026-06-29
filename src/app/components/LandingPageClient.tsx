'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react'
import Mascot, { MascotCharacter, MascotExpression } from '@/components/Mascot'
import { motion, AnimatePresence } from 'framer-motion'

export default function LandingPageClient() {
  const [character, setCharacter] = useState<MascotCharacter>('munch')
  const [expression, setExpression] = useState<MascotExpression>('happy')
  const [scene, setScene] = useState<string>('default')
  const [greeting, setGreeting] = useState<string>('Hello, traveler.')
  const [envelopeOpen, setEnvelopeOpen] = useState(false)
  const [particles, setParticles] = useState<{ id: number; char: string; left: string; size: string; delay: number; duration: number }[]>([])

  // Selection configurations for logged-out users
  const mascots: MascotCharacter[] = ['munch', 'ollie', 'ellie', 'pandy', 'dobby', 'coco', 'froggy', 'bubbles', 'chicky']
  const visualScenes = ['morning_sun', 'afternoon_warmth', 'twilight_glow', 'midnight_peace', 'clover_garden']

  useEffect(() => {
    // 1. Pick a random mascot
    const randMascot = mascots[Math.floor(Math.random() * mascots.length)]
    setCharacter(randMascot)

    // Set matching expressions
    const expressions: MascotExpression[] = ['idle', 'happy', 'thinking', 'wry']
    setExpression(expressions[Math.floor(Math.random() * expressions.length)])

    // 2. Select visual scene based on current local time
    const hour = new Date().getHours()
    let resolvedScene = 'clover_garden'
    let resolvedGreeting = 'Hello, traveler.'

    if (hour >= 5 && hour < 12) {
      resolvedScene = 'morning_sun'
      resolvedGreeting = 'Good morning, traveler.'
    } else if (hour >= 12 && hour < 17) {
      resolvedScene = 'afternoon_warmth'
      resolvedGreeting = 'Good afternoon, traveler.'
    } else if (hour >= 17 && hour < 21) {
      resolvedScene = 'twilight_glow'
      resolvedGreeting = 'Good evening, traveler.'
    } else {
      resolvedScene = 'midnight_peace'
      resolvedGreeting = 'Resting your thoughts tonight?'
    }

    setScene(resolvedScene)
    setGreeting(resolvedGreeting)

    // Generate background particles
    let pList: string[] = []
    if (resolvedScene === 'morning_sun') pList = ['✨', '☀️', '✨']
    else if (resolvedScene === 'afternoon_warmth') pList = ['🍀', '✨', '🍀']
    else if (resolvedScene === 'twilight_glow') pList = ['✨', '⭐', '🌟']
    else if (resolvedScene === 'midnight_peace') pList = ['⭐', '✨', '🌟', '✨']
    else pList = ['🍀', '🍃', '🍀', '🍃']

    const newParticles = Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      char: pList[i % pList.length],
      left: `${10 + Math.random() * 80}%`,
      size: `${14 + Math.random() * 18}px`,
      delay: Math.random() * 4,
      duration: 12 + Math.random() * 12
    }))
    setParticles(newParticles)
  }, [])

  const bgClasses: Record<string, string> = {
    morning_sun: 'from-amber-50/50 via-orange-50/30 to-cream/70',
    afternoon_warmth: 'from-cream via-white to-primary-light/5',
    twilight_glow: 'from-indigo-50/60 via-purple-50/30 to-pink-100/10',
    midnight_peace: 'from-slate-950 via-slate-900 to-indigo-950 text-white/90 dark-theme-landing',
    clover_garden: 'from-emerald-50/30 via-cream to-teal-50/20',
    default: 'from-cream to-cream'
  }

  const bgClass = bgClasses[scene] || bgClasses.default
  const isDark = scene === 'midnight_peace'

  return (
    <div className={`flex-grow flex flex-col relative overflow-hidden transition-all duration-1000 bg-gradient-to-b ${bgClass}`}>
      {/* Background clover/star particle systems */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        <AnimatePresence>
          {particles.map((p) => (
            <motion.div
              key={`${scene}-${p.id}`}
              initial={{ y: '105vh', opacity: 0, rotate: 0 }}
              animate={{
                y: '-10vh',
                opacity: [0, 0.4, 0.4, 0],
                rotate: 360
              }}
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
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col justify-start items-center px-4 py-12 sm:px-6 lg:px-8 max-w-lg mx-auto w-full z-10 space-y-12 relative">
        
        {/* Header Logo */}
        <div className="inline-flex items-center gap-2 animate-float text-center">
          <span className="text-5xl">🍀</span>
          <span className={`font-display text-4xl font-extrabold tracking-tight ${isDark ? 'text-primary-light' : 'text-primary-dark'}`}>
            Munch
          </span>
        </div>

        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="font-display text-4xl sm:text-5xl font-black leading-tight">
            Slow down.<br />
            <span className={isDark ? 'text-primary-light' : 'text-primary-dark'}>Find comfort in your choices.</span>
          </h1>
          <p className={`text-sm sm:text-base leading-relaxed max-w-sm mx-auto ${isDark ? 'text-white/70' : 'text-charcoal/70'}`}>
            A gentle four-leaf clover companion that helps you understand your thoughts, listen to your feelings, and find comfort in where to begin.
          </p>

          <div className="pt-4 max-w-xs mx-auto">
            <div className="space-y-3">
              <Link
                href="/register"
                className="w-full py-3.5 px-6 btn-clay-primary text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                Meet Munch 🍀
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className={`w-full py-3.5 px-6 border-2 rounded-2xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                    : 'border-charcoal/10 bg-white hover:bg-charcoal/5 text-charcoal'
                }`}
              >
                Log In
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Dynamic Welcome Envelope Message Trigger */}
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {!envelopeOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                onClick={() => setEnvelopeOpen(true)}
                className={`p-5 rounded-3xl border text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-102 hover:shadow-lg ${
                  isDark
                    ? 'bg-slate-900/60 border-white/10 text-white hover:bg-slate-900/80'
                    : 'bg-white/60 border-charcoal/5 text-charcoal hover:bg-white/80'
                }`}
              >
                <div className="text-3xl mb-2.5 animate-bounce">✉️</div>
                <h4 className="font-display font-extrabold text-sm mb-1">
                  You have a letter from Munch
                </h4>
                <p className={`text-3xs leading-relaxed max-w-[200px] ${isDark ? 'text-white/55' : 'text-charcoal/55'}`}>
                  Click to open a gentle word of welcome and companion introduction.
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-6 rounded-3xl border text-left space-y-4 shadow-md relative overflow-hidden ${
                  isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-charcoal/5'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEnvelopeOpen(false)
                  }}
                  className="absolute top-3 right-3 text-xs opacity-40 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
                <div className="font-serif italic text-xs leading-relaxed text-left">
                  <span className="font-display font-black text-3xs block uppercase tracking-wider text-primary-dark/85 not-italic mb-1.5">
                    A Thought from Munch 🍀
                  </span>
                  "Hi traveler. Welcome to Munch. I am a gentle four-leaf clover companion here to help you hear yourself more clearly. Take a slow breath, rest your thoughts, and click 'Meet Munch' to begin walking this path together."
                </div>
                <div className="flex justify-between items-end border-t border-charcoal/10 pt-2 text-[10px]">
                  <span className="opacity-45 font-bold uppercase tracking-wider">Your Companion</span>
                  <span className="font-display font-black text-primary-dark capitalize">{character} 🍀</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mascot Showcase Section */}
        <div className="w-full space-y-4 text-center">
          <div className="space-y-1">
            <h3 className="font-display font-black text-xl">
              Meet your companion
            </h3>
            <p className={`text-3xs uppercase tracking-widest font-bold ${isDark ? 'text-white/45' : 'text-charcoal/45'}`}>
              Gently quiets the noise in your mind
            </p>
          </div>

          <div className="flex justify-center pt-1 px-1">
            <div className={`w-48 rounded-3xl p-6 border text-center flex flex-col items-center justify-between space-y-4 shadow-md hover:scale-102 hover:shadow-lg transition-all ${
              isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/60 border-charcoal/5'
            }`}>
              <Mascot character={character} expression={expression} size="md" />
              <div>
                <h4 className="font-display font-extrabold text-sm capitalize truncate w-full">
                  {character} 🍀
                </h4>
                <p className={`text-3xs leading-snug mt-1 max-w-[140px] mx-auto ${isDark ? 'text-white/60' : 'text-charcoal/60'}`}>
                  {resolvedMascotDescription(character)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works Steps */}
        <div className="w-full space-y-5">
          <h3 className="font-display font-black text-xl text-center">
            How Munch Helps You
          </h3>

          <div className="space-y-4">
            <div className={`rounded-2xl p-4 border flex gap-3.5 items-start ${
              isDark ? 'bg-slate-900/40 border-white/10' : 'bg-white/60 border-white/60'
            }`}>
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary-dark flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-inner">
                1
              </span>
              <div>
                <h4 className="text-xs font-bold">Share your thoughts</h4>
                <p className={`text-2xs leading-relaxed mt-0.5 ${isDark ? 'text-white/60' : 'text-charcoal/60'}`}>
                  Write down the paths you&apos;re stuck between. Take your time—there is never any rush.
                </p>
              </div>
            </div>

            <div className={`rounded-2xl p-4 border flex gap-3.5 items-start ${
              isDark ? 'bg-slate-900/40 border-white/10' : 'bg-white/60 border-white/60'
            }`}>
              <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary-dark flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-inner">
                2
              </span>
              <div>
                <h4 className="text-xs font-bold">Reflect on what matters</h4>
                <p className={`text-2xs leading-relaxed mt-0.5 ${isDark ? 'text-white/60' : 'text-charcoal/60'}`}>
                  Munch notices what usually brings you comfort and gently points towards a warm path forward.
                </p>
              </div>
            </div>

            <div className={`rounded-2xl p-4 border flex gap-3.5 items-start ${
              isDark ? 'bg-slate-900/40 border-white/10' : 'bg-white/60 border-white/60'
            }`}>
              <span className="w-6 h-6 rounded-full bg-yellow/20 text-yellow-700 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-inner">
                3
              </span>
              <div>
                <h4 className="text-xs font-bold">Find peace of mind</h4>
                <p className={`text-2xs leading-relaxed mt-0.5 ${isDark ? 'text-white/60' : 'text-charcoal/60'}`}>
                  Receive a warm, thoughtful explanation of why this path makes sense, helping you quiet the chatter.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA glass panel */}
        <div className={`w-full border-2 rounded-3xl p-6 text-center space-y-4 shadow-md relative overflow-hidden ${
          isDark ? 'bg-slate-900/70 border-primary/20' : 'bg-white/80 border-primary/20'
        }`}>
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full flex items-center justify-center pr-2 pb-2">
            <Sparkles className="w-5 h-5 text-primary-dark" />
          </div>
          
          <h3 className="font-display text-lg font-black leading-tight">
            Let&apos;s figure it out together.
          </h3>
          <p className={`text-2xs leading-normal max-w-xs mx-auto ${isDark ? 'text-white/60' : 'text-charcoal/60'}`}>
            Munch is here to help you hear yourself more clearly. Quiet the overthinking, and take a gentle step forward today.
          </p>
          <div className="pt-2">
            <Link
              href="/register"
              className="py-3 px-6 btn-clay-primary text-xs inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
            >
              Begin with Munch
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className={`w-full text-center text-3xs pt-6 border-t ${
          isDark ? 'text-white/35 border-white/5' : 'text-charcoal/30 border-charcoal/5'
        }`}>
          Munch © {new Date().getFullYear()}. Built with love, clovers, and warm support.
        </footer>
      </div>
    </div>
  )
}

function resolvedMascotDescription(char: MascotCharacter): string {
  const descriptions: Record<MascotCharacter, string> = {
    munch: "Balanced Guide: Gently quiets the noise in your mind.",
    ollie: "Reflective Thinker: Helps you look closer and ponder.",
    ellie: "Gentle Listener: Always there to reassure you.",
    pandy: "Comfort Provider: Creates a cozy, resting space.",
    dobby: "Encouraging Friend: Cheerleading your next step.",
    coco: "Curious Explorer: Prompts you with playful thoughts.",
    froggy: "Calm Serene: Teaches you to breathe and be.",
    bubbles: "Flowing Sea-spirit: Reminds you to go with the flow.",
    chicky: "Bright Joy: Finds the light in small choices."
  }
  return descriptions[char] || "Your warm companion."
}
