import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { User } from '@rtc/contracts';

import type { RootStackParamList } from '../../../../navigation/types';
import { Avatar, IconButton, PressableScale, SearchBar, Text, Toast, useTheme } from '../../../../ui';
import { useUsers } from '../../../users/presentation/hooks/useUsers';
import {
  useSendConnectionRequest,
  SendRequestProgress,
} from '../../../users/presentation/hooks/useSendConnectionRequest';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function NewChatScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');
  const { users, loading, removeUser } = useUsers(search);
  const { sendRequest, sending, progress } = useSendConnectionRequest();
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    variant: 'info',
  });

  const [loadingToast, setLoadingToast] = useState<{ visible: boolean }>({
    visible: false
  });

  const handleUserPress = useCallback(
    async (user: User) => {
      setLoadingToast({ visible: true });
      const result = await sendRequest(user.id);
      setLoadingToast({ visible: false });
      if (result?.alreadyConnected) {
        removeUser(user.id);
        navigation.goBack();
        setTimeout(() => {
          navigation.navigate('ChatRoom', {
            roomId: result.room.id,
            title: user.displayName,
          });
        }, 100);
      } else if (result) {
        // New connection request sent successfully
        removeUser(user.id);
        setToast({ visible: true, message: `Request sent to ${user.displayName}`, variant: 'success' });
      } else if (progress === SendRequestProgress.NetworkError) {
        setToast({
          visible: true,
          message: "You're offline. Try again when connected.",
          variant: 'error',
        });
      } else if (progress === SendRequestProgress.Error) {
        setToast({
          visible: true,
          message: 'Failed to send request',
          variant: 'error',
        });
      } else {
        // Duplicate request — still counts as success feedback
        setToast({ visible: true, message: `Request already sent to ${user.displayName}`, variant: 'info' });
      }
    },
    [navigation, sendRequest, progress, removeUser],
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="headline">New Chat</Text>
          <IconButton name="close" size={22} color="text" onPress={() => navigation.goBack()} />
        </View>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search people"
          style={{ marginTop: theme.spacing.lg }}
        />
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Text variant="body" color="textMuted">No users found</Text>
        </View>
      ) : (
        <FlashList
          data={users}
          keyExtractor={(u) => u.id}
          estimatedItemSize={68}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => handleUserPress(item)}
              disabled={sending !== null}
              scaleTo={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
                gap: theme.spacing.md,
                opacity: sending === item.id ? 0.5 : 1,
              }}
            >
              <Avatar
                uri={item.avatarUrl ?? undefined}
                name={item.displayName}
                size={48}
              />
              <View style={{ flex: 1 }}>
                <Text variant="titleSm">{item.displayName}</Text>
                <Text variant="micro" color="textMuted">@{item.handle}</Text>
              </View>
              {sending === item.id && (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              )}
            </PressableScale>
          )}
        />
      )}

      <Toast
        visible={loadingToast.visible}
        message={'Sending request...'}
        variant={'loading'}
        onHide={() => {}}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
