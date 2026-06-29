import { Variants } from 'framer-motion';

export const WORKSPACE_SPRING = {
  type: 'spring',
  stiffness: 220,
  damping: 24
} as const;

export const SIDEBAR_VARIANTS: Variants = {
  expanded: {
    width: 260,
    transition: WORKSPACE_SPRING
  },
  collapsed: {
    width: 80,
    transition: WORKSPACE_SPRING
  }
};

export const PAGE_FADE_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 10
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.25, ease: 'easeIn' }
  }
};

export const NAV_INDICATOR_VARIANTS: Variants = {
  active: {
    scale: 1,
    opacity: 1,
    transition: WORKSPACE_SPRING
  },
  inactive: {
    scale: 0.8,
    opacity: 0
  }
};

export const HOVER_TAP_PRESETS = {
  hover: {
    scale: 1.02,
    y: -1,
    transition: { type: 'spring', stiffness: 400, damping: 15 }
  },
  tap: {
    scale: 0.98,
    y: 0,
    transition: { type: 'spring', stiffness: 500, damping: 12 }
  }
};

export const MESSAGE_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 15,
    scale: 0.96
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: WORKSPACE_SPRING
  }
};

export const COMPOSER_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 20
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: WORKSPACE_SPRING
  }
};

export const STAGE_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: WORKSPACE_SPRING
  }
};

export const CARD_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    y: 8
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

export const DRAWER_VARIANTS: Variants = {
  open: {
    x: 0,
    transition: WORKSPACE_SPRING
  },
  closed: {
    x: '-100%',
    transition: WORKSPACE_SPRING
  }
};

export const MODAL_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
    y: 10
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: WORKSPACE_SPRING
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: { duration: 0.2, ease: 'easeIn' }
  }
};
