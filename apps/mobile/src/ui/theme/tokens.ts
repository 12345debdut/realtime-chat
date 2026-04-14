/**
 * Design tokens — Forest Chat design system.
 *
 * Rooted in the "Fluid Dialogue" creative direction:
 *  - Tonal layering (no 1px borders — depth via surface shifts)
 *  - Forest Mint primary (#006953)
 *  - Inter typography with editorial hierarchy
 *  - 8 px base roundness
 */

// ── Spacing ──────────────────────────────────────────────────────────
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

// ── Radii ────────────────────────────────────────────────────────────
export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;
export type Radius = keyof typeof radii;

// ── Typography ───────────────────────────────────────────────────────
// Editorial hierarchy: display → headline → title → body → label → micro
export const typography = {
  display: { fontSize: 44, lineHeight: 52, fontWeight: '700' as const, letterSpacing: -0.5 },
  headline: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  titleSm: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.8 },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
} as const;
export type TypographyVariant = keyof typeof typography;

// ── Colors ───────────────────────────────────────────────────────────
// Surface hierarchy: lowest → low → default → high → highest
// Follows "No-Line Rule" — boundaries defined by background shifts only.

const lightPalette = {
  // Surfaces (layered paper metaphor)
  bg: '#f9f9ff',
  surface: '#f9f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f3fe',
  surfaceContainer: '#ecedf9',
  surfaceContainerHigh: '#e6e8f3',
  surfaceContainerHighest: '#e0e2ed',
  surfaceDim: '#d8d9e5',

  // Brand
  primary: '#006953',
  primaryContainer: '#008469',
  primarySoft: '#e0f5ef',
  onPrimary: '#ffffff',
  inversePrimary: '#5cdcb7',

  // Secondary
  secondary: '#536166',
  secondaryContainer: '#d6e5eb',
  onSecondary: '#ffffff',

  // Tertiary (accent / warning)
  tertiary: '#9e3d00',
  tertiaryContainer: '#c64f00',
  onTertiary: '#ffffff',

  // Text
  text: '#181c23',
  textSecondary: '#414755',
  textMuted: '#717786',
  textInverse: '#ffffff',

  // Outline (ghost borders — use at <=15% opacity)
  outline: '#717786',
  outlineVariant: '#c1c6d7',

  // Feedback
  success: '#22C55E',
  danger: '#ba1a1a',
  dangerContainer: '#ffdad6',
  warning: '#F59E0B',

  // Chat bubbles
  bubbleSelf: '#006953',
  bubbleOther: '#e6e8f3',
  bubbleSelfText: '#ffffff',
  bubbleOtherText: '#181c23',

  // Inverse surface (for toasts / snackbars)
  inverseSurface: '#2d3039',
  inverseOnSurface: '#eef0fc',

  // Surface tint (interaction ripple)
  surfaceTint: '#006b55',

  // Transparent
  transparent: 'transparent',
};

const darkPalette: typeof lightPalette = {
  bg: '#0f1218',
  surface: '#0f1218',
  surfaceContainerLowest: '#0a0d12',
  surfaceContainerLow: '#181c23',
  surfaceContainer: '#1c2029',
  surfaceContainerHigh: '#262b34',
  surfaceContainerHighest: '#31363f',
  surfaceDim: '#0f1218',

  primary: '#5cdcb7',
  primaryContainer: '#008469',
  primarySoft: '#0a2e24',
  onPrimary: '#00382b',
  inversePrimary: '#006953',

  secondary: '#bac9cf',
  secondaryContainer: '#3b494e',
  onSecondary: '#253136',

  tertiary: '#ffb595',
  tertiaryContainer: '#7c2e00',
  onTertiary: '#561f00',

  text: '#e0e2ed',
  textSecondary: '#c1c6d7',
  textMuted: '#8b90a0',
  textInverse: '#181c23',

  outline: '#8b90a0',
  outlineVariant: '#414754',

  success: '#4ADE80',
  danger: '#ffb4ab',
  dangerContainer: '#93000a',
  warning: '#FBBF24',

  bubbleSelf: '#008469',
  bubbleOther: '#262b34',
  bubbleSelfText: '#ffffff',
  bubbleOtherText: '#e0e2ed',

  inverseSurface: '#e0e2ed',
  inverseOnSurface: '#2d3039',

  surfaceTint: '#5cdcb7',

  transparent: 'transparent',
};

export const palettes = { light: lightPalette, dark: darkPalette } as const;
export type Palette = typeof lightPalette;
export type PaletteKey = keyof Palette;
export type ThemeMode = keyof typeof palettes;

// ── Motion ───────────────────────────────────────────────────────────
export const motion = {
  spring: { damping: 18, mass: 0.6, stiffness: 180 },
  snappySpring: { damping: 22, mass: 0.5, stiffness: 260 },
  gentleSpring: { damping: 20, mass: 0.8, stiffness: 120 },
  timing: { duration: 220 },
} as const;
