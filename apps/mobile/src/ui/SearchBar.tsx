import React from 'react';
import { TextInput, View, type ViewStyle } from 'react-native';

import { Icon } from './Icon';
import { useTheme } from './theme/ThemeProvider';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  style,
}: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surfaceContainerHigh,
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          gap: theme.spacing.sm,
        },
        style,
      ]}
    >
      <Icon name="magnify" size={20} color="textMuted" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          flex: 1,
          fontSize: theme.typography.body.fontSize,
          color: theme.colors.text,
          padding: 0,
        }}
      />
    </View>
  );
}
