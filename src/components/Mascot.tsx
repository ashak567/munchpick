'use client'
 
import React, { useState, useEffect } from 'react'
import { motion, Variants } from 'framer-motion'
import { getMascotCached } from '@/lib/assets-client'
import { 
  MASCOT_EXPRESSION_REGISTRY, 
  MASCOT_ANIMATION_REGISTRY, 
  PRESENCE_MODE_MULTIPLIERS,
  PRESENCE_INTENSITY_MULTIPLIERS,
  MascotCharacter,
  PresenceMode,
  PresenceIntensity,
  AttentionTarget,
  MicroReaction,
  AnimationBudget
} from './mascot-config'

export type { MascotCharacter, PresenceMode, PresenceIntensity, AttentionTarget, MicroReaction, AnimationBudget }

export type MascotExpression = 
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'happy'
  | 'encouraging'
  | 'curious'
  | 'celebrating'
  | 'calm'
  | 'wry'

interface MascotProps {
  character?: MascotCharacter
  expression?: MascotExpression | string
  mode?: PresenceMode
  intensity?: PresenceIntensity
  attentionTarget?: AttentionTarget
  pupilOffsets?: { x: number; y: number }
  microReaction?: MicroReaction
  animationBudget?: AnimationBudget
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  className?: string
}

const SIZE_MAP = {
  xs: 'w-8 h-8',
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32'
}

export default function Mascot({ 
  character = 'munch', 
  expression = 'idle', 
  mode = 'companion',
  intensity = 'medium',
  pupilOffsets = { x: 0, y: 0 },
  microReaction = 'none',
  animationBudget = 'medium',
  size = 'md', 
  className = '' 
}: MascotProps) {
  
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let active = true
    async function loadMascot() {
      try {
        setLoading(true)
        const url = await getMascotCached(character)
        if (active) {
          if (url) {
            setImageUrl(url)
            setHasError(false)
          } else {
            setImageUrl(null)
            setHasError(true)
          }
        }
      } catch (err) {
        console.warn(`[Mascot Component] Failed to load mascot asset ${character}:`, err)
        if (active) {
          setImageUrl(null)
          setHasError(true)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }
    loadMascot()
    return () => {
      active = false
    }
  }, [character])

  const sizeClass = typeof size === 'string' ? SIZE_MAP[size] : ''
  const sizeStyle = typeof size === 'number' ? { width: size, height: size } : undefined

  // Draw mouth expression using config template replacement
  const renderMouth = (cx = 50, cy = 54) => {
    const exprConfig = MASCOT_EXPRESSION_REGISTRY[expression] || MASCOT_EXPRESSION_REGISTRY.idle
    
    // Replace {cx} and {cy} template values with actual coordinates
    let path = exprConfig.mouthPath
      .replace(/{cx\s*-\s*(\d+)}/g, (_, offset) => (cx - Number(offset)).toString())
      .replace(/{cx\s*\+\s*(\d+)}/g, (_, offset) => (cx + Number(offset)).toString())
      .replace(/{cy\s*-\s*(\d+)}/g, (_, offset) => (cy - Number(offset)).toString())
      .replace(/{cy\s*\+\s*(\d+)}/g, (_, offset) => (cy + Number(offset)).toString())
      .replace(/{cx}/g, cx.toString())
      .replace(/{cy}/g, cy.toString())

    const isOpenSmile = expression === 'happy' || expression === 'celebrating'

    return (
      <path 
        d={path} 
        fill={isOpenSmile ? '#FF8E8E' : 'none'} 
        stroke="#4A4A4A" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
      />
    )
  }

  // Draw eyes based on config style and attention target translations
  const renderEyes = (lx = 42, rx = 58, y = 50) => {
    const exprConfig = MASCOT_EXPRESSION_REGISTRY[expression] || MASCOT_EXPRESSION_REGISTRY.idle
    const isWry = exprConfig.eyeStyle === 'wry'
    
    // Combine wry pupillary offsets with resolved attention target offsets
    const finalPupilOffsetX = pupilOffsets.x + (isWry ? 1.5 : 0)
    const finalPupilOffsetY = pupilOffsets.y

    const isCalm = exprConfig.eyeStyle === 'calm'
    
    // Force blinking when micro reaction triggers it
    const forceBlink = microReaction === 'blink'

    if (isCalm && !forceBlink) {
      // Curved closed/calm eyes
      return (
        <g id="eyes">
          <path d={`M ${lx - 4} ${y} Q ${lx} ${y + 3} ${lx + 4} ${y}`} fill="none" stroke="#4A4A4A" strokeWidth="2.5" strokeLinecap="round" />
          <path d={`M ${rx - 4} ${y} Q ${rx} ${y + 3} ${rx + 4} ${y}`} fill="none" stroke="#4A4A4A" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )
    }

    // Blink timings scaled down under low animations budget
    const blinkDuration = animationBudget === 'reduced-motion' ? 12.0 : 6.0
    const blinkDelay = animationBudget === 'reduced-motion' ? 8.0 : 4.0

    return (
      <g id="eyes">
        {/* Left eye */}
        <motion.g
          animate={forceBlink ? { scaleY: 0.1 } : { scaleY: [1, 1, 0.1, 1, 1] }}
          transition={forceBlink ? { duration: 0.15 } : {
            duration: blinkDuration,
            repeat: Infinity,
            repeatDelay: blinkDelay,
            ease: 'easeInOut'
          }}
          style={{ transformOrigin: `${lx + finalPupilOffsetX}px ${y}px` }}
        >
          <circle cx={lx + finalPupilOffsetX} cy={y + finalPupilOffsetY} r="4" fill="#4A4A4A" />
          <circle cx={lx - 1 + finalPupilOffsetX} cy={y - 1.5 + finalPupilOffsetY} r="1.2" fill="#FFFFFF" />
        </motion.g>
        
        {/* Right eye */}
        <motion.g
          animate={forceBlink ? { scaleY: 0.1 } : { scaleY: [1, 1, 0.1, 1, 1] }}
          transition={forceBlink ? { duration: 0.15 } : {
            duration: blinkDuration,
            repeat: Infinity,
            repeatDelay: blinkDelay,
            ease: 'easeInOut'
          }}
          style={{ transformOrigin: `${rx + finalPupilOffsetX}px ${y}px` }}
        >
          <circle cx={rx + finalPupilOffsetX} cy={y + finalPupilOffsetY} r="4" fill="#4A4A4A" />
          <circle cx={rx - 1 + finalPupilOffsetX} cy={y - 1.5 + finalPupilOffsetY} r="1.2" fill="#FFFFFF" />
        </motion.g>
      </g>
    )
  }

  // Render SVG content for each mascot character
  const renderCharacterSVG = () => {
    switch (character) {
      case 'ollie': // Owl -> Reflection (Violet)
        return (
          <g id="ollie-owl">
            {/* Ears/Horns */}
            <polygon points="25,35 20,18 38,28" fill="#CDB4FF" stroke="#A98EE6" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="75,35 80,18 62,28" fill="#CDB4FF" stroke="#A98EE6" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Body */}
            <rect x="25" y="25" width="50" height="55" rx="25" fill="#CDB4FF" stroke="#A98EE6" strokeWidth="2.5" />
            {/* Belly */}
            <ellipse cx="50" cy="62" rx="16" ry="12" fill="#FFF9F5" stroke="#A98EE6" strokeWidth="1.5" />
            <path d="M 46 58 Q 50 61 54 58 M 44 64 Q 50 67 56 64" fill="none" stroke="#4A4A4A" strokeWidth="1.5" />
            {/* Beak */}
            <polygon points="50,49 46,43 54,43" fill="#FFE08A" stroke="#E6C46B" strokeWidth="1.5" />
            {/* Cheeks */}
            <ellipse cx="34" cy="53" rx="3.5" ry="2" fill="#FFCFB3" />
            <ellipse cx="66" cy="53" rx="3.5" ry="2" fill="#FFCFB3" />
            {/* Eyes & Mouth */}
            {renderEyes(39, 61, 46)}
            {renderMouth(50, 52)}
          </g>
        )

      case 'ellie': // Elephant -> Reassurance (Blue)
        return (
          <g id="ellie-elephant">
            {/* Big Ears */}
            <circle cx="23" cy="45" r="18" fill="#BCE3FF" stroke="#8DC6FF" strokeWidth="2.5" />
            <circle cx="77" cy="45" r="18" fill="#BCE3FF" stroke="#8DC6FF" strokeWidth="2.5" />
            <circle cx="23" cy="45" r="10" fill="#E5F4FF" />
            <circle cx="77" cy="45" r="10" fill="#E5F4FF" />
            {/* Body */}
            <rect x="27" y="26" width="46" height="54" rx="23" fill="#D5EFFF" stroke="#8DC6FF" strokeWidth="2.5" />
            {/* Trunk */}
            <path d="M 50 51 Q 52 69 42 69" fill="none" stroke="#8DC6FF" strokeWidth="6" strokeLinecap="round" />
            <path d="M 50 51 Q 52 69 42 69" fill="none" stroke="#4A4A4A" strokeWidth="2.5" strokeLinecap="round" />
            {/* Cheeks */}
            <ellipse cx="36" cy="54" rx="3" ry="1.5" fill="#FFCFB3" />
            <ellipse cx="64" cy="54" rx="3" ry="1.5" fill="#FFCFB3" />
            {/* Eyes */}
            {renderEyes(41, 59, 47)}
            {/* Ellie trunk acts as mouth */}
            {renderMouth(50, 53)}
          </g>
        )

      case 'pandy': // Panda -> Comfort (Black & White)
        return (
          <g id="pandy-panda">
            {/* Ears */}
            <circle cx="30" cy="30" r="8.5" fill="#4A4A4A" stroke="#4A4A4A" strokeWidth="1" />
            <circle cx="70" cy="30" r="8.5" fill="#4A4A4A" stroke="#4A4A4A" strokeWidth="1" />
            {/* Body */}
            <rect x="25" y="27" width="50" height="54" rx="25" fill="#FFFFFF" stroke="#4A4A4A" strokeWidth="2.5" />
            {/* Eye Patches */}
            <ellipse cx="40" cy="48" rx="7.5" ry="6" fill="#4A4A4A" transform="rotate(-15 40 48)" />
            <ellipse cx="60" cy="48" rx="7.5" ry="6" fill="#4A4A4A" transform="rotate(15 60 48)" />
            {/* Nose */}
            <polygon points="50,54 48,51 52,51" fill="#4A4A4A" />
            {/* Cheeks */}
            <ellipse cx="32" cy="55" rx="3" ry="1.5" fill="#FFCFB3" />
            <ellipse cx="68" cy="55" rx="3" ry="1.5" fill="#FFCFB3" />
            {/* Eyes */}
            <g id="panda-eyes">
              <motion.circle 
                cx="41" cy="47.5" r="2.2" fill="#FFFFFF" 
                animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
                transition={{ duration: 6.0, repeat: Infinity, repeatDelay: 4.0, ease: 'easeInOut' }}
                style={{ transformOrigin: '41px 47.5px' }}
              />
              <motion.circle 
                cx="59" cy="47.5" r="2.2" fill="#FFFFFF" 
                animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
                transition={{ duration: 6.0, repeat: Infinity, repeatDelay: 4.0, ease: 'easeInOut' }}
                style={{ transformOrigin: '59px 47.5px' }}
              />
            </g>
            {renderMouth(50, 57)}
          </g>
        )

      case 'dobby': // Dog -> Encouragement (Brown)
        return (
          <g id="dobby-dog">
            {/* Droopy Ears */}
            <path d="M 28 32 Q 18 36 24 55 Q 31 55 30 38" fill="#A77A50" stroke="#4A4A4A" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M 72 32 Q 82 36 76 55 Q 69 55 70 38" fill="#A77A50" stroke="#4A4A4A" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Body */}
            <rect x="27" y="26" width="46" height="54" rx="23" fill="#EAD5C3" stroke="#A77A50" strokeWidth="2.5" />
            {/* Eye Spot */}
            <circle cx="39" cy="46" r="7.5" fill="#C5A880" opacity="0.6" />
            {/* Snout */}
            <ellipse cx="50" cy="55" rx="6.5" ry="4.5" fill="#FFF9F5" stroke="#4A4A4A" strokeWidth="1.5" />
            <ellipse cx="50" cy="53" rx="2.5" ry="1.5" fill="#4A4A4A" />
            {/* Cheeks */}
            <ellipse cx="34" cy="54" rx="3" ry="1.5" fill="#FFCFB3" />
            <ellipse cx="66" cy="54" rx="3" ry="1.5" fill="#FFCFB3" />
            {/* Eyes & Mouth */}
            {renderEyes(40, 60, 46)}
            {renderMouth(50, 56)}
          </g>
        )

      case 'coco': // Cat -> Curiosity (Orange)
        return (
          <g id="coco-cat">
            {/* Pointy Ears */}
            <polygon points="28,32 18,14 38,24" fill="#FFAF7A" stroke="#E68A4C" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="72,32 82,14 62,24" fill="#FFAF7A" stroke="#E68A4C" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Inner Ears */}
            <polygon points="27,29 21,17 33,24" fill="#FFCFB3" />
            <polygon points="73,29 79,17 67,24" fill="#FFCFB3" />
            {/* Body */}
            <rect x="26" y="24" width="48" height="56" rx="24" fill="#FFAF7A" stroke="#E68A4C" strokeWidth="2.5" />
            {/* Nose */}
            <polygon points="50,50 48,47 52,47" fill="#E68A4C" />
            {/* Cheeks */}
            <ellipse cx="33" cy="52" rx="3" ry="1.5" fill="#FFCFB3" />
            <ellipse cx="67" cy="52" rx="3" ry="1.5" fill="#FFCFB3" />
            {/* Whiskers */}
            <path d="M 22 51 L 10 49 M 22 55 L 8 55 M 78 51 L 90 49 M 78 55 L 92 55" stroke="#4A4A4A" strokeWidth="1.5" />
            {/* Eyes & Mouth */}
            {renderEyes(39, 61, 46)}
            {renderMouth(50, 53)}
          </g>
        )

      case 'froggy': // Frog -> Calm (Green)
        return (
          <g id="froggy-frog">
            {/* Eyes Bulges */}
            <circle cx="34" cy="32" r="11" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            <circle cx="66" cy="32" r="11" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            {/* Body */}
            <rect x="22" y="32" width="56" height="48" rx="24" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            {/* Cheeks */}
            <ellipse cx="28" cy="52" rx="4" ry="2.2" fill="#FFCFB3" />
            <ellipse cx="72" cy="52" rx="4" ry="2.2" fill="#FFCFB3" />
            {/* Eyes & Mouth */}
            {renderEyes(34, 66, 32)}
            {renderMouth(50, 53)}
          </g>
        )

      case 'bubbles': // Fish -> Flow (Cyan)
        return (
          <g id="bubbles-fish">
            {/* Tail Fin */}
            <path d="M 25 50 Q 8 36 12 50 Q 8 64 25 50" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" strokeLinejoin="round" />
            {/* Dorsal Fin */}
            <path d="M 46 25 Q 60 12 70 25 Z" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" />
            {/* Body */}
            <ellipse cx="54" cy="50" rx="30" ry="25" fill="#BCE3FF" stroke="#8DC6FF" strokeWidth="2.5" />
            {/* Cheeks */}
            <ellipse cx="62" cy="54" rx="3" ry="1.8" fill="#FFCFB3" />
            {/* Eyes & Mouth */}
            {renderEyes(66, 76, 44)}
            {renderMouth(76, 54)}
          </g>
        )

      case 'chicky': // Chicken -> Cheer (Yellow)
        return (
          <g id="chicky-chicken">
            {/* Comb */}
            <path d="M 45 23 Q 50 12 55 23 Z" fill="#FF8E8E" stroke="#FF5C5C" strokeWidth="1.5" />
            {/* Wings */}
            <path d="M 24 50 Q 14 52 20 62 Z" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" />
            <path d="M 76 50 Q 86 52 80 62 Z" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" />
            {/* Body */}
            <circle cx="50" cy="50" r="26" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2.5" />
            {/* Beak */}
            <polygon points="50,56 45,50 55,50" fill="#FFCFB3" stroke="#E68A4C" strokeWidth="1.5" />
            {/* Cheeks */}
            <ellipse cx="34" cy="51" rx="3" ry="1.5" fill="#FFCFB3" />
            <ellipse cx="66" cy="51" rx="3" ry="1.5" fill="#FFCFB3" />
            {/* Eyes & Mouth */}
            {renderEyes(39, 61, 44)}
            {renderMouth(50, 52)}
          </g>
        )

      case 'munch': // Default Clover mascot
      default:
        return (
          <g id="munch-clover">
            {/* Clover stem */}
            <path d="M 50 50 Q 55 70 65 85" fill="none" stroke="#6BBF8A" strokeWidth="3" strokeLinecap="round" />
            {/* Leaf 1 */}
            <path d="M 50 50 Q 30 35 50 20 Q 70 35 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            {/* Leaf 2 */}
            <path d="M 50 50 Q 32 60 20 44 Q 32 28 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            {/* Leaf 3 */}
            <path d="M 50 50 Q 68 60 80 44 Q 68 28 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            {/* Cheeks */}
            <ellipse cx="36" cy="55" rx="3.5" ry="2" fill="#FFCFB3" />
            <ellipse cx="64" cy="55" rx="3.5" ry="2" fill="#FFCFB3" />
            {/* Eyes & Mouth */}
            {renderEyes(42, 58, 50)}
            {renderMouth(50, 54)}
          </g>
        )
    }
  }

  // Calculate presence mode & intensity multipliers
  const modeMult = PRESENCE_MODE_MULTIPLIERS[mode] || PRESENCE_MODE_MULTIPLIERS.companion
  const intensityMult = PRESENCE_INTENSITY_MULTIPLIERS[intensity] || PRESENCE_INTENSITY_MULTIPLIERS.medium
  
  const isReducedMotion = animationBudget === 'reduced-motion'
  const isLowBudget = animationBudget === 'low'

  const speedScalar = isReducedMotion ? 0.001 : (modeMult.speed * intensityMult.speed)
  const amplitudeScalar = isReducedMotion ? 0.0 : (isLowBudget ? 0.45 : 1.0) * (modeMult.amplitude * intensityMult.amplitude)

  // Build scaled framer-motion variants
  const mascotVariants: Variants = {}
  for (const [key, anim] of Object.entries(MASCOT_ANIMATION_REGISTRY)) {
    mascotVariants[key] = {
      y: anim.y ? anim.y.map(val => val * amplitudeScalar) : undefined,
      scaleY: anim.scaleY ? anim.scaleY.map(val => 1 + (val - 1) * amplitudeScalar) : undefined,
      rotate: anim.rotate ? anim.rotate.map(val => val * amplitudeScalar) : undefined,
      scale: anim.scale ? anim.scale.map(val => 1 + (val - 1) * amplitudeScalar) : undefined,
      transition: {
        duration: isReducedMotion ? 99999 : (anim.transition.duration / speedScalar),
        repeat: isReducedMotion ? 0 : anim.transition.repeat,
        ease: anim.transition.ease as any,
        repeatType: anim.transition.repeatType
      }
    }
  }

  // Define micro-reactions motion targets
  const getMicroReactionAnimate = () => {
    if (isReducedMotion) return undefined
    switch (microReaction) {
      case 'nod':
        return { y: 3.5, scaleY: 0.94 }
      case 'tilt':
        return { rotate: 6 }
      case 'bounce':
        return { y: -8, scaleY: [1, 0.9, 1.1, 1] }
      case 'head_turn':
        return { rotate: -4, x: -2 }
      case 'tail_wag':
      case 'ear_wiggle':
        return { scale: [1, 1.05, 0.95, 1] }
      default:
        return undefined
    }
  }

  const getAnimationVariant = () => {
    const exprConfig = MASCOT_EXPRESSION_REGISTRY[expression] || MASCOT_EXPRESSION_REGISTRY.idle
    return exprConfig.animationKey
  }

  const resolvedConfig = MASCOT_EXPRESSION_REGISTRY[expression] || MASCOT_EXPRESSION_REGISTRY.idle
  const spring = resolvedConfig.spring

  const resolvedStiffness = Math.max(10, spring.stiffness * speedScalar)
  const resolvedDamping = Math.max(5, spring.damping / amplitudeScalar)

  const showParticles = (expression === 'happy' || expression === 'celebrating') && !isReducedMotion

  return (
    <motion.div 
      className={`relative inline-block ${sizeClass} ${className} transition-all`}
      style={{
        ...sizeStyle,
        cursor: 'pointer'
      }}
      variants={mascotVariants}
      animate={getMicroReactionAnimate() || getAnimationVariant()}
      whileHover={isReducedMotion ? {} : {
        scale: 1.05,
        rotate: 1.5,
        transition: { type: 'spring', stiffness: 200, damping: 15 }
      }}
      whileTap={isReducedMotion ? {} : {
        scale: 0.95,
        rotate: -1.5,
        transition: { type: 'spring', stiffness: 300, damping: 12 }
      }}
      transition={{
        type: 'spring',
        stiffness: resolvedStiffness,
        damping: resolvedDamping
      }}
    >
      {loading ? (
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-45">
          {renderCharacterSVG()}
        </svg>
      ) : imageUrl && !hasError ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img 
          src={imageUrl} 
          alt={character} 
          onError={() => setHasError(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {renderCharacterSVG()}
        </svg>
      )}

      {/* Tiny Sparkle Particles for Celebrating/Happy states */}
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none overflow-visible">
          <motion.span 
            className="absolute text-yellow-400 text-xs"
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], x: -8, y: -16 }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.1 }}
            style={{ left: '10%', top: '20%' }}
          >
            ✨
          </motion.span>
          <motion.span 
            className="absolute text-yellow-300 text-[8px]"
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.1, 0.5], x: 8, y: -20 }}
            transition={{ duration: 2.2, repeat: Infinity, delay: 0.6 }}
            style={{ right: '15%', top: '15%' }}
          >
            ✨
          </motion.span>
        </div>
      )}
    </motion.div>
  )
}
