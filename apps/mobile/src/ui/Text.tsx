import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from './theme/ThemeProvider';
import type { TypographyVariant } from './theme/tokens';

interface Props extends TextProps {
  variant?: TypographyVariant;
  color?: 'text' | 'textMuted' | 'textInverse' | 'primary' | 'danger';
}

export function Text({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const theme = useTheme();
  const base: TextStyle = {
    ...theme.typography[variant],
    color: theme.colors[color],
  };
  return <RNText {...rest} style={[base, style]} />;
}
