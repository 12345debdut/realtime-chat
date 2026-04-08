import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme/ThemeProvider';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled }: Props) {
  const theme = useTheme();
  const isGhost = variant === 'ghost';

  return (
    <PressableScale
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={{
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.md,
        backgroundColor: isGhost ? 'transparent' : theme.colors.primary,
        borderWidth: isGhost ? 1 : 0,
        borderColor: theme.colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={isGhost ? theme.colors.text : theme.colors.textInverse} />
        ) : (
          <Text variant="bodyBold" color={isGhost ? 'text' : 'textInverse'}>
            {label}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
