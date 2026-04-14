/**
 * InputBar — tonal design, pill-shaped input, spring-morphed send button.
 *
 * Design rules:
 *  - No borders — surface-container-highest background
 *  - Full (9999px) corner radius
 *  - body-md for placeholder in outline color
 *  - Reply preview banner above the input when replying
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { PressableScale, Text, useTheme } from '../../../../ui';

export interface ReplyContext {
  /** The message's clientId (WatermelonDB row id) used to look up the original */
  messageId: string;
  /** Server-side message ID sent as replyToId in the payload */
  serverId: string;
  /** Display name of the message author */
  authorName: string;
  /** Preview of the original message body */
  body: string;
  /** Whether the replied-to message is from the current user */
  fromSelf: boolean;
}

interface Props {
  onSend: (body: string, replyToId?: string) => void;
  onTypingChange?: (typing: boolean) => void;
  replyTo?: ReplyContext | null;
  onCancelReply?: () => void;
}

export function InputBar({ onSend, onTypingChange, replyTo, onCancelReply }: Props) {
  const theme = useTheme();
  const [body, setBody] = useState('');
  const canSend = body.trim().length > 0;
  const sendProgress = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  const sendStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + sendProgress.value * 0.6,
    transform: [{ scale: 0.85 + sendProgress.value * 0.15 }],
  }));

  // Auto-focus the input when a reply is initiated
  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus();
    }
  }, [replyTo]);

  function handleChange(next: string) {
    setBody(next);
    sendProgress.value = withSpring(next.trim() ? 1 : 0, { damping: 18, stiffness: 220 });
    onTypingChange?.(next.length > 0);
  }

  function handleSend() {
    if (!canSend) return;
    onSend(body.trim(), replyTo?.serverId);
    setBody('');
    sendProgress.value = withSpring(0);
    onTypingChange?.(false);
    onCancelReply?.();
  }

  return (
    <View>
      {/* Reply preview banner */}
      {replyTo && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.replyBanner,
            { backgroundColor: theme.colors.surfaceContainerHigh },
          ]}
        >
          <View
            style={[
              styles.replyAccent,
              { backgroundColor: theme.colors.primary },
            ]}
          />
          <View style={styles.replyContent}>
            <Text
              variant="caption"
              style={{ color: theme.colors.primary, fontWeight: '600' }}
              numberOfLines={1}
            >
              {replyTo.fromSelf ? 'You' : replyTo.authorName}
            </Text>
            <Text variant="micro" color="textMuted" numberOfLines={1}>
              {replyTo.body}
            </Text>
          </View>
          <PressableScale
            onPress={onCancelReply}
            scaleTo={0.85}
            style={styles.replyClose}
          >
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={theme.colors.textMuted}
            />
          </PressableScale>
        </Animated.View>
      )}

      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.surfaceContainerHighest },
        ]}
      >
        {/* Attachment */}
        <PressableScale
          scaleTo={0.9}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons
            name="plus"
            size={22}
            color={theme.colors.textMuted}
          />
        </PressableScale>

        {/* Input */}
        <TextInput
          ref={inputRef}
          multiline
          value={body}
          onChangeText={handleChange}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.textMuted}
          style={{
            ...styles.input,
            color: theme.colors.text,
            backgroundColor: theme.colors.surfaceContainerHigh,
            borderRadius: theme.radii.pill,
          }}
        />

        {/* Send */}
        <Animated.View style={sendStyle}>
          <PressableScale
            onPress={handleSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={{ ...styles.sendBtn, backgroundColor: theme.colors.primary }}
          >
            <MaterialCommunityIcons
              name="send"
              size={20}
              color={theme.colors.onPrimary}
            />
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 8,
    paddingRight: 8,
    overflow: 'hidden',
  },
  replyAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginLeft: 12,
    marginRight: 10,
  },
  replyContent: {
    flex: 1,
    gap: 2,
  },
  replyClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
