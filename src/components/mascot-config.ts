export type MascotCharacter =
  | 'munch'
  | 'ollie'
  | 'ellie'
  | 'pandy'
  | 'dobby'
  | 'coco'
  | 'froggy'
  | 'bubbles'
  | 'chicky';

export type PresenceMode =
  | 'companion'
  | 'assistant'
  | 'reflective'
  | 'celebration'
  | 'focus'
  | 'quiet';

export type PresenceIntensity = 'low' | 'medium' | 'high';

export type AttentionTarget = 'user' | 'message' | 'composer' | 'thinking' | 'nothing';

export type InteractionState = 'idle' | 'typing' | 'waiting' | 'returning' | 'welcome' | 'goodbye';

export type MicroReaction =
  | 'none'
  | 'nod'
  | 'blink'
  | 'tilt'
  | 'bounce'
  | 'ear_wiggle'
  | 'tail_wag'
  | 'head_turn';

export type AnimationBudget = 'high' | 'medium' | 'low' | 'reduced-motion';

export interface SpringConfig {
  stiffness: number;
  damping: number;
}

export interface MascotAnimation {
  y?: number[];
  scaleY?: number[];
  rotate?: number[];
  scale?: number[];
  transition: {
    duration: number;
    repeat: number;
    ease: string;
    repeatType?: 'reverse' | 'loop' | 'mirror';
  };
}

export interface ExpressionLifetime {
  minimumDuration: number; // in ms
  maximumDuration?: number; // in ms
  cooldown?: number; // in ms
  interruptible: boolean;
}

export interface MascotExpressionConfigItem {
  id: string;
  priority: number;
  animationKey: string;
  mouthPath: string; // Describes the mouth shape (arc, flat line, etc.)
  eyeStyle: 'blink' | 'calm' | 'wide' | 'wry';
  lifetime: ExpressionLifetime;
  spring: SpringConfig;
}

export const MASCOT_SPRING_DEFAULTS: SpringConfig = {
  stiffness: 120,
  damping: 20
};

// Mode-based physics multipliers for speed and amplitude
export const PRESENCE_MODE_MULTIPLIERS: Record<PresenceMode, { speed: number; amplitude: number }> = {
  companion: { speed: 1.0, amplitude: 1.0 },
  assistant: { speed: 1.15, amplitude: 0.9 },
  reflective: { speed: 0.8, amplitude: 1.0 },
  celebration: { speed: 1.35, amplitude: 1.3 },
  focus: { speed: 0.7, amplitude: 0.65 },
  quiet: { speed: 0.5, amplitude: 0.5 }
};

// Intensity-based physics multipliers
export const PRESENCE_INTENSITY_MULTIPLIERS: Record<PresenceIntensity, { speed: number; amplitude: number }> = {
  low: { speed: 0.75, amplitude: 0.7 },
  medium: { speed: 1.0, amplitude: 1.0 },
  high: { speed: 1.25, amplitude: 1.35 }
};

// Transition matrix defining duration overrides in ms between specific states
export const MASCOT_TRANSITION_MATRIX: Record<string, Record<string, number>> = {
  idle: {
    listening: 200,
    thinking: 300
  },
  thinking: {
    celebrating: 600,
    calm: 400,
    idle: 500
  },
  celebrating: {
    idle: 1000,
    calm: 800
  }
};

export const MASCOT_ANIMATION_REGISTRY: Record<string, MascotAnimation> = {
  float: {
    y: [0, -3, 0],
    scaleY: [1, 1.015, 1], // Breathing loop
    transition: {
      duration: 5.0,
      repeat: Infinity,
      ease: 'easeInOut',
      repeatType: 'reverse'
    }
  },
  listening: {
    y: [0, -1.5, 0],
    rotate: [-1, 1, -1],
    transition: {
      duration: 3.5,
      repeat: Infinity,
      ease: 'easeInOut',
      repeatType: 'reverse'
    }
  },
  think: {
    y: [0, -1.5, 0],
    rotate: [-2.5, 2.5, -2.5],
    scale: [1, 1.025, 1],
    transition: {
      duration: 4.0,
      repeat: Infinity,
      ease: 'easeInOut',
      repeatType: 'reverse'
    }
  },
  celebrate: {
    y: [0, -4, 0],
    scaleY: [1, 0.97, 1.03, 1],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
      repeatType: 'mirror'
    }
  },
  sway: {
    rotate: [-1.5, 1.5, -1.5],
    transition: {
      duration: 4.5,
      repeat: Infinity,
      ease: 'easeInOut',
      repeatType: 'reverse'
    }
  },
  calm: {
    scaleY: [1, 1.02, 1], // breathing only
    transition: {
      duration: 6.0,
      repeat: Infinity,
      ease: 'easeInOut',
      repeatType: 'reverse'
    }
  }
};

// Extensible and configuration-driven registry for expression behaviors
export const MASCOT_EXPRESSION_REGISTRY: Record<string, MascotExpressionConfigItem> = {
  idle: {
    id: 'idle',
    priority: 10,
    animationKey: 'float',
    mouthPath: 'M {cx - 4} {cy} Q {cx} {cy + 4} {cx + 4} {cy}', // standard smile
    eyeStyle: 'blink',
    lifetime: { minimumDuration: 500, interruptible: true },
    spring: MASCOT_SPRING_DEFAULTS
  },
  listening: {
    id: 'listening',
    priority: 50,
    animationKey: 'listening',
    mouthPath: 'M {cx - 4} {cy} Q {cx} {cy + 2} {cx + 4} {cy}', // gentle curved neutral
    eyeStyle: 'blink',
    lifetime: { minimumDuration: 600, interruptible: true },
    spring: { stiffness: 100, damping: 22 }
  },
  thinking: {
    id: 'thinking',
    priority: 100,
    animationKey: 'think',
    mouthPath: 'M {cx - 4} {cy + 2} Q {cx} {cy + 1.5} {cx + 4} {cy + 2}', // focused straight line
    eyeStyle: 'blink',
    lifetime: { minimumDuration: 800, interruptible: false },
    spring: { stiffness: 90, damping: 18 }
  },
  happy: {
    id: 'happy',
    priority: 60,
    animationKey: 'celebrate',
    mouthPath: 'M {cx - 7} {cy} Q {cx} {cy + 10} {cx + 7} {cy} Z', // open smile
    eyeStyle: 'wide',
    lifetime: { minimumDuration: 1000, interruptible: true },
    spring: MASCOT_SPRING_DEFAULTS
  },
  encouraging: {
    id: 'encouraging',
    priority: 65,
    animationKey: 'sway',
    mouthPath: 'M {cx - 4} {cy} Q {cx} {cy + 5} {cx + 4} {cy}', // warm smile
    eyeStyle: 'blink',
    lifetime: { minimumDuration: 1200, interruptible: true },
    spring: MASCOT_SPRING_DEFAULTS
  },
  curious: {
    id: 'curious',
    priority: 40,
    animationKey: 'sway',
    mouthPath: 'M {cx - 4} {cy + 1} Q {cx} {cy + 3} {cx + 4} {cy + 1}', // slight curved question mouth
    eyeStyle: 'wry',
    lifetime: { minimumDuration: 1000, interruptible: true },
    spring: { stiffness: 130, damping: 24 }
  },
  celebrating: {
    id: 'celebrating',
    priority: 70,
    animationKey: 'celebrate',
    mouthPath: 'M {cx - 7} {cy} Q {cx} {cy + 10} {cx + 7} {cy} Z', // open smile
    eyeStyle: 'wide',
    lifetime: { minimumDuration: 1500, interruptible: false },
    spring: MASCOT_SPRING_DEFAULTS
  },
  calm: {
    id: 'calm',
    priority: 30,
    animationKey: 'calm',
    mouthPath: 'M {cx - 4} {cy + 2} Q {cx} {cy + 2} {cx + 4} {cy + 2}', // soft line
    eyeStyle: 'calm',
    lifetime: { minimumDuration: 1000, interruptible: true },
    spring: { stiffness: 80, damping: 25 }
  },
  wry: {
    id: 'wry',
    priority: 45,
    animationKey: 'sway',
    mouthPath: 'M {cx - 5} {cy + 3} Q {cx - 2} {cy - 1} {cx + 5} {cy + 2}', // wry mouth
    eyeStyle: 'wry',
    lifetime: { minimumDuration: 800, interruptible: true },
    spring: MASCOT_SPRING_DEFAULTS
  }
};
export type MascotExpression = keyof typeof MASCOT_EXPRESSION_REGISTRY;
