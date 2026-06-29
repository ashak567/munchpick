/**
 * WorkspaceTheme.ts
 *
 * Centralized theme system defining colors, shadows, glassmorphism panel styling,
 * border curves, spacing tokens, and elevations.
 *
 * Components consume this configuration to ensure visual consistency.
 */

export interface GlassStyle {
  background: string;
  border: string;
  backdropBlur: string;
  shadow: string;
}

export interface WorkspaceThemeConfig {
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    secondaryDark: string;
    yellow: string;
    coral: string;
    cream: string;
    charcoal: string;
  };
  glass: {
    panel: GlassStyle;
    card: GlassStyle;
    input: GlassStyle;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    clay: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  spacing: {
    compact: string;
    comfortable: string;
    expanded: string;
  };
}

export const WORKSPACE_THEME: WorkspaceThemeConfig = {
  colors: {
    primary: '#8FD9A8',
    primaryDark: '#6BBF8A',
    secondary: '#CDB4FF',
    secondaryDark: '#A98EE6',
    yellow: '#FFE08A',
    coral: '#FFCFB3',
    cream: '#FFF9F5',
    charcoal: '#4A4A4A'
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
    input: {
      background: 'rgba(255, 255, 255, 0.85)',
      border: '1px solid rgba(143, 217, 168, 0.25)',
      backdropBlur: 'blur(8px)',
      shadow: 'inset 0 2px 4px rgba(74, 74, 74, 0.02)'
    }
  },
  shadows: {
    sm: '0 2px 8px rgba(74, 74, 74, 0.02)',
    md: '0 4px 20px rgba(74, 74, 74, 0.04)',
    lg: '0 10px 30px rgba(143, 217, 168, 0.1)',
    clay: 'inset 0 -4px 0 0 rgba(107, 191, 138, 0.3), inset 0 4px 0 0 rgba(255, 255, 255, 0.4), 0 6px 12px 0 rgba(143, 217, 168, 0.15)'
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '28px'
  },
  spacing: {
    compact: '12px',
    comfortable: '20px',
    expanded: '32px'
  }
};
export type { GlassStyle as ThemeGlassStyle, WorkspaceThemeConfig as ThemeConfig };
