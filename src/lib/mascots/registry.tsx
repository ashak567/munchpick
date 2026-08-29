import React from 'react'
import { motion } from 'framer-motion'
import { MASCOT_EXPRESSION_REGISTRY } from '@/components/mascot-config'

export type MascotCharacter =
  | 'munch'
  | 'ollie'
  | 'ellie'
  | 'pandy'
  | 'dobby'
  | 'coco'
  | 'froggy'
  | 'bubbles'
  | 'chicky'

export interface MascotIdentity {
  id: MascotCharacter
  name: string
  species: string
  themeColor: string
  personality: string
  greetingStyle: string
  idleAnimation: string
  description: string
  renderSVG: (
    expression: string,
    pupilOffsets: { x: number; y: number },
    microReaction: string,
    animationBudget?: string
  ) => React.ReactNode
}

// Helper to render eyes with blink & attention offsets
function renderEyes(
  lx: number,
  rx: number,
  y: number,
  expression: string,
  pupilOffsets: { x: number; y: number },
  microReaction: string,
  animationBudget = 'medium'
) {
  const exprConfig = MASCOT_EXPRESSION_REGISTRY[expression] || MASCOT_EXPRESSION_REGISTRY.idle
  const isWry = exprConfig.eyeStyle === 'wry'
  const finalPupilOffsetX = pupilOffsets.x + (isWry ? 1.5 : 0)
  const finalPupilOffsetY = pupilOffsets.y
  const isCalm = exprConfig.eyeStyle === 'calm'
  const forceBlink = microReaction === 'blink'

  if (isCalm && !forceBlink) {
    return (
      <g id="eyes">
        <path d={`M ${lx - 4} ${y} Q ${lx} ${y + 3} ${lx + 4} ${y}`} fill="none" stroke="#4A4A4A" strokeWidth="2.5" strokeLinecap="round" />
        <path d={`M ${rx - 4} ${y} Q ${rx} ${y + 3} ${rx + 4} ${y}`} fill="none" stroke="#4A4A4A" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    )
  }

  const isReducedMotion = animationBudget === 'reduced-motion'
  const blinkDuration = isReducedMotion ? 12.0 : 6.0
  const blinkDelay = isReducedMotion ? 8.0 : 4.0

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

// Helper to render mouth path based on expression
function renderMouth(cx: number, cy: number, expression: string) {
  const exprConfig = MASCOT_EXPRESSION_REGISTRY[expression] || MASCOT_EXPRESSION_REGISTRY.idle
  
  const path = exprConfig.mouthPath
    .replace(/{cx\s*-\s*(\d+(?:\.\d+)?)}/g, (_, offset) => (cx - Number(offset)).toString())
    .replace(/{cx\s*\+\s*(\d+(?:\.\d+)?)}/g, (_, offset) => (cx + Number(offset)).toString())
    .replace(/{cy\s*-\s*(\d+(?:\.\d+)?)}/g, (_, offset) => (cy - Number(offset)).toString())
    .replace(/{cy\s*\+\s*(\d+(?:\.\d+)?)}/g, (_, offset) => (cy + Number(offset)).toString())
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

export const MASCOT_REGISTRY: Record<MascotCharacter, MascotIdentity> = {
  munch: {
    id: 'munch',
    name: 'Munch',
    species: 'Four-Leaf Clover',
    themeColor: 'green',
    personality: 'balanced, structured, clear',
    greetingStyle: 'friendly and grounding',
    idleAnimation: 'float',
    description: 'Guides the user calmly through options, highlighting trade-offs without making choices for them.',
    renderSVG: (expr, pupil, react, budget) => (
      <g id="munch-clover">
        {/* Clover stem */}
        <path d="M 50 50 Q 55 70 65 85" fill="none" stroke="#6BBF8A" strokeWidth="3" strokeLinecap="round" />
        {/* Leaf 1 - top */}
        <path d="M 50 50 Q 30 35 50 20 Q 70 35 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
        {/* Leaf 2 - left */}
        <path d="M 50 50 Q 32 60 20 44 Q 32 28 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
        {/* Leaf 3 - right */}
        <path d="M 50 50 Q 68 60 80 44 Q 68 28 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
        {/* Leaf 4 - bottom (Added to restore true 4-leaf clover identity) */}
        <path d="M 50 50 Q 35 65 50 74 Q 65 65 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
        {/* Cheeks */}
        <ellipse cx="36" cy="55" rx="3.5" ry="2" fill="#FFCFB3" />
        <ellipse cx="64" cy="55" rx="3.5" ry="2" fill="#FFCFB3" />
        {renderEyes(42, 58, 50, expr, pupil, react, budget)}
        {renderMouth(50, 54, expr)}
      </g>
    )
  },
  ollie: {
    id: 'ollie',
    name: 'Ollie',
    species: 'Owl',
    themeColor: 'violet',
    personality: 'wise, curious, philosophical',
    greetingStyle: 'reflective and analytical',
    idleAnimation: 'float',
    description: 'Asks reflective questions to help user reframe their problems or look at them from another angle.',
    renderSVG: (expr, pupil, react, budget) => (
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
        {renderEyes(39, 61, 46, expr, pupil, react, budget)}
        {renderMouth(50, 52, expr)}
      </g>
    )
  },
  ellie: {
    id: 'ellie',
    name: 'Ellie',
    species: 'Elephant',
    themeColor: 'blue',
    personality: 'supportive, loyal, protective',
    greetingStyle: 'steady and warm',
    idleAnimation: 'sway',
    description: 'Protects user\'s emotional safety, reassuring them when they feel anxious or doubtful.',
    renderSVG: (expr, pupil, react, budget) => (
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
        {renderEyes(41, 59, 47, expr, pupil, react, budget)}
        {renderMouth(50, 53, expr)}
      </g>
    )
  },
  pandy: {
    id: 'pandy',
    name: 'Pandy',
    species: 'Panda',
    themeColor: 'monochrome',
    personality: 'gentle, comforting, slow-paced',
    greetingStyle: 'comforting and peaceful',
    idleAnimation: 'float',
    description: 'Reminds you that it is completely okay to rest, take a break, and proceed at your own pace.',
    renderSVG: (expr, pupil, react, budget) => (
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
        {renderMouth(50, 57, expr)}
      </g>
    )
  },
  dobby: {
    id: 'dobby',
    name: 'Dobby',
    species: 'Dog',
    themeColor: 'brown',
    personality: 'motivational, enthusiastic, energetic',
    greetingStyle: 'active and cheerful',
    idleAnimation: 'sway',
    description: 'Brings high energy to help users take small steps, build momentum, and celebrate choices.',
    renderSVG: (expr, pupil, react, budget) => (
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
        {renderEyes(40, 60, 46, expr, pupil, react, budget)}
        {renderMouth(50, 56, expr)}
      </g>
    )
  },
  coco: {
    id: 'coco',
    name: 'Coco',
    species: 'Cat',
    themeColor: 'orange',
    personality: 'curious, cozy, playful',
    greetingStyle: 'warm and creative',
    idleAnimation: 'sway',
    description: 'Brings curious energy to explore cozy possibilities and creative thoughts.',
    renderSVG: (expr, pupil, react, budget) => (
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
        {renderEyes(39, 61, 46, expr, pupil, react, budget)}
        {renderMouth(50, 53, expr)}
      </g>
    )
  },
  froggy: {
    id: 'froggy',
    name: 'Froggy',
    species: 'Frog',
    themeColor: 'green',
    personality: 'calm, grounded, tranquil',
    greetingStyle: 'quiet and peaceful',
    idleAnimation: 'calm',
    description: 'Helps users slow down when overwhelmed, offering simple breathing and grounding support.',
    renderSVG: (expr, pupil, react, budget) => (
      <g id="froggy-frog">
        {/* Eyes Bulges */}
        <circle cx="34" cy="32" r="11" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
        <circle cx="66" cy="32" r="11" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
        {/* Body */}
        <rect x="22" y="32" width="56" height="48" rx="24" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
        {/* Cheeks */}
        <ellipse cx="28" cy="52" rx="4" ry="2.2" fill="#FFCFB3" />
        <ellipse cx="72" cy="52" rx="4" ry="2.2" fill="#FFCFB3" />
        {renderEyes(34, 66, 32, expr, pupil, react, budget)}
        {renderMouth(50, 53, expr)}
      </g>
    )
  },
  bubbles: {
    id: 'bubbles',
    name: 'Bubbles',
    species: 'Fish',
    themeColor: 'cyan',
    personality: 'flowing, relaxed, adaptive',
    greetingStyle: 'flowy and drift-friendly',
    idleAnimation: 'float',
    description: 'Flows with whatever you share, reminding you that thoughts can drift and flow naturally.',
    renderSVG: (expr, pupil, react, budget) => (
      <g id="bubbles-fish">
        {/* Tail Fin */}
        <path d="M 25 50 Q 8 36 12 50 Q 8 64 25 50" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" strokeLinejoin="round" />
        {/* Dorsal Fin */}
        <path d="M 46 25 Q 60 12 70 25 Z" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" />
        {/* Body */}
        <ellipse cx="54" cy="50" rx="30" ry="25" fill="#BCE3FF" stroke="#8DC6FF" strokeWidth="2.5" />
        {/* Cheeks */}
        <ellipse cx="62" cy="54" rx="3" ry="1.8" fill="#FFCFB3" />
        {renderEyes(66, 76, 44, expr, pupil, react, budget)}
        {renderMouth(76, 54, expr)}
      </g>
    )
  },
  chicky: {
    id: 'chicky',
    name: 'Chicky',
    species: 'Chicken',
    themeColor: 'yellow',
    personality: 'bright, bubbly, celebrating',
    greetingStyle: 'joyful and optimistic',
    idleAnimation: 'float',
    description: 'Focuses on positive progress, celebrating wins, and bringing a cheerful chirp of warmth to your day.',
    renderSVG: (expr, pupil, react, budget) => (
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
        {renderEyes(39, 61, 44, expr, pupil, react, budget)}
        {renderMouth(50, 52, expr)}
      </g>
    )
  }
}
