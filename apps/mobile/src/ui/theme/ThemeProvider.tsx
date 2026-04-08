import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { motion, palettes, radii, spacing, typography, type Palette, type ThemeMode } from './tokens';

export interface Theme {
  mode: ThemeMode;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'dark' ? 'dark' : 'light';

  const value = useMemo<Theme>(
    () => ({
      mode,
      colors: palettes[mode],
      spacing,
      radii,
      typography,
      motion,
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
