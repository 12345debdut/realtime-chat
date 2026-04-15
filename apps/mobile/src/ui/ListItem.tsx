import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme, type ColorProp } from './theme/ThemeProvider';

interface Props {
  icon?: string;
  iconColor?: ColorProp;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function ListItem({
  icon,
  iconColor = 'primary',
  title,
  subtitle,
  trailing,
  showChevron = true,
  onPress,
  style,
}: Props) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.md + 2,
        gap: theme.spacing.lg,
        ...style,
      }}
    >
      {icon && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surfaceContainerLow,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={20} color={iconColor} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="titleSm">{title}</Text>
        {subtitle && (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {showChevron && <Icon name="chevron-right" size={20} color="textMuted" />}
    </PressableScale>
  );
}
