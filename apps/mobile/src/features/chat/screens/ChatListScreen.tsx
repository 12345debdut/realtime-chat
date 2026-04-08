import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlashList } from '@shopify/flash-list';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { collections } from '../../../db';
import type { RoomModel } from '../../../db/models/RoomModel';
import { Avatar } from '../../../ui/Avatar';
import { PressableScale } from '../../../ui/PressableScale';
import { Text } from '../../../ui/Text';
import { useTheme } from '../../../ui/theme/ThemeProvider';

import type { RootStackParamList } from '../../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ChatList'>;
}

export function ChatListScreen({ navigation }: Props) {
  const theme = useTheme();
  const [rooms, setRooms] = useState<RoomModel[]>([]);

  useEffect(() => {
    const sub = collections.rooms.query().observe().subscribe(setRooms);
    return () => sub.unsubscribe();
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.header}>
        <Text variant="display">Chats</Text>
      </View>
      <FlashList
        data={rooms}
        keyExtractor={(r) => r.id}
        estimatedItemSize={80}
        renderItem={({ item }) => (
          <PressableScale
            scaleTo={0.98}
            onPress={() =>
              navigation.navigate('ChatRoom', {
                roomId: item.id,
                title: item.title ?? 'Chat',
              })
            }
            style={styles.row}
          >
            <Avatar name={item.title ?? '?'} />
            <View style={styles.rowBody}>
              <Text variant="bodyBold">{item.title ?? 'Untitled'}</Text>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {item.lastMessagePreview ?? 'No messages yet'}
              </Text>
            </View>
          </PressableScale>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowBody: { marginLeft: 12, flex: 1 },
});
