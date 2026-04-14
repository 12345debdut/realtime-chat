import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useTheme, type ColorProp } from './theme/ThemeProvider';

interface Props {
  name: string;
  size?: number;
  color?: ColorProp;
  rawColor?: string;
}

export function Icon({ name, size = 24, color = 'text', rawColor }: Props) {
  const theme = useTheme();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={rawColor ?? theme.colors[color]}
    />
  );
}
