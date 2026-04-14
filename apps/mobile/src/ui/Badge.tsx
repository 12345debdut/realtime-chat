import React from 'react';
import { View } from 'react-native';

import { Text } from './Text';
import { useTheme, type ColorProp } from './theme/ThemeProvider';

interface Props {
  label?: string;
  color?: ColorProp;
  size?: 'sm' | 'md';
}

export function Badge({ label, color = 'primary', size = 'sm' }: Props) {
  const theme = useTheme();
  const h = size === 'sm' ? 18 : 22;
  const px = size === 'sm' ? 6 : 8;

  if (!label) {
    return (
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: theme.colors[color],
        }}
      />
    );
  }

  return (
    <View
      style={{
        minWidth: h,
        height: h,
        borderRadius: h / 2,
        backgroundColor: theme.colors[color],
        paddingHorizontal: px,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="micro" style={{ color: theme.colors.onPrimary, fontSize: size === 'sm' ? 10 : 12 }}>
        {label}
      </Text>
    </View>
  );
}
