import React from 'react'

export type MascotCharacter = 'munch' | 'ollie' | 'ellie' | 'pandy' | 'dobby' | 'coco' | 'froggy' | 'bubbles' | 'chicky'
export type MascotExpression = 'idle' | 'happy' | 'think' | 'wry'

interface MascotProps {
  character?: MascotCharacter
  expression?: MascotExpression
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
  size = 'md', 
  className = '' 
}: MascotProps) {
  
  // Custom size string or mapping
  const sizeClass = typeof size === 'string' ? SIZE_MAP[size] : ''
  const sizeStyle = typeof size === 'number' ? { width: size, height: size } : undefined

  // Animation class based on expression
  const getAnimationClass = () => {
    if (expression === 'happy') return 'animate-celebrate'
    if (expression === 'wry') return 'animate-sway'
    return 'animate-float'
  }

  // Draw mouth expression
  const renderMouth = (cx = 50, cy = 54) => {
    switch (expression) {
      case 'happy':
        // Open smile
        return <path d={`M ${cx - 7} ${cy} Q ${cx} ${cy + 10} ${cx + 7} ${cy} Z`} fill="#FF8E8E" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" />
      case 'think':
        // Small focused neutral line
        return <path d={`M ${cx - 4} ${cy + 2} Q ${cx} ${cy + 1.5} ${cx + 4} ${cy + 2}`} fill="none" stroke="#4A4A4A" strokeWidth="2.5" strokeLinecap="round" />
      case 'wry':
        // Curved wry mouth
        return <path d={`M ${cx - 5} ${cy + 3} Q ${cx - 2} ${cy - 1} ${cx + 5} ${cy + 2}`} fill="none" stroke="#4A4A4A" strokeWidth="2.5" strokeLinecap="round" />
      case 'idle':
      default:
        // Standard smile
        return <path d={`M ${cx - 4} ${cy} Q ${cx} ${cy + 4} ${cx + 4} ${cy}`} fill="none" stroke="#4A4A4A" strokeWidth="2.5" strokeLinecap="round" />
    }
  }

  // Draw eyes based on expression
  const renderEyes = (lx = 42, rx = 58, y = 50) => {
    const isThinking = expression === 'think'
    const pupilOffset = isThinking ? 2 : 0

    return (
      <g id="eyes">
        {/* Left eye */}
        <circle cx={lx + pupilOffset} cy={y} r="4" fill="#4A4A4A" />
        <circle cx={lx - 1 + pupilOffset} cy={y - 1.5} r="1.2" fill="#FFFFFF" />
        
        {/* Right eye */}
        <circle cx={rx + pupilOffset} cy={y} r="4" fill="#4A4A4A" />
        <circle cx={rx - 1 + pupilOffset} cy={y - 1.5} r="1.2" fill="#FFFFFF" />
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
            {/* Ellie trunk acts as mouth, but let's add a small smile behind trunk */}
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
            {/* Eyes (in the dark patches, so make them white!) */}
            <g id="panda-eyes">
              <circle cx="41" cy="47.5" r="2.2" fill="#FFFFFF" />
              <circle cx="59" cy="47.5" r="2.2" fill="#FFFFFF" />
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
            {/* Stripes */}
            <path d="M 28 38 L 34 38 M 72 38 L 66 38 M 50 25 L 50 31" stroke="#E68A4C" strokeWidth="2" strokeLinecap="round" />
            {/* Whiskers */}
            <line x1="22" y1="52" x2="31" y2="52" stroke="#4A4A4A" strokeWidth="1.5" />
            <line x1="23" y1="56" x2="30" y2="55" stroke="#4A4A4A" strokeWidth="1.5" />
            <line x1="78" y1="52" x2="69" y2="52" stroke="#4A4A4A" strokeWidth="1.5" />
            <line x1="77" y1="56" x2="70" y2="55" stroke="#4A4A4A" strokeWidth="1.5" />
            {/* Nose */}
            <polygon points="50,51 48,49 52,49" fill="#FF8E8E" />
            {/* Cheeks */}
            <ellipse cx="34" cy="52" rx="3" ry="1.5" fill="#FFCFB3" />
            <ellipse cx="66" cy="52" rx="3" ry="1.5" fill="#FFCFB3" />
            {/* Eyes & Mouth */}
            {renderEyes(41, 59, 45)}
            {renderMouth(50, 52)}
          </g>
        )

      case 'froggy': // Frog -> Calm (Green)
        return (
          <g id="froggy-frog">
            {/* Protruding Eye Pods */}
            <circle cx="37" cy="27" r="9.5" fill="#8FE28F" stroke="#6BCE6B" strokeWidth="2.5" />
            <circle cx="63" cy="27" r="9.5" fill="#8FE28F" stroke="#6BCE6B" strokeWidth="2.5" />
            {/* Frog Body */}
            <rect x="25" y="31" width="50" height="49" rx="24" fill="#8FE28F" stroke="#6BCE6B" strokeWidth="2.5" />
            {/* Cheeks */}
            <ellipse cx="33" cy="51" rx="4" ry="2.5" fill="#FF9A9A" opacity="0.75" />
            <ellipse cx="67" cy="51" rx="4" ry="2.5" fill="#FF9A9A" opacity="0.75" />
            {/* Inner pupil dots */}
            <g id="froggy-eyes">
              <circle cx="37" cy="27" r="4.5" fill="#4A4A4A" />
              <circle cx="36" cy="25" r="1.5" fill="#FFFFFF" />
              <circle cx="63" cy="27" r="4.5" fill="#4A4A4A" />
              <circle cx="62" cy="25" r="1.5" fill="#FFFFFF" />
            </g>
            {renderMouth(50, 48)}
          </g>
        )

      case 'bubbles': // Fish -> Openness (Teal)
        return (
          <g id="bubbles-fish">
            {/* Tail Fin */}
            <path d="M 26 50 L 10 38 L 15 50 L 10 62 Z" fill="#7AE0D3" stroke="#4FBFA3" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Back Fin */}
            <path d="M 45 33 C 50 25, 60 25, 55 33 Z" fill="#7AE0D3" stroke="#4FBFA3" strokeWidth="2" />
            {/* Body */}
            <ellipse cx="50" cy="50" rx="26" ry="18" fill="#7AE0D3" stroke="#4FBFA3" strokeWidth="2.5" />
            {/* Bubbles */}
            <circle cx="80" cy="40" r="3" fill="none" stroke="#4FBFA3" strokeWidth="1.5" className="animate-float" />
            <circle cx="86" cy="30" r="2" fill="none" stroke="#4FBFA3" strokeWidth="1.2" className="animate-float-delayed" />
            {/* Cheeks */}
            <ellipse cx="60" cy="53" rx="3" ry="1.5" fill="#FFCFB3" />
            {/* Eyes & Mouth (drawn sideways context) */}
            <circle cx="64" cy="45" r="4" fill="#4A4A4A" />
            <circle cx="63" cy="43.5" r="1.2" fill="#FFFFFF" />
            {renderMouth(70, 50)}
          </g>
        )

      case 'chicky': // Chick -> Joy (Yellow)
        return (
          <g id="chicky-chick">
            {/* Hair Tuft */}
            <path d="M 50 26 Q 50 14 54 18" fill="none" stroke="#E6C46B" strokeWidth="2" strokeLinecap="round" />
            {/* Wings */}
            <path d="M 25 52 Q 17 50 24 58" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" strokeLinecap="round" />
            <path d="M 75 52 Q 83 50 76 58" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2" strokeLinecap="round" />
            {/* Body */}
            <circle cx="50" cy="50" r="25" fill="#FFE08A" stroke="#E6C46B" strokeWidth="2.5" />
            {/* Beak */}
            <polygon points="50,53 45,47 55,47" fill="#FFAF7A" stroke="#E68A4C" strokeWidth="1.5" />
            {/* Cheeks */}
            <circle cx="34" cy="52" r="3" fill="#FFCFB3" />
            <circle cx="66" cy="52" r="3" fill="#FFCFB3" />
            {/* Eyes & Mouth */}
            {renderEyes(40, 60, 44)}
            {renderMouth(50, 52)}
          </g>
        )

      case 'munch': // Clover -> Understanding (Green)
      default:
        return (
          <g id="munch-clover">
            {/* 4 leaf clover base */}
            <path d="M 50 50 Q 30 30 50 10 Q 70 30 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            <path d="M 50 50 Q 70 30 90 50 Q 70 70 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            <path d="M 50 50 Q 70 70 50 90 Q 30 70 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            <path d="M 50 50 Q 30 70 10 50 Q 30 30 50 50 Z" fill="#8FD9A8" stroke="#6BBF8A" strokeWidth="2.5" />
            
            {/* Stem */}
            <path d="M 50 50 Q 55 70 65 85" fill="none" stroke="#6BBF8A" strokeWidth="3" strokeLinecap="round" />
            
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

  return (
    <div 
      className={`relative inline-block ${sizeClass} ${className}`}
      style={sizeStyle}
    >
      <svg 
        viewBox="0 0 100 100" 
        className={`w-full h-full ${getAnimationClass()}`}
        style={{ transformOrigin: 'bottom center' }}
      >
        {renderCharacterSVG()}
      </svg>
    </div>
  )
}
