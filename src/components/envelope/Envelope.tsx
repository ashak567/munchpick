'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion'
import { X, Heart } from 'lucide-react'
import Mascot, { MascotCharacter, MascotExpression } from '@/components/Mascot'
import { useWelcome } from '@/lib/envelope/WelcomeContext'

export default function Envelope() {
  const { state, loading, isEnvelopeOpen, closeEnvelope } = useWelcome()
  const [isOpen, setIsOpen] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  // Reset internal open states when letter changes or is closed
  useEffect(() => {
    if (!isEnvelopeOpen || !state?.letter || state.letter.is_read) {
      setIsOpen(false)
      setIsOpening(false)
    }
  }, [isEnvelopeOpen, state])

  if (loading || !isEnvelopeOpen || !state?.letter || state.letter.is_read) {
    return null
  }

  const letter = state.letter
  const character = (state.mascot_character || 'munch') as MascotCharacter
  const expression = (state.mascot_expression || 'happy') as MascotExpression
  const messageContent = letter.content
  const mascotName = character.charAt(0).toUpperCase() + character.slice(1)

  const handleOpenSequence = () => {
    if (isOpening || isOpen) return
    setIsOpening(true)
  }

  const handleClose = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setIsOpen(false)
    setIsOpening(false)
    await closeEnvelope()
  }

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/25 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-label="A personal letter from Munch"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative flex items-center justify-center select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            aria-label="Close letter"
            className="absolute -top-3 -right-3 p-2 rounded-full bg-white/95 border border-white text-charcoal/70 hover:text-charcoal hover:bg-white shadow-lg z-50 cursor-pointer transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Envelope Body */}
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
            className="relative w-80 h-52 sm:w-96 sm:h-60 bg-[#E9D7C8] rounded-3xl shadow-2xl overflow-visible cursor-pointer flex items-center justify-center border border-white/40 focus:outline-none focus:ring-4 focus:ring-primary/40"
            style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
          >
            {/* Ribbon & Bow */}
            <AnimatePresence>
              {!isOpening && !isOpen && (
                <>
                  <motion.div
                    exit={shouldReduceMotion ? { opacity: 0 } : { y: -90, opacity: 0, transition: { duration: 0.35 } }}
                    className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-10 bg-[#F0C7D4] z-30 shadow-xs border-x border-[#e8b6c5]"
                  />
                  <motion.div
                    exit={shouldReduceMotion ? { opacity: 0 } : { x: -140, opacity: 0, transition: { duration: 0.35 } }}
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 bg-[#F0C7D4] z-30 shadow-xs border-y border-[#e8b6c5]"
                  />
                </>
              )}
            </AnimatePresence>

            {/* Wax Seal */}
            <AnimatePresence>
              {!isOpening && !isOpen && (
                <motion.div
                  exit={{ scale: 0.3, opacity: 0, transition: { delay: 0.1, duration: 0.3 } }}
                  className="absolute z-40 w-14 h-14 rounded-full bg-[#C48A7A] border-2 border-[#b57a6b] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                >
                  <Heart className="w-6 h-6 text-white/90 fill-white/20" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Envelope Flaps */}
            <div 
              className="absolute inset-y-0 left-0 w-[51%] bg-[#D8B4A0] z-20 rounded-l-3xl"
              style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }}
            />
            <div 
              className="absolute inset-y-0 right-0 w-[51%] bg-[#D8B4A0] z-20 rounded-r-3xl"
              style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)' }}
            />
            <div 
              className="absolute inset-x-0 bottom-0 h-[52%] bg-[#E9D7C8] z-21 rounded-b-3xl"
              style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }}
            />
            
            {/* Top Flap */}
            <motion.div
              initial={{ rotateX: 0 }}
              animate={isOpening || isOpen ? { rotateX: 180, zIndex: 5 } : { rotateX: 0, zIndex: 25 }}
              transition={shouldReduceMotion ? { duration: 0.1 } : { delay: 0.3, duration: 0.5, ease: 'easeInOut' }}
              className="absolute inset-x-0 top-0 h-[52%] bg-[#D8B4A0] origin-top rounded-t-3xl"
              style={{ 
                clipPath: 'polygon(0 0, 50% 100%, 100% 0)',
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden'
              }}
            />

            {/* Letter Card */}
            <motion.div
              initial={{ y: 0, scale: 0.95 }}
              animate={isOpening || isOpen ? { y: -160, scale: 1.05 } : { y: 0, scale: 0.95 }}
              transition={shouldReduceMotion ? { duration: 0.2 } : { delay: 0.7, duration: 0.6, ease: 'easeOut' }}
              onAnimationComplete={() => {
                if (isOpening) setIsOpen(true)
              }}
              className="absolute z-10 w-[94%] h-[94%] rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between border border-white/60 bg-[#FCFAF7] text-charcoal"
            >
              <div className="space-y-2 flex-grow overflow-y-auto pr-1 scrollbar-thin">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={isOpen ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="font-serif italic text-xs sm:text-sm leading-relaxed text-charcoal/90 pt-1 text-left"
                >
                  <span className="font-display font-black text-2xs sm:text-xs block uppercase tracking-wider text-primary-dark not-italic mb-2 border-b border-primary/15 pb-1">
                    A Gentle Note from {mascotName} 🍀
                  </span>
                  {messageContent}
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={isOpen ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex justify-between items-end border-t border-charcoal/10 pt-2"
              >
                <span className="text-[10px] font-bold text-charcoal/50 uppercase tracking-widest font-poppins">
                  Your Companion
                </span>
                <span className="font-display font-black text-xs sm:text-sm text-primary-dark capitalize">
                  {character} 🍀
                </span>
              </motion.div>
            </motion.div>

            {/* Companion Mascot */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ scale: 0, opacity: 0, x: -40 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0, opacity: 0, x: -20 }}
                  transition={shouldReduceMotion ? { duration: 0.2 } : { delay: 0.35, duration: 0.45, type: 'spring', stiffness: 120 }}
                  className="absolute z-20 -left-12 sm:-left-16 -bottom-6"
                >
                  <Mascot character={character} expression={expression} size="md" className="drop-shadow-xl" />
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
