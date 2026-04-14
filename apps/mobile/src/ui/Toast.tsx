/**
 * Toast — a lightweight slide-up notification.
 *
 * Usage:
 *   <Toast visible={show} message="Request sent!" variant="success" onHide={() => setShow(false)} />
 *
 * Auto-hides after `duration` ms (default 2500).
 * Slides up from below with a spring, fades + slides out on dismiss.
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Text } from './Text';
import { useTheme } from './theme/ThemeProvider';

type Variant = 'success' | 'error' | 'info' | 'loading';

interface Props {
  visible: boolean;
  message: string;
  variant?: Variant;
  duration?: number;
  onHide: () => void;
}

const ICON_MAP: Record<Variant, string> = {
  success: 'check-circle-outline',
  error: 'alert-circle-outline',
  info: 'information-outline',
  loading: 'loading',
};

const SLIDE_DISTANCE = 100;
export const ANIMATION_DURATION = 250;


export function Toast({ visible, message, variant = 'info', duration = 2500, onHide }: Props) {
  const theme = useTheme();
  const translateY = useSharedValue(SLIDE_DISTANCE);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Slide up + fade in
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
    } else {
      // Slide down + fade out
      translateY.value = withTiming(SLIDE_DISTANCE, { duration: ANIMATION_DURATION, easing: Easing.in(Easing.ease) });
      opacity.value = withTiming(0, { duration: ANIMATION_DURATION });
    }
  }, [visible, translateY, opacity]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onHide, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onHide]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const bg =
    variant === 'success'
      ? theme.colors.primary
      : variant === 'error'
        ? theme.colors.danger
        : theme.colors.inverseSurface;

  const fg =
    variant === 'success'
      ? theme.colors.onPrimary
      : variant === 'error'
        ? theme.colors.textInverse
        : theme.colors.inverseOnSurface;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bg, borderRadius: theme.radii.md },
        animatedStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {variant === 'loading' ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <MaterialCommunityIcons name={ICON_MAP[variant]} size={20} color={fg} />
      )}
      <Text variant="caption" style={{ color: fg, flex: 1, fontWeight: '600' }}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
});
