/**
 * Design tokens — single source of truth for spacing, radii, typography.
 * Colors are split into light/dark palettes and resolved by ThemeProvider.
 */

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;
export type Spacing = keyof typeof spacing;

export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;
export type Radius = keyof typeof radii;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
} as const;
export type TypographyVariant = keyof typeof typography;

const lightPalette = {
  bg: '#FFFFFF',
  bgElevated: '#F7F7F9',
  bgMuted: '#EEF0F3',
  border: '#E3E6EB',
  text: '#0B0D12',
  textMuted: '#5B6472',
  textInverse: '#FFFFFF',
  primary: '#3B82F6',
  primarySoft: '#DBEAFE',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  bubbleSelf: '#3B82F6',
  bubbleOther: '#EEF0F3',
  bubbleSelfText: '#FFFFFF',
  bubbleOtherText: '#0B0D12',
};

const darkPalette: typeof lightPalette = {
  bg: '#0B0D12',
  bgElevated: '#12151C',
  bgMuted: '#1A1E27',
  border: '#262B36',
  text: '#F4F6F8',
  textMuted: '#9199A6',
  textInverse: '#0B0D12',
  primary: '#60A5FA',
  primarySoft: '#1E3A8A',
  success: '#4ADE80',
  danger: '#F87171',
  warning: '#FBBF24',
  bubbleSelf: '#2563EB',
  bubbleOther: '#1A1E27',
  bubbleSelfText: '#FFFFFF',
  bubbleOtherText: '#F4F6F8',
};

export const palettes = { light: lightPalette, dark: darkPalette } as const;
export type Palette = typeof lightPalette;
export type ThemeMode = keyof typeof palettes;

export const motion = {
  spring: { damping: 18, mass: 0.6, stiffness: 180 },
  snappySpring: { damping: 22, mass: 0.5, stiffness: 260 },
  timing: { duration: 220 },
} as const;
