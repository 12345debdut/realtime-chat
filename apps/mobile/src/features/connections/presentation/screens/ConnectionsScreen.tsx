import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { SentConnectionRequestWithUser } from '@rtc/contracts';

import type { RootStackParamList } from '../../../../navigation/types';
import { Avatar, PressableScale, Text, Toast, useTheme } from '../../../../ui';
import { useConnections } from '../hooks/useConnections';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'received' | 'sent';

export function ConnectionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const {
    requests,
    sentRequests,
    loading,
    sentLoading,
    refreshing,
    acting,
    revoking,
    accept,
    ignore,
    revoke,
    refresh,
  } = useConnections();

  const [activeTab, setActiveTab] = useState<Tab>('received');
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    variant: 'info',
  });

  const showToast = useCallback((message: string, variant: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, variant });
  }, []);

  const handleAccept = useCallback(
    async (requestId: string, senderName: string) => {
      const result = await accept(requestId);
      if (result) {
        navigation.navigate('ChatRoom', {
          roomId: result.room.id,
          title: senderName,
        });
      }
    },
    [navigation, accept],
  );

  const handleRevoke = useCallback(
    async (requestId: string, receiverName: string) => {
      const success = await revoke(requestId);
      if (success) {
        showToast(`Request to ${receiverName} revoked.`);
      } else {
        showToast('Failed to revoke request.', 'error');
      }
    },
    [revoke, showToast],
  );

  const isReceivedTab = activeTab === 'received';
  const isLoading = isReceivedTab ? loading : sentLoading;
  const isEmpty = isReceivedTab ? requests.length === 0 : sentRequests.length === 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.surface }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ marginTop: theme.spacing.md }}>
          <Text variant="headline">Connections</Text>
          <Text variant="body" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
            Manage your connection requests.
          </Text>
        </View>
      </View>

      {/* Segmented Control */}
      <View
        style={[
          styles.segmentedControl,
          {
            marginHorizontal: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            backgroundColor: theme.colors.surfaceContainerHigh,
            borderRadius: theme.radii.sm,
          },
        ]}
      >
        <PressableScale
          scaleTo={0.98}
          onPress={() => setActiveTab('received')}
          style={{
            ...styles.segmentButton,
            backgroundColor: isReceivedTab ? theme.colors.primary : 'transparent',
            borderRadius: theme.radii.sm,
          }}
        >
          <Text
            variant="caption"
            style={{
              color: isReceivedTab ? theme.colors.onPrimary : theme.colors.textSecondary,
              fontWeight: '600',
            }}
          >
            Received{requests.length > 0 ? ` (${requests.length})` : ''}
          </Text>
        </PressableScale>
        <PressableScale
          scaleTo={0.98}
          onPress={() => setActiveTab('sent')}
          style={{
            ...styles.segmentButton,
            backgroundColor: !isReceivedTab ? theme.colors.primary : 'transparent',
            borderRadius: theme.radii.sm,
          }}
        >
          <Text
            variant="caption"
            style={{
              color: !isReceivedTab ? theme.colors.onPrimary : theme.colors.textSecondary,
              fontWeight: '600',
            }}
          >
            Sent{sentRequests.length > 0 ? ` (${sentRequests.length})` : ''}
          </Text>
        </PressableScale>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : isEmpty ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <Text variant="title" color="textMuted">
            {isReceivedTab ? 'No pending requests' : 'No sent requests'}
          </Text>
          <Text
            variant="body"
            color="textMuted"
            style={{ marginTop: theme.spacing.sm, textAlign: 'center', paddingHorizontal: 40 }}
          >
            {isReceivedTab
              ? 'When someone sends you a message, their request will appear here.'
              : 'Requests you send will appear here until they are accepted.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          {isReceivedTab
            ? requests.map((request) => (
                <Animated.View
                  key={request.id}
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(200)}
                  style={[
                    styles.requestCard,
                    {
                      backgroundColor: theme.colors.surfaceContainerLowest,
                      borderRadius: theme.radii.md,
                      marginHorizontal: theme.spacing.xl,
                      marginBottom: theme.spacing.md,
                      padding: theme.spacing.lg,
                      opacity: acting === request.id ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.requestRow}>
                    <Avatar
                      uri={request.sender.avatarUrl ?? undefined}
                      name={request.sender.displayName}
                      size={48}
                    />
                    <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                      <Text variant="titleSm">{request.sender.displayName}</Text>
                      <Text variant="caption" color="textMuted">
                        @{request.sender.handle}
                      </Text>
                    </View>
                  </View>

                  {request.message && (
                    <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
                      &quot;{request.message}&quot;
                    </Text>
                  )}

                  <View style={[styles.requestActions, { marginTop: theme.spacing.md, gap: theme.spacing.sm }]}>
                    <PressableScale
                      scaleTo={0.96}
                      onPress={() => handleAccept(request.id, request.sender.displayName)}
                      disabled={acting !== null}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: theme.radii.sm,
                        backgroundColor: theme.colors.primary,
                        alignItems: 'center',
                      }}
                    >
                      <Text variant="caption" style={{ color: theme.colors.onPrimary, fontWeight: '600' }}>
                        Accept
                      </Text>
                    </PressableScale>
                    <PressableScale
                      scaleTo={0.96}
                      onPress={() => ignore(request.id)}
                      disabled={acting !== null}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: theme.radii.sm,
                        backgroundColor: theme.colors.surfaceContainerHigh,
                        alignItems: 'center',
                      }}
                    >
                      <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                        Ignore
                      </Text>
                    </PressableScale>
                  </View>
                </Animated.View>
              ))
            : sentRequests.map((request: SentConnectionRequestWithUser) => (
                <Animated.View
                  key={request.id}
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(200)}
                  style={[
                    styles.requestCard,
                    {
                      backgroundColor: theme.colors.surfaceContainerLowest,
                      borderRadius: theme.radii.md,
                      marginHorizontal: theme.spacing.xl,
                      marginBottom: theme.spacing.md,
                      padding: theme.spacing.lg,
                      opacity: revoking === request.id ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={styles.requestRow}>
                    <Avatar
                      uri={request.receiver.avatarUrl ?? undefined}
                      name={request.receiver.displayName}
                      size={48}
                    />
                    <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                      <Text variant="titleSm">{request.receiver.displayName}</Text>
                      <Text variant="caption" color="textMuted">
                        @{request.receiver.handle}
                      </Text>
                    </View>
                  </View>

                  {request.message && (
                    <Text variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
                      &quot;{request.message}&quot;
                    </Text>
                  )}

                  <View style={[styles.requestActions, { marginTop: theme.spacing.md }]}>
                    <PressableScale
                      scaleTo={0.96}
                      onPress={() => handleRevoke(request.id, request.receiver.displayName)}
                      disabled={revoking !== null}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: theme.radii.sm,
                        backgroundColor: theme.colors.danger,
                        alignItems: 'center',
                      }}
                    >
                      {revoking === request.id ? (
                        <ActivityIndicator size="small" color={theme.colors.textInverse} />
                      ) : (
                        <Text variant="caption" style={{ color: theme.colors.textInverse, fontWeight: '600' }}>
                          Revoke
                        </Text>
                      )}
                    </PressableScale>
                  </View>
                </Animated.View>
              ))}
        </ScrollView>
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  requestCard: {},
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestActions: {
    flexDirection: 'row',
  },
});
