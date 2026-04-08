import React from 'react';
import { Image, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme/ThemeProvider';

interface Props {
  uri?: string | null;
  name: string;
  size?: number;
}

export function Avatar({ uri, name, size = 44 }: Props) {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="bodyBold" color="primary">
        {initial}
      </Text>
    </View>
  );
}
