import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme/ThemeProvider';

interface Props {
  title: string;
  style?: ViewStyle;
}

export function SectionHeader({ title, style }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: theme.spacing.xl,
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.sm,
        },
        style,
      ]}
    >
      <Text variant="label" color="textMuted" uppercase>
        {title}
      </Text>
    </View>
  );
}
