import { Variants } from 'framer-motion';

// Centralized physical spring presets
export const SPRINGS = {
  snap: { type: 'spring', stiffness: 380, damping: 30 },
  smooth: { type: 'spring', stiffness: 220, damping: 24 },
  loose: { type: 'spring', stiffness: 120, damping: 18 },
  slowBounce: { type: 'spring', stiffness: 90, damping: 12 }
};

// Transition configuration mappings
export const TRANSITIONS = {
  tiny: { duration: 0.12, ease: 'easeOut' },
  small: { duration: 0.2, ease: 'easeOut' },
  medium: { duration: 0.35, ease: 'easeInOut' },
  large: { duration: 0.5, ease: 'easeInOut' }
};

// Centralized animations variants registry
export const MOTION_SYSTEM_VARIANTS = {
  pageFade: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: TRANSITIONS.medium },
    exit: { opacity: 0, y: -10, transition: TRANSITIONS.small }
  } as Variants,

  sidebarSlide: {
    expanded: { width: 260, transition: SPRINGS.smooth },
    collapsed: { width: 80, transition: SPRINGS.smooth }
  } as Variants,

  messageEntrance: {
    initial: { opacity: 0, y: 12, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1, transition: SPRINGS.smooth }
  } as Variants,

  bubbleTyping: {
    animate: {
      scale: [1, 1.06, 1],
      opacity: [0.75, 1, 0.75],
      transition: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }
    }
  } as Variants,

  composerTransition: {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: SPRINGS.smooth }
  } as Variants,

  navIndicator: {
    active: { scale: 1, opacity: 1, transition: SPRINGS.snap },
    inactive: { scale: 0.8, opacity: 0 }
  } as Variants,

  cardReveal: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: TRANSITIONS.medium }
  } as Variants,

  modalEntrance: {
    initial: { opacity: 0, scale: 0.95, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0, transition: SPRINGS.smooth },
    exit: { opacity: 0, scale: 0.95, y: 12, transition: TRANSITIONS.small }
  } as Variants,

  drawerSlide: {
    open: { x: 0, transition: SPRINGS.smooth },
    closed: { x: '-100%', transition: SPRINGS.smooth }
  } as Variants,

  celebrationBounce: {
    animate: {
      y: [0, -12, 0, -4, 0],
      transition: { duration: 1.2, ease: 'easeInOut' }
    }
  } as Variants
};

// Interactive scale helpers
export const INTERACTION_PRESETS = {
  hover: { scale: 1.02, y: -1, transition: SPRINGS.snap },
  press: { scale: 0.98, y: 0, transition: SPRINGS.snap }
};
