import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlashList } from '@shopify/flash-list';
import type { RouteProp } from '@react-navigation/native';

import { kv, KvKeys } from '../../../lib/kv';
import { syncEngine } from '../../../sync/SyncEngine';
import { Text } from '../../../ui/Text';
import { useTheme } from '../../../ui/theme/ThemeProvider';
import { InputBar } from '../components/InputBar';
import { MessageBubble } from '../components/MessageBubble';
import { TypingDots } from '../components/TypingDots';
import { useMessages } from '../hooks/useMessages';

import type { RootStackParamList } from '../../../navigation/types';

type Props = { route: RouteProp<RootStackParamList, 'ChatRoom'> };

export function ChatRoomScreen({ route }: Props) {
  const theme = useTheme();
  const { roomId, title } = route.params;
  const messages = useMessages(roomId);
  const currentUserId = useMemo(() => kv.getString(KvKeys.CurrentUserId) ?? '', []);

  const handleSend = useCallback(
    (body: string) => {
      void syncEngine.enqueueSend({ roomId, body, kind: 'text' });
    },
    [roomId],
  );

  return (
    <KeyboardProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text variant="title">{title}</Text>
        </View>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <FlashList
            inverted
            data={messages}
            keyExtractor={(m) => m.id}
            estimatedItemSize={72}
            renderItem={({ item }) => (
              <MessageBubble
                body={item.body}
                fromSelf={item.authorId === currentUserId}
                status={item.status}
                createdAt={item.createdAt.getTime()}
              />
            )}
            ListHeaderComponent={<TypingDots visible={false} />}
          />
          <InputBar onSend={handleSend} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
