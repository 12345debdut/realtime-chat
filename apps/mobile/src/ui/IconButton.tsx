import React from 'react';
import { type ViewStyle } from 'react-native';

import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { type ColorProp } from './theme/ThemeProvider';

interface Props {
  name: string;
  size?: number;
  color?: ColorProp;
  onPress?: () => void;
  hitSlop?: number;
  style?: ViewStyle;
}

export function IconButton({
  name,
  size = 24,
  color = 'text',
  onPress,
  hitSlop = 8,
  style,
}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={hitSlop}
      scaleTo={0.9}
      style={{
        width: size + 16,
        height: size + 16,
        borderRadius: (size + 16) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <Icon name={name} size={size} color={color} />
    </PressableScale>
  );
}
