import React from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from './theme/ThemeProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  scaleTo?: number;
  style?: ViewStyle;
}

/**
 * Pressable primitive with a subtle spring scale on press.
 * Runs entirely on the UI thread (worklet) — zero JS ↔ native roundtrips.
 */
export function PressableScale({ scaleTo = 0.96, style, children, ...rest }: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, theme.motion.snappySpring);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, theme.motion.snappySpring);
        rest.onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
