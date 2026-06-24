'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion'
import { X, Heart } from 'lucide-react'
import Mascot from '@/components/Mascot'
import { useWelcome } from '@/lib/envelope/WelcomeContext'

export default function Envelope() {
  const { state, loading, markRead } = useWelcome()
  const [isOpen, setIsOpen] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  // Reset internal open states when a new letter comes or is dismissed
  useEffect(() => {
    if (!state?.letter || state.letter.is_read) {
      setIsOpen(false)
      setIsOpening(false)
    }
  }, [state])

  if (loading || !state?.letter || state.letter.is_read || state.presentation_type !== 'envelope') {
    return null
  }

  const letter = state.letter
  const character = state.mascot_character
  const expression = state.mascot_expression
  const messageContent = letter.content

  const handleOpenSequence = () => {
    if (isOpening || isOpen) return
    setIsOpening(true)
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsOpening(false)
    // Mark as read in backend
    markRead(letter.id)
  }

  // Envelope Container Animation variants (entrance, exit, and idle states)
  const containerVariants: Variants = {
    initial: {
      opacity: 0,
      scale: 0.8,
      y: 50,
    },
    closed: {
      opacity: 1,
      y: shouldReduceMotion ? 0 : [0, -6, 0],
      scale: shouldReduceMotion ? 1 : [1, 1.02, 1],
      transition: {
        y: {
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
        scale: {
          duration: 4.5,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
        opacity: { duration: 0.5 },
      },
    },
    opened: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: 100,
      transition: {
        duration: 0.4,
      },
    },
  }

  // Capitalize name helper
  const mascotName = character.charAt(0).toUpperCase() + character.slice(1)

  return (
    <AnimatePresence>
      <div 
        className="fixed z-50 bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-24"
        role="region"
        aria-label="A personal letter from Munch"
      >
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate={isOpening || isOpen ? 'opened' : 'closed'}
          exit="exit"
          className="relative flex items-center justify-center p-4 select-none"
        >
          {/* Close / Dismiss Button */}
          <button
            onClick={handleClose}
            aria-label="Close letter"
            className="absolute top-0 right-0 p-1.5 rounded-full bg-white/80 border border-white/90 text-charcoal/60 hover:text-charcoal/90 hover:bg-white shadow-md z-50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Envelope Wrapper */}
          <div 
            tabIndex={isOpening || isOpen ? -1 : 0}
            role="button"
            aria-expanded={isOpen}
            onClick={handleOpenSequence}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleOpenSequence()
              }
            }}
            className="relative w-72 h-44 bg-[#E9D7C8] rounded-2xl shadow-xl overflow-visible cursor-pointer flex items-center justify-center border border-white/20 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary-dark"
            style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
          >
            {/* Subtle Envelope Glow */}
            {!isOpening && !isOpen && (
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 12px rgba(240, 199, 212, 0.25)', // satin pink glow
                    '0 0 24px rgba(240, 199, 212, 0.55)',
                    '0 0 12px rgba(240, 199, 212, 0.25)'
                  ]
                }}
                transition={{
                  duration: 4.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="absolute inset-0 rounded-2xl -z-10 pointer-events-none"
              />
            )}
            
            {/* 1. RIBBON & BOW (Framer Motion Split Animation) */}
            <AnimatePresence>
              {!isOpening && !isOpen && (
                <>
                  {/* Vertical Ribbon */}
                  <motion.div
                    exit={shouldReduceMotion ? { opacity: 0 } : { y: -80, opacity: 0, transition: { duration: 0.4 } }}
                    className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 bg-[#F0C7D4] z-30 shadow-sm border-x border-[#e8b6c5]"
                  />
                  {/* Horizontal Ribbon */}
                  <motion.div
                    exit={shouldReduceMotion ? { opacity: 0 } : { x: -120, opacity: 0, transition: { duration: 0.4 } }}
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-8 bg-[#F0C7D4] z-30 shadow-sm border-y border-[#e8b6c5]"
                  />
                </>
              )}
            </AnimatePresence>

            {/* 2. WAX SEAL (Framer Motion Fade Out) */}
            <AnimatePresence>
              {!isOpening && !isOpen && (
                <motion.div
                  exit={{ scale: 0.4, opacity: 0, transition: { delay: 0.2, duration: 0.3 } }}
                  className="absolute z-40 w-12 h-12 rounded-full bg-[#C48A7A] border-2 border-[#b57a6b] flex items-center justify-center shadow-lg cursor-pointer"
                >
                  <Heart className="w-5 h-5 text-white/80 fill-white/10" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3. ENVELOPE FLAPS (3D Fold Rendering) */}
            {/* Left Flap */}
            <div 
              className="absolute inset-y-0 left-0 w-[51%] bg-[#D8B4A0] z-20"
              style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }}
            />
            {/* Right Flap */}
            <div 
              className="absolute inset-y-0 right-0 w-[51%] bg-[#D8B4A0] z-20"
              style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }}
            />
            {/* Bottom Flap */}
            <div 
              className="absolute inset-x-0 bottom-0 h-[52%] bg-[#E9D7C8] z-21"
              style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }}
            />
            
            {/* Top Flap (3D Swing Open) */}
            <motion.div
              initial={{ rotateX: 0 }}
              animate={isOpening || isOpen ? { rotateX: 180, zIndex: 5 } : { rotateX: 0, zIndex: 25 }}
              transition={shouldReduceMotion ? { duration: 0.1 } : { delay: 0.4, duration: 0.5, ease: 'easeInOut' }}
              className="absolute inset-x-0 top-0 h-[52%] bg-[#D8B4A0] origin-top"
              style={{ 
                clipPath: 'polygon(0 0, 50% 100%, 100% 0)',
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden'
              }}
            />

            {/* 4. LETTER CARD (Slides upward out of body) */}
            <motion.div
              initial={{ y: 0, scale: 0.95 }}
              animate={isOpening || isOpen ? { y: -130, scale: 1 } : { y: 0, scale: 0.95 }}
              transition={shouldReduceMotion ? { duration: 0.2 } : { delay: 0.8, duration: 0.7, ease: 'easeOut' }}
              onAnimationComplete={() => {
                if (isOpening) setIsOpen(true)
              }}
              className="absolute z-10 w-[92%] h-[92%] rounded-xl p-4 shadow-md flex flex-col justify-between border border-white/40 bg-[#F8F4EF] text-charcoal"
            >
              {/* Note Content */}
              <div className="space-y-2 flex-grow overflow-y-auto pr-1">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={isOpen ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="font-serif italic text-xs leading-relaxed text-charcoal/90 pt-1 text-left"
                >
                  <span className="font-display font-black text-2xs block uppercase tracking-wider text-primary-dark/80 not-italic mb-1.5">
                    A Note from {mascotName} 🍀
                  </span>
                  {messageContent}
                </motion.div>
              </div>

              {/* Signature Row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={isOpen ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex justify-between items-end border-t border-charcoal/10 pt-1.5"
              >
                <span className="text-[10px] font-bold text-charcoal/50 uppercase tracking-widest">
                  Your Companion
                </span>
                <span className="font-display font-black text-xs text-primary-dark capitalize">
                  {character} 🍀
                </span>
              </motion.div>
            </motion.div>

            {/* 5. MASCOT INTEGRATION (Floating next to open letter) */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ scale: 0, opacity: 0, x: -30 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0, opacity: 0, x: -20 }}
                  transition={shouldReduceMotion ? { duration: 0.2 } : { delay: 0.3, duration: 0.4, type: 'spring', stiffness: 120 }}
                  className="absolute z-20 -left-12 -bottom-2"
                >
                  <Mascot character={character} expression={expression} size="sm" className="drop-shadow-lg" />
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
