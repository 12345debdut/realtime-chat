import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme/ThemeProvider';

interface Props {
  uri?: string | null;
  name: string;
  size?: number;
  /** 2px halo ring using surface color (Stitch "Halo Effect") */
  showHalo?: boolean;
  /** Online status dot */
  showStatus?: boolean;
  statusColor?: string;
  style?: ViewStyle;
}

export function Avatar({
  uri,
  name,
  size = 44,
  showHalo,
  showStatus,
  statusColor,
  style,
}: Props) {
  const theme = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const haloSize = showHalo ? size + 4 : size;

  const statusDotSize = Math.max(10, size * 0.24);
  const resolvedStatusColor = statusColor ?? theme.colors.success;

  return (
    <View style={[{ width: haloSize, height: haloSize, alignItems: 'center', justifyContent: 'center' }, style]}>
      {showHalo && (
        <View
          style={{
            position: 'absolute',
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: theme.colors.surface,
          }}
        />
      )}
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      ) : (
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
          <Text
            variant={size >= 48 ? 'title' : 'bodyBold'}
            color="primary"
            style={{ fontSize: size * 0.38 }}
          >
            {initial}
          </Text>
        </View>
      )}
      {showStatus && (
        <View
          style={{
            position: 'absolute',
            bottom: showHalo ? 2 : 0,
            right: showHalo ? 2 : 0,
            width: statusDotSize,
            height: statusDotSize,
            borderRadius: statusDotSize / 2,
            backgroundColor: resolvedStatusColor,
            borderWidth: 2,
            borderColor: theme.colors.surface,
          }}
        />
      )}
    </View>
  );
}
