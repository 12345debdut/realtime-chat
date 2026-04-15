/**
 * Design tokens — Lumina design system.
 *
 * Creative North Star: "The Digital Curator"
 *  - High-End Editorial Minimalism
 *  - Ochre / Bone / Charcoal palette
 *  - Tonal layering (no 1px borders — depth via surface shifts)
 *  - Manrope (editorial display) + Inter (functional body)
 *  - "No-Line Rule" — contrast is the new border
 */

// ── Font families ───────────────────────────────────────────────────
// Montserrat — clean, geometric, modern typeface across the app.
// 4 weights bundled: Regular (400), Medium (500), SemiBold (600), Bold (700).
// iOS uses the font family name; Android uses per-weight filenames.
import { Platform } from 'react-native';

const FONT = Platform.select({
  ios: 'Montserrat',
  default: 'Montserrat-Regular',
});

const FONT_MEDIUM = Platform.select({
  ios: 'Montserrat',
  default: 'Montserrat-Medium',
});

const FONT_SEMIBOLD = Platform.select({
  ios: 'Montserrat',
  default: 'Montserrat-SemiBold',
});

const FONT_BOLD = Platform.select({
  ios: 'Montserrat',
  default: 'Montserrat-Bold',
});

export const fontFamily = {
  display: FONT_BOLD,
  body: FONT,
} as const;

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
// Dual-font hierarchy: Manrope (display/headline) + Inter (body/label).
// "White space gravity" — larger, heavier headers pull the eye down.
export const typography = {
  display:  { fontSize: 44, lineHeight: 52, fontWeight: '700' as const, letterSpacing: -0.5, fontFamily: FONT_BOLD },
  headline: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.3, fontFamily: FONT_SEMIBOLD },
  title:    { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, fontFamily: FONT_SEMIBOLD },
  titleSm:  { fontSize: 16, lineHeight: 22, fontWeight: '600' as const, fontFamily: FONT_SEMIBOLD },
  body:     { fontSize: 16, lineHeight: 22, fontWeight: '400' as const, fontFamily: FONT },
  bodyBold: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const, fontFamily: FONT_SEMIBOLD },
  caption:  { fontSize: 13, lineHeight: 18, fontWeight: '400' as const, fontFamily: FONT },
  label:    { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.8, fontFamily: FONT_SEMIBOLD },
  micro:    { fontSize: 11, lineHeight: 14, fontWeight: '500' as const, fontFamily: FONT_MEDIUM },
} as const;
export type TypographyVariant = keyof typeof typography;

// ── Colors ───────────────────────────────────────────────────────────
// Ochre / Bone / Charcoal palette.
// Surface hierarchy: lowest → low → default → high → highest
// "No-Line Rule" — boundaries defined by background shifts only.

const lightPalette = {
  // Surfaces (layered stationery metaphor — bone/cream tones)
  bg: '#f6f6f6',
  surface: '#f6f6f6',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f0f1f1',
  surfaceContainer: '#e8e8e6',
  surfaceContainerHigh: '#dbdddd',
  surfaceContainerHighest: '#d0d2d2',
  surfaceDim: '#d6d6d4',

  // Brand (Ochre)
  primary: '#705900',
  primaryContainer: '#fecb00',
  primarySoft: '#fff4cc',
  onPrimary: '#ffffff',
  inversePrimary: '#fecb00',

  // Secondary (Warm grey)
  secondary: '#5a5c5c',
  secondaryContainer: '#e0e2e2',
  onSecondary: '#ffffff',

  // Tertiary (Warm brown accent)
  tertiary: '#8b4513',
  tertiaryContainer: '#ffdcc0',
  onTertiary: '#ffffff',

  // Text (Charcoal hierarchy — headlines dark, body lighter)
  text: '#2d2f2f',
  textSecondary: '#5a5c5c',
  textMuted: '#7a7c7c',
  textInverse: '#ffffff',

  // Outline ("Ghost Border" — use at ≤15% opacity)
  outline: '#7a7c7c',
  outlineVariant: '#c8caca',

  // Feedback
  success: '#22C55E',
  danger: '#ba1a1a',
  dangerContainer: '#ffdad6',
  warning: '#F59E0B',

  // Chat bubbles (signature ochre / bone)
  bubbleSelf: '#fecb00',
  bubbleOther: '#ffffff',
  bubbleSelfText: '#584500',
  bubbleOtherText: '#2d2f2f',

  // Inverse surface (charcoal — for toasts, primary buttons)
  inverseSurface: '#0c0f0f',
  inverseOnSurface: '#f0f1f1',

  // Surface tint (ochre interaction ripple)
  surfaceTint: '#705900',

  // Transparent
  transparent: 'transparent',
};

const darkPalette: typeof lightPalette = {
  // Surfaces (deep charcoal layers)
  bg: '#121210',
  surface: '#121210',
  surfaceContainerLowest: '#0c0c0a',
  surfaceContainerLow: '#1c1c1a',
  surfaceContainer: '#242422',
  surfaceContainerHigh: '#2e2e2c',
  surfaceContainerHighest: '#393937',
  surfaceDim: '#121210',

  // Brand (Bright ochre on dark)
  primary: '#e8b800',
  primaryContainer: '#564400',
  primarySoft: '#2a2200',
  onPrimary: '#3b2e00',
  inversePrimary: '#705900',

  // Secondary
  secondary: '#c8caca',
  secondaryContainer: '#424444',
  onSecondary: '#2d2f2f',

  // Tertiary
  tertiary: '#ffb77c',
  tertiaryContainer: '#6b3410',
  onTertiary: '#4a2500',

  // Text (Light bone tones)
  text: '#e8e6e0',
  textSecondary: '#c0beb8',
  textMuted: '#8a8880',
  textInverse: '#2d2f2f',

  // Outline
  outline: '#8a8880',
  outlineVariant: '#484846',

  // Feedback
  success: '#4ADE80',
  danger: '#ffb4ab',
  dangerContainer: '#93000a',
  warning: '#FBBF24',

  // Chat bubbles
  bubbleSelf: '#e8b800',
  bubbleOther: '#2e2e2c',
  bubbleSelfText: '#2d2200',
  bubbleOtherText: '#e8e6e0',

  // Inverse
  inverseSurface: '#e8e6e0',
  inverseOnSurface: '#2d2f2f',

  // Surface tint
  surfaceTint: '#e8b800',

  // Transparent
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
