import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from './theme/ThemeProvider';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  iconPosition = 'right',
  style,
  fullWidth = true,
}: Props) {
  const theme = useTheme();

  // Primary: dark charcoal pill with light text (inverse-surface)
  // Secondary: ochre pill with on-primary-container text
  const bg =
    variant === 'primary'
      ? theme.colors.inverseSurface
      : variant === 'secondary'
        ? theme.colors.primaryContainer
        : variant === 'danger'
          ? theme.colors.danger
          : theme.colors.transparent;

  const textColor =
    variant === 'primary'
      ? theme.colors.inverseOnSurface
      : variant === 'secondary'
        ? theme.colors.bubbleSelfText
        : variant === 'danger'
          ? theme.colors.onPrimary
          : theme.colors.primary;

  return (
    <PressableScale
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={{
        paddingVertical: theme.spacing.md + 2,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: theme.radii.pill,
        backgroundColor: bg,
        opacity: disabled ? 0.5 : 1,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        ...style,
      }}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <Icon name={icon} size={20} color={textColor} style={{ marginRight: 8 }} />
            )}
            <Text variant="bodyBold" style={{ color: textColor }}>
              {label}
            </Text>
            {icon && iconPosition === 'right' && (
              <Icon name={icon} size={20} color={textColor} style={{ marginLeft: 8 }} />
            )}
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
