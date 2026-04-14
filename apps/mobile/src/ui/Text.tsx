import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorProp } from './theme/ThemeProvider';
import type { TypographyVariant } from './theme/tokens';

interface Props extends TextProps {
  variant?: TypographyVariant;
  color?: ColorProp;
  align?: TextStyle['textAlign'];
  uppercase?: boolean;
}

export function Text({
  variant = 'body',
  color = 'text',
  align,
  uppercase,
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  const base: TextStyle = {
    ...theme.typography[variant],
    color: theme.colors[color],
    textAlign: align,
    textTransform: uppercase ? 'uppercase' : undefined,
  };
  return <RNText {...rest} style={[base, style]} />;
}
