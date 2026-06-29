/**
 * surface-system.ts
 *
 * Centralized surface registry defining border radius, blur intensities,
 * shadow heights, glass opacity filters, typography hierarchies, and spacing grids.
 */

export interface SurfaceGlass {
  background: string;
  border: string;
  backdropBlur: string;
  shadow: string;
}

export interface TypographyToken {
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  letterSpacing: string;
}

export interface SurfaceSystemConfig {
  radius: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  blur: {
    none: string;
    low: string;
    medium: string;
    high: string;
  };
  shadows: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    clay: string;
  };
  glass: {
    panel: SurfaceGlass;
    card: SurfaceGlass;
    composer: SurfaceGlass;
    chip: SurfaceGlass;
  };
  typography: {
    display: TypographyToken;
    heading: TypographyToken;
    subheading: TypographyToken;
    body: TypographyToken;
    caption: TypographyToken;
    xs: TypographyToken;
  };
  spacing: {
    '3xs': string;
    '2xs': string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
}

export const SURFACE_SYSTEM: SurfaceSystemConfig = {
  radius: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '28px'
  },
  blur: {
    none: 'blur(0px)',
    low: 'blur(6px)',
    medium: 'blur(12px)',
    high: 'blur(20px)'
  },
  shadows: {
    none: 'none',
    sm: '0 2px 8px rgba(74, 74, 74, 0.02)',
    md: '0 4px 20px rgba(74, 74, 74, 0.04)',
    lg: '0 10px 32px rgba(143, 217, 168, 0.08)',
    clay: 'inset 0 -4px 0 0 rgba(107, 191, 138, 0.3), inset 0 4px 0 0 rgba(255, 255, 255, 0.4), 0 6px 12px 0 rgba(143, 217, 168, 0.15)'
  },
  glass: {
    panel: {
      background: 'rgba(255, 255, 255, 0.65)',
      border: '1px solid rgba(255, 255, 255, 0.5)',
      backdropBlur: 'blur(20px)',
      shadow: '0 8px 32px 0 rgba(143, 217, 168, 0.08)'
    },
    card: {
      background: 'rgba(255, 255, 255, 0.8)',
      border: '1px solid rgba(255, 255, 255, 0.6)',
      backdropBlur: 'blur(12px)',
      shadow: '0 4px 20px 0 rgba(74, 74, 74, 0.04)'
    },
    composer: {
      background: 'rgba(255, 255, 255, 0.85)',
      border: '1px solid rgba(143, 217, 168, 0.25)',
      backdropBlur: 'blur(8px)',
      shadow: 'inset 0 2px 4px rgba(74, 74, 74, 0.02)'
    },
    chip: {
      background: '#ffffff',
      border: '2px solid rgba(205, 180, 255, 0.5)',
      backdropBlur: 'blur(4px)',
      shadow: 'inset 0 -3px 0 0 rgba(205, 180, 255, 0.3), 0 4px 8px 0 rgba(74, 74, 74, 0.03)'
    }
  },
  typography: {
    display: {
      fontSize: '24px',
      lineHeight: '1.2',
      fontWeight: '900',
      letterSpacing: '-0.02em'
    },
    heading: {
      fontSize: '20px',
      lineHeight: '1.25',
      fontWeight: '900',
      letterSpacing: '-0.01em'
    },
    subheading: {
      fontSize: '16px',
      lineHeight: '1.3',
      fontWeight: '800',
      letterSpacing: '0em'
    },
    body: {
      fontSize: '14px',
      lineHeight: '1.5',
      fontWeight: '500',
      letterSpacing: '0em'
    },
    caption: {
      fontSize: '11px',
      lineHeight: '1.4',
      fontWeight: '600',
      letterSpacing: '0.02em'
    },
    xs: {
      fontSize: '9px',
      lineHeight: '1.3',
      fontWeight: '700',
      letterSpacing: '0.04em'
    }
  },
  spacing: {
    '3xs': '4px',
    '2xs': '8px',
    xs: '12px',
    sm: '16px',
    md: '20px',
    lg: '24px',
    xl: '32px',
    xxl: '48px'
  }
};
