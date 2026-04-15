import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { User } from '@rtc/contracts';

import type { RootStackParamList } from '../../../../navigation/types';
import {
  Avatar,
  IconButton,
  PressableScale,
  SearchBar,
  Text,
  Toast,
  useTheme,
} from '../../../../ui';
import { BottomSheet } from '../../../../ui/BottomSheet';
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
    visible: false,
  });

  // ── Note dialog state ──────────────────────────────────────────────
  const [noteSheetVisible, setNoteSheetVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [note, setNote] = useState('');
  const noteInputRef = useRef<TextInput>(null);

  const handleUserPress = useCallback((user: User) => {
    setSelectedUser(user);
    setNote('');
    setNoteSheetVisible(true);
  }, []);

  const doSendRequest = useCallback(
    async (user: User, message?: string) => {
      setNoteSheetVisible(false);
      setSelectedUser(null);
      setLoadingToast({ visible: true });

      const result = await sendRequest(user.id, message || undefined);
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
        setToast({ visible: true, message: `Request already sent to ${user.displayName}`, variant: 'info' });
      }
    },
    [navigation, sendRequest, progress, removeUser],
  );

  const handleSendWithNote = useCallback(() => {
    if (!selectedUser) return;
    doSendRequest(selectedUser, note.trim());
  }, [selectedUser, note, doSendRequest]);

  const handleSendWithoutNote = useCallback(() => {
    if (!selectedUser) return;
    doSendRequest(selectedUser);
  }, [selectedUser, doSendRequest]);

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

      {/* ── Note Bottom Sheet ─────────────────────────────────────────── */}
      <BottomSheet
        visible={noteSheetVisible}
        onClose={() => {
          setNoteSheetVisible(false);
          setSelectedUser(null);
        }}
      >
        {selectedUser && (
          <View style={styles.noteSheetContent}>
            {/* User preview */}
            <View style={styles.noteUserRow}>
              <Avatar
                uri={selectedUser.avatarUrl ?? undefined}
                name={selectedUser.displayName}
                size={44}
              />
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Text variant="titleSm">{selectedUser.displayName}</Text>
                <Text variant="micro" color="textMuted">@{selectedUser.handle}</Text>
              </View>
            </View>

            {/* Label */}
            <Text
              variant="caption"
              color="textSecondary"
              style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}
            >
              Add a note (optional)
            </Text>

            {/* Note input */}
            <TextInput
              ref={noteInputRef}
              value={note}
              onChangeText={setNote}
              placeholder="Say something nice..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={200}
              style={[
                styles.noteInput,
                {
                  backgroundColor: theme.colors.surfaceContainerHigh,
                  color: theme.colors.text,
                  borderRadius: theme.radii.md,
                  fontFamily: theme.typography.body.fontFamily,
                  fontSize: theme.typography.body.fontSize,
                },
              ]}
            />

            {/* Character count */}
            {note.length > 0 && (
              <Text
                variant="micro"
                color="textMuted"
                style={{ alignSelf: 'flex-end', marginTop: 4 }}
              >
                {note.length}/200
              </Text>
            )}

            {/* Action buttons */}
            <View style={[styles.noteActions, { marginTop: theme.spacing.lg, gap: theme.spacing.sm }]}>
              {note.trim().length > 0 ? (
                <>
                  <PressableScale
                    scaleTo={0.96}
                    onPress={handleSendWithNote}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: theme.radii.sm,
                      backgroundColor: theme.colors.inverseSurface,
                      alignItems: 'center',
                    }}
                  >
                    <Text variant="caption" style={{ color: theme.colors.inverseOnSurface, fontWeight: '600' }}>
                      Send with Note
                    </Text>
                  </PressableScale>
                  <PressableScale
                    scaleTo={0.96}
                    onPress={handleSendWithoutNote}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: theme.radii.sm,
                      backgroundColor: theme.colors.surfaceContainerHigh,
                      alignItems: 'center',
                    }}
                  >
                    <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                      Skip Note
                    </Text>
                  </PressableScale>
                </>
              ) : (
                <PressableScale
                  scaleTo={0.96}
                  onPress={handleSendWithoutNote}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: theme.radii.sm,
                    backgroundColor: theme.colors.inverseSurface,
                    alignItems: 'center',
                  }}
                >
                  <Text variant="caption" style={{ color: theme.colors.inverseOnSurface, fontWeight: '600' }}>
                    Send Request
                  </Text>
                </PressableScale>
              )}
            </View>
          </View>
        )}
      </BottomSheet>

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
  noteSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  noteUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteInput: {
    minHeight: 80,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  noteActions: {
    flexDirection: 'row',
  },
});
