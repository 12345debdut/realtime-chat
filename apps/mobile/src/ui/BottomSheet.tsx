/**
 * BottomSheet — slide-up action sheet matching the reference design.
 *
 * Anatomy (top → bottom):
 *  ┌─────────────────────────────┐
 *  │      ───  (drag handle)     │  ← handleRow
 *  │                             │
 *  │  [ content / header card ]  │  ← children (BottomSheetHeader, custom)
 *  │  ─────────────────────────  │  ← auto-separator
 *  │  Label                  ⬜  │  ← BottomSheetAction rows
 *  │  ─────────────────────────  │     with hairline between each
 *  │  Label                  ⬜  │
 *  │                             │
 *  │       (home indicator)      │  ← safeBottom
 *  └─────────────────────────────┘
 */
import React, { useCallback, useEffect } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Text } from './Text';
import { useTheme } from './theme/ThemeProvider';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 260;

// ── BottomSheet (container) ───────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const EDGE_INSET = 12;

export function BottomSheet({ visible, onClose, children }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const animateOut = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: ANIM_DURATION });
    backdropOpacity.value = withTiming(0, { duration: ANIM_DURATION }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, translateY, backdropOpacity]);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: ANIM_DURATION });
      backdropOpacity.value = withTiming(1, { duration: ANIM_DURATION });
    } else {
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <View style={styles.container}>
        {/* Dimmed backdrop — tap to dismiss */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={animateOut} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surfaceContainerLowest,
              bottom: Math.max(insets.bottom, EDGE_INSET),
              paddingBottom: insets.bottom > 0 ? 8 : 24,
              // "Ghost Border" fallback — outline-variant at 15% opacity
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(200,202,202,0.15)',
            },
            sheetStyle,
          ]}
        >
          {/* Drag handle pill */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
          </View>

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── BottomSheetHeader — content card at the top of the sheet ──────────
// Renders a rounded, lightly tinted card (like the message preview in the
// reference). Pass any children — text, preview, etc.

interface HeaderProps {
  children: React.ReactNode;
}

export function BottomSheetHeader({ children }: HeaderProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.headerCard,
        { backgroundColor: theme.colors.surfaceContainerHigh },
      ]}
    >
      {children}
    </View>
  );
}

// ── BottomSheetAction — single action row ─────────────────────────────
// Label on the left, icon on the right. Automatically separated by a
// hairline from the next action.

interface ActionRowProps {
  label: string;
  icon: string;
  iconColor?: string;
  labelColor?: string;
  onPress: () => void;
}

export function BottomSheetAction({ label, icon, iconColor, labelColor, onPress }: ActionRowProps) {
  const theme = useTheme();

  return (
    <>
      <View style={[styles.separator, { backgroundColor: theme.colors.surfaceContainerHigh }]} />
      <Pressable
        onPress={onPress}
        android_ripple={{ color: theme.colors.surfaceContainerHigh }}
        style={({ pressed }) => [
          styles.actionRow,
          pressed && { backgroundColor: theme.colors.surfaceContainer },
        ]}
      >
        <Text
          variant="body"
          style={[
            styles.actionLabel,
            { color: labelColor ?? theme.colors.text },
          ]}
        >
          {label}
        </Text>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={iconColor ?? theme.colors.textMuted}
        />
      </Pressable>
    </>
  );
}

// ── BottomSheetDivider — thicker section break ────────────────────────
// Use between logical groups (e.g. between the header/content and the
// action list). Thicker than the auto-separator between action rows.

export function BottomSheetDivider() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.sectionDivider,
        { backgroundColor: theme.colors.surfaceContainerHigh },
      ]}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: EDGE_INSET,
    right: EDGE_INSET,
    borderRadius: 28,
    overflow: 'hidden',
    // "Whisper Shadow" — mimics natural, diffused architectural light
    shadowColor: '#2d2f2f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 40,
    elevation: 24,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },

  // Header card — message preview / context
  headerCard: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  // Thin separator auto-inserted before every action row
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 24,
    marginRight: 24,
  },

  // Thicker divider between logical sections
  sectionDivider: {
    height: 1,
    marginVertical: 4,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: 56,
  },
  actionLabel: {
    fontWeight: '400',
  },
});
