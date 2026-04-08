/**
 * TypingDots — three dots bouncing on staggered springs, purely on the UI thread.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../../ui/theme/ThemeProvider';

const DOT = 6;

export function TypingDots({ visible }: { visible: boolean }) {
  const theme = useTheme();
  const v1 = useSharedValue(0);
  const v2 = useSharedValue(0);
  const v3 = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      v1.value = 0;
      v2.value = 0;
      v3.value = 0;
      return;
    }
    const loop = (sv: typeof v1, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(withTiming(-4, { duration: 280 }), withTiming(0, { duration: 280 })),
          -1,
          false,
        ),
      );
    };
    loop(v1, 0);
    loop(v2, 120);
    loop(v3, 240);
  }, [visible, v1, v2, v3]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: v1.value }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: v2.value }] }));
  const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: v3.value }] }));

  if (!visible) return null;

  return (
    <View
      style={[styles.bubble, { backgroundColor: theme.colors.bubbleOther }]}
      accessibilityLabel="typing"
    >
      <Animated.View style={[dot(theme), s1]} />
      <Animated.View style={[dot(theme), s2]} />
      <Animated.View style={[dot(theme), s3]} />
    </View>
  );
}

const dot = (theme: ReturnType<typeof useTheme>) => ({
  width: DOT,
  height: DOT,
  borderRadius: DOT / 2,
  marginHorizontal: 3,
  backgroundColor: theme.colors.textMuted,
});

const styles = StyleSheet.create({
  bubble: {
    alignSelf: 'flex-start',
    marginHorizontal: 12,
    marginVertical: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
  },
});
