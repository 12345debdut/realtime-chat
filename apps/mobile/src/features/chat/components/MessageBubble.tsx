/**
 * MessageBubble — swipe-to-reply + long-press reaction showcase.
 *
 * Gestures run in Reanimated worklets, so the spring/clamp logic never
 * crosses the JS bridge. `runOnJS` is used only to notify React when a
 * threshold is crossed (e.g. haptic, open reply composer).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  FadeIn,
  Layout,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '../../../ui/Text';
import { useTheme } from '../../../ui/theme/ThemeProvider';

interface Props {
  body: string;
  fromSelf: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: number;
  onReply?: () => void;
  onReact?: () => void;
}

const REPLY_THRESHOLD = 56;

export function MessageBubble({ body, fromSelf, status, createdAt, onReply, onReact }: Props) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);

  const pan = Gesture.Pan()
    .activeOffsetX(fromSelf ? [-999, -8] : [8, 999])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = clamp(e.translationX, fromSelf ? -120 : 0, fromSelf ? 0 : 120);
    })
    .onEnd(() => {
      const crossed = Math.abs(translateX.value) >= REPLY_THRESHOLD;
      translateX.value = withSpring(0, { damping: 22, stiffness: 260 });
      if (crossed && onReply) runOnJS(onReply)();
    });

  const longPress = Gesture.LongPress()
    .minDuration(280)
    .onStart(() => {
      scale.value = withSpring(1.04, { damping: 14, stiffness: 220 });
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      if (onReact) runOnJS(onReact)();
    });

  const composed = Gesture.Simultaneous(pan, longPress);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
  }));

  const replyHintStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / REPLY_THRESHOLD, 1);
    return {
      opacity: progress,
      transform: [{ scale: 0.6 + progress * 0.4 }],
    };
  });

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      layout={Layout.springify().damping(22)}
      style={[styles.row, fromSelf ? styles.rowSelf : styles.rowOther]}
    >
      {/* Reply hint — fades in as the bubble is swiped */}
      <Animated.View
        style={[
          styles.replyHint,
          fromSelf ? styles.replyHintSelf : styles.replyHintOther,
          replyHintStyle,
        ]}
      >
        <Text variant="micro" color="textMuted">
          ↩ Reply
        </Text>
      </Animated.View>

      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.bubble,
            {
              backgroundColor: fromSelf ? theme.colors.bubbleSelf : theme.colors.bubbleOther,
              borderTopRightRadius: fromSelf ? theme.radii.sm : theme.radii.lg,
              borderTopLeftRadius: fromSelf ? theme.radii.lg : theme.radii.sm,
            },
            bubbleStyle,
          ]}
        >
          <Text
            variant="body"
            style={{
              color: fromSelf ? theme.colors.bubbleSelfText : theme.colors.bubbleOtherText,
            }}
          >
            {body}
          </Text>
          <View style={styles.meta}>
            <Text variant="micro" color={fromSelf ? 'textInverse' : 'textMuted'}>
              {formatTime(createdAt)} · {statusIcon(status)}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function statusIcon(s: Props['status']) {
  switch (s) {
    case 'pending':
      return '…';
    case 'sent':
      return '✓';
    case 'delivered':
      return '✓✓';
    case 'read':
      return '✓✓';
    case 'failed':
      return '!';
  }
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 12,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSelf: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  meta: { marginTop: 4, alignSelf: 'flex-end' },
  replyHint: {
    position: 'absolute',
    top: '50%',
  },
  replyHintSelf: { right: 8 },
  replyHintOther: { left: 8 },
});
