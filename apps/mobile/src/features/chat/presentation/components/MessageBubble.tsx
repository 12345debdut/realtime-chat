/**
 * MessageBubble — swipe-to-reply + long-press reaction.
 *
 * Design system rules applied:
 *  - Sent: primary bg, on-primary text, xl corners + sm tail corner
 *  - Received: surface-container-high bg, on-surface text
 *  - 0.5rem between same-sender bubbles, 1.5rem between speakers
 *  - No shadows on bubbles — tonal layering only
 *  - Quoted reply context shown above body when replying to a message
 *  - Tapping the quote scrolls to & highlights the referenced message
 *
 * Performance notes (FlashList recycling):
 *  - Wrapped in React.memo with a custom comparator (deep-checks replyPreview)
 *  - Shared values are reset via useEffect(id) so recycled cells start clean
 *  - Gesture objects are memoized so GestureDetector doesn't re-attach native handlers
 *  - No entering/layout animations — they conflict with FlashList recycling
 *  - Stable component tree — no conditional wrappers (PressableScale removed)
 */
import React, { memo, useEffect, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Text, useTheme } from '../../../../ui';

export interface ReplyPreview {
  authorName: string;
  body: string;
  fromSelf: boolean;
}

interface Props {
  /** Unique message id — used to reset animated state on FlashList recycle */
  id: string;
  body: string;
  fromSelf: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: number;
  imageUri?: string;
  replyPreview?: ReplyPreview | null;
  /** Whether this bubble is temporarily highlighted (scroll-to-reply target) */
  highlighted?: boolean;
  /** Whether this message has been deleted (soft-delete) */
  isDeleted?: boolean;
  onReply?: () => void;
  onReact?: () => void;
  onRetry?: () => void;
  /** Fired when the user taps the quoted reply block */
  onQuotePress?: () => void;
  /** Fired when the user long-presses to delete their own message */
  onDelete?: () => void;
}

const REPLY_THRESHOLD = 56;
const HIGHLIGHT_DURATION = 1200;

function MessageBubbleInner({
  id,
  body,
  fromSelf,
  status,
  createdAt,
  imageUri,
  replyPreview,
  highlighted,
  isDeleted,
  onReply,
  onReact,
  onRetry,
  onQuotePress,
  onDelete,
}: Props) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const highlightOpacity = useSharedValue(0);

  // ── Reset animated values when this cell is recycled to a different message ──
  // FlashList reuses component instances; without this, in-flight withSpring /
  // withTiming animations from the *previous* message bleed into the new one.
  useEffect(() => {
    cancelAnimation(translateX);
    cancelAnimation(scale);
    cancelAnimation(highlightOpacity);
    translateX.value = 0;
    scale.value = 1;
    highlightOpacity.value = 0;
  }, [id, translateX, scale, highlightOpacity]);

  // Drive the highlight glow when `highlighted` toggles on
  useEffect(() => {
    if (highlighted) {
      highlightOpacity.value = 1;
      highlightOpacity.value = withDelay(
        200,
        withTiming(0, { duration: HIGHLIGHT_DURATION }),
      );
    }
  }, [highlighted, highlightOpacity]);

  // ── Memoize gesture objects ──
  // Without this, Gesture.Pan() / LongPress() create new objects every render,
  // causing GestureDetector to tear down and re-attach native gesture recognizers
  // on every recycle — a major source of layout jumps.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isDeleted)
        .activeOffsetX(fromSelf ? [-999, -8] : [8, 999])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          translateX.value = clamp(
            e.translationX,
            fromSelf ? -120 : 0,
            fromSelf ? 0 : 120,
          );
        })
        .onEnd(() => {
          const crossed = Math.abs(translateX.value) >= REPLY_THRESHOLD;
          translateX.value = withSpring(0, { damping: 22, stiffness: 260 });
          if (crossed && onReply) runOnJS(onReply)();
        }),
    [fromSelf, isDeleted, onReply, translateX],
  );

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(280)
        .enabled(!isDeleted)
        .onStart(() => {
          scale.value = withSpring(1.04, { damping: 14, stiffness: 220 });
        })
        .onEnd(() => {
          scale.value = withSpring(1);
          if (onDelete && fromSelf) {
            runOnJS(onDelete)();
          } else if (onReact) {
            runOnJS(onReact)();
          }
        }),
    [onReact, onDelete, fromSelf, isDeleted, scale],
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(pan, longPress),
    [pan, longPress],
  );

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
  }));

  // Highlight overlay opacity — separate from the bubble's own background
  const highlightOverlayStyle = useAnimatedStyle(() => ({
    opacity: highlightOpacity.value,
  }));

  const replyHintStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / REPLY_THRESHOLD, 1);
    return {
      opacity: progress,
      transform: [{ scale: 0.6 + progress * 0.4 }],
    };
  });

  // Asymmetric corners per Stitch design:
  // xl (24) on 3 corners, sm (4) on tail corner
  const borderRadii = fromSelf
    ? {
        borderTopLeftRadius: theme.radii.xl,
        borderTopRightRadius: theme.radii.xs,
        borderBottomLeftRadius: theme.radii.xl,
        borderBottomRightRadius: theme.radii.xl,
      }
    : {
        borderTopLeftRadius: theme.radii.xs,
        borderTopRightRadius: theme.radii.xl,
        borderBottomLeftRadius: theme.radii.xl,
        borderBottomRightRadius: theme.radii.xl,
      };

  // Reply quote colors (ochre bubbles use dark tones, bone bubbles use brand accent)
  const quoteAccentColor = fromSelf ? 'rgba(88,69,0,0.5)' : theme.colors.primary;
  const quoteAuthorColor = fromSelf ? 'rgba(88,69,0,0.85)' : theme.colors.primary;
  const quoteBodyColor = fromSelf ? 'rgba(88,69,0,0.6)' : theme.colors.textMuted;
  const quoteBgColor = fromSelf ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)';

  const quoteBlock = replyPreview ? (
    <Pressable onPress={onQuotePress} disabled={!onQuotePress}>
      <View style={[styles.replyQuote, { backgroundColor: quoteBgColor }]}>
        <View style={[styles.replyQuoteAccent, { backgroundColor: quoteAccentColor }]} />
        <View style={styles.replyQuoteContent}>
          <Text
            variant="micro"
            style={{ color: quoteAuthorColor, fontWeight: '600' }}
            numberOfLines={1}
          >
            {replyPreview.fromSelf ? 'You' : replyPreview.authorName}
          </Text>
          <Text
            variant="micro"
            style={{ color: quoteBodyColor }}
            numberOfLines={2}
          >
            {replyPreview.body}
          </Text>
        </View>
      </View>
    </Pressable>
  ) : null;

  return (
    // ── Stable tree: always Pressable → row → bubble ──
    // Previously, `status === 'failed'` conditionally wrapped in PressableScale,
    // changing the component tree on recycle and forcing React to unmount/remount.
    <Pressable
      onPress={status === 'failed' && onRetry ? onRetry : undefined}
      disabled={status !== 'failed' || !onRetry}
    >
      <View style={[styles.row, fromSelf ? styles.rowSelf : styles.rowOther]}>

        {/* Reply hint icon that appears while swiping */}
        <Animated.View
          style={[
            styles.replyHint,
            fromSelf ? styles.replyHintSelf : styles.replyHintOther,
            replyHintStyle,
          ]}
        >
          <MaterialCommunityIcons
            name="reply"
            size={18}
            color={theme.colors.textMuted}
          />
        </Animated.View>

        <GestureDetector gesture={composed}>
          <Animated.View
            style={[
              styles.bubble,
              {
                backgroundColor: fromSelf
                  ? theme.colors.bubbleSelf
                  : theme.colors.bubbleOther,
                ...borderRadii,
                overflow: 'hidden' as const,
              },
              bubbleStyle,
            ]}
          >
            {/* Highlight overlay — absolutely positioned so it doesn't affect
                the bubble's own backgroundColor. Fades out over 1.2s. */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: fromSelf
                    ? 'rgba(255,255,255,0.3)'
                    : 'rgba(254,203,0,0.2)',
                },
                highlightOverlayStyle,
              ]}
            />

            {!isDeleted && quoteBlock}

            {isDeleted ? (
              <Text
                variant="body"
                style={{
                  color: fromSelf
                    ? 'rgba(88,69,0,0.5)'
                    : theme.colors.textMuted,
                  fontStyle: 'italic',
                }}
              >
                This message was deleted
              </Text>
            ) : (
              <>
                {imageUri && (
                  <Image
                    source={{ uri: imageUri }}
                    style={[styles.image, { borderRadius: theme.radii.sm }]}
                    resizeMode="cover"
                  />
                )}
                {body ? (
                  <Text
                    variant="body"
                    style={{
                      color: fromSelf
                        ? theme.colors.bubbleSelfText
                        : theme.colors.bubbleOtherText,
                    }}
                  >
                    {body}
                  </Text>
                ) : null}
              </>
            )}
            <View style={styles.meta}>
              <Text
                variant="micro"
                style={{
                  color: fromSelf
                    ? 'rgba(88,69,0,0.6)'
                    : theme.colors.textMuted,
                }}
              >
                {formatTime(createdAt)}
              </Text>
              {fromSelf && (
                <View style={styles.statusIcon}>
                  {statusIcon(status)}
                </View>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Pressable>
  );
}

// ── Custom comparator — deep-checks replyPreview instead of reference equality ──
// Without this, every new messages array from WatermelonDB produces new
// replyPreview objects, busting React.memo even when content is unchanged.
export const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  if (prev.id !== next.id) return false;
  if (prev.body !== next.body) return false;
  if (prev.fromSelf !== next.fromSelf) return false;
  if (prev.status !== next.status) return false;
  if (prev.createdAt !== next.createdAt) return false;
  if (prev.imageUri !== next.imageUri) return false;
  if (prev.highlighted !== next.highlighted) return false;
  if (prev.isDeleted !== next.isDeleted) return false;
  // Deep-compare replyPreview
  if (prev.replyPreview?.body !== next.replyPreview?.body) return false;
  if (prev.replyPreview?.authorName !== next.replyPreview?.authorName) return false;
  if (prev.replyPreview?.fromSelf !== next.replyPreview?.fromSelf) return false;
  // Callbacks — reference equality (stabilised via useCallback in parent)
  if (prev.onReply !== next.onReply) return false;
  if (prev.onQuotePress !== next.onQuotePress) return false;
  if (prev.onRetry !== next.onRetry) return false;
  if (prev.onDelete !== next.onDelete) return false;
  return true;
});

function formatTime(ts: number) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function statusIcon(s: Props['status']): React.JSX.Element {
  // Dark tones on ochre bubble background
  switch (s) {
    case 'pending':
      return <MaterialCommunityIcons name="clock-outline" size={14} color="rgba(88,69,0,0.4)" />;
    case 'sent':
      return <MaterialCommunityIcons name="check" size={14} color="rgba(88,69,0,0.6)" />;
    case 'delivered':
      return <MaterialCommunityIcons name="check-all" size={14} color="rgba(88,69,0,0.6)" />;
    case 'read':
      return <MaterialCommunityIcons name="check-all" size={14} color="#1a8cd8" />;
    case 'failed':
      return <MaterialCommunityIcons name="alert-circle" size={14} color="#ba1a1a" />;
  }
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    marginVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSelf: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  image: {
    width: 200,
    height: 150,
    marginBottom: 6,
  },
  meta: { marginTop: 4, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center' },
  statusIcon: {
    marginLeft: 4,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyHint: {
    position: 'absolute',
    top: '50%',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyHintSelf: { right: 8 },
  replyHintOther: { left: 8 },
  replyQuote: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden',
  },
  replyQuoteAccent: {
    width: 3,
    alignSelf: 'stretch',
  },
  replyQuoteContent: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 1,
  },
});
