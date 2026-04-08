/**
 * InputBar — grows with text, spring-morphs the send button from disabled → active,
 * and uses react-native-keyboard-controller for native-thread keyboard choreography.
 */
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PressableScale } from '../../../ui/PressableScale';
import { Text } from '../../../ui/Text';
import { useTheme } from '../../../ui/theme/ThemeProvider';

interface Props {
  onSend: (body: string) => void;
  onTypingChange?: (typing: boolean) => void;
}

export function InputBar({ onSend, onTypingChange }: Props) {
  const theme = useTheme();
  const [body, setBody] = useState('');
  const canSend = body.trim().length > 0;
  const sendProgress = useSharedValue(0);

  const sendStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + sendProgress.value * 0.6,
    transform: [{ scale: 0.85 + sendProgress.value * 0.15 }],
  }));

  function handleChange(next: string) {
    setBody(next);
    sendProgress.value = withSpring(next.trim() ? 1 : 0, { damping: 18, stiffness: 220 });
    onTypingChange?.(next.length > 0);
  }

  function handleSend() {
    if (!canSend) return;
    onSend(body.trim());
    setBody('');
    sendProgress.value = withSpring(0);
    onTypingChange?.(false);
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.bgElevated, borderTopColor: theme.colors.border },
      ]}
    >
      <TextInput
        multiline
        value={body}
        onChangeText={handleChange}
        placeholder="Message"
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.bg }]}
      />
      <Animated.View style={sendStyle}>
        <PressableScale
          onPress={handleSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primary,
            marginLeft: 8,
          }}
        >
          <Text variant="bodyBold" color="textInverse">
            ↑
          </Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
