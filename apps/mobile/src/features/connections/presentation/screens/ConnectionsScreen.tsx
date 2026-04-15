import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../../navigation/types';
import { PressableScale, Text, Toast, useTheme } from '../../../../ui';
import { useConnections } from '../hooks/useConnections';
import { ConnectionRequestCard } from '../components/ConnectionRequestCard';
import { SentRequestItem } from '../components/SentRequestItem';
import { NetworkingTip } from '../components/NetworkingTip';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'received' | 'sent';

const SEGMENT_PADDING = 4;
const SNAPPY_SPRING = { damping: 22, mass: 0.5, stiffness: 260 };

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
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    variant: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    variant: 'info',
  });

  // Pill animation state
  const [containerWidth, setContainerWidth] = useState(0);
  const pillTranslateX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);

  const pillWidth =
    containerWidth > 0 ? (containerWidth - SEGMENT_PADDING * 2) / 2 : 0;

  const animatedPillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillTranslateX.value }],
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handleTabSwitch = useCallback(
    (tab: Tab) => {
      // Fade out → switch tab → fade in
      contentOpacity.value = withTiming(0, { duration: 100 }, (finished) => {
        if (finished) {
          contentOpacity.value = withTiming(1, { duration: 200 });
        }
      });
      // Small delay so the fade-out is visible before content swaps
      setTimeout(() => setActiveTab(tab), 100);
      pillTranslateX.value = withSpring(
        tab === 'received' ? 0 : pillWidth,
        SNAPPY_SPRING,
      );
    },
    [pillTranslateX, pillWidth, contentOpacity],
  );

  const showToast = useCallback(
    (message: string, variant: 'success' | 'error' | 'info' = 'success') => {
      setToast({ visible: true, message, variant });
    },
    [],
  );

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
  const isEmpty = isReceivedTab
    ? requests.length === 0
    : sentRequests.length === 0;

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface }]}
      edges={['top']}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text variant="headline">Network</Text>
        <Text
          variant="body"
          color="textMuted"
          style={{ marginTop: 4 }}
        >
          Manage your incoming and outgoing circles.
        </Text>
      </View>

      {/* ── Segmented Control ───────────────────────────────────────────── */}
      <View
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        style={[
          styles.segmentedControl,
          {
            backgroundColor: theme.colors.surfaceContainerLow,
            borderRadius: 28,
          },
        ]}
      >
        {/* Animated sliding pill */}
        {pillWidth > 0 && (
          <Animated.View
            style={[
              styles.pill,
              {
                width: pillWidth,
                backgroundColor: theme.colors.surfaceContainerLowest,
              },
              animatedPillStyle,
            ]}
          />
        )}

        <PressableScale
          scaleTo={0.98}
          onPress={() => handleTabSwitch('received')}
          style={[styles.segmentButton, { borderRadius: 24 }]}
        >
          <Text
            variant="body"
            style={{
              color: isReceivedTab
                ? theme.colors.text
                : theme.colors.textMuted,
              fontWeight: isReceivedTab ? '600' : '400',
            }}
          >
            Received{requests.length > 0 ? ` (${requests.length})` : ''}
          </Text>
        </PressableScale>

        <PressableScale
          scaleTo={0.98}
          onPress={() => handleTabSwitch('sent')}
          style={[styles.segmentButton, { borderRadius: 24 }]}
        >
          <Text
            variant="body"
            style={{
              color: !isReceivedTab
                ? theme.colors.text
                : theme.colors.textMuted,
              fontWeight: !isReceivedTab ? '600' : '400',
            }}
          >
            Sent{sentRequests.length > 0 ? ` (${sentRequests.length})` : ''}
          </Text>
        </PressableScale>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={isEmpty ? styles.emptyContent : { paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
        >
          <Animated.View style={animatedContentStyle}>
            {isEmpty ? (
              /* ── Empty state ──────────────────────────────────────── */
              <View style={{ alignItems: 'center' }}>
                <Text variant="title" color="textMuted">
                  {isReceivedTab ? 'No pending requests' : 'No sent requests'}
                </Text>
                <Text
                  variant="body"
                  color="textMuted"
                  style={{
                    marginTop: 8,
                    textAlign: 'center',
                    paddingHorizontal: 40,
                  }}
                >
                  {isReceivedTab
                    ? 'When someone sends you a message, their request will appear here.'
                    : 'Requests you send will appear here until they are accepted.'}
                </Text>
              </View>
            ) : isReceivedTab ? (
              /* ── Received tab ─────────────────────────────────────── */
              <>
                {/* Section header */}
                <View style={styles.sectionHeader}>
                  <Text
                    variant="label"
                    color="textMuted"
                    style={styles.sectionLabel}
                  >
                    NEW INVITATIONS
                  </Text>
                  {requests.length > 0 && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: theme.colors.primaryContainer,
                        },
                      ]}
                    >
                      <Text
                        variant="micro"
                        style={{
                          color: theme.colors.bubbleSelfText,
                          fontWeight: '600',
                        }}
                      >
                        {requests.length} Pending
                      </Text>
                    </View>
                  )}
                </View>

                {/* Request cards */}
                {requests.map((request) => (
                  <View
                    key={request.id}
                    style={{ marginHorizontal: 24, marginBottom: 14 }}
                  >
                    <ConnectionRequestCard
                      request={request}
                      acting={acting === request.id}
                      onAccept={() =>
                        handleAccept(request.id, request.sender.displayName)
                      }
                      onIgnore={() => ignore(request.id)}
                    />
                  </View>
                ))}
              </>
            ) : (
              /* ── Sent tab ─────────────────────────────────────────── */
              <>
                {/* Section header */}
                <View style={styles.sentSectionHeader}>
                  <Text
                    variant="label"
                    color="textMuted"
                    style={styles.sectionLabel}
                  >
                    SENT REQUESTS
                  </Text>
                </View>

                {/* Sent request items */}
                {sentRequests.map((request, index) => (
                  <React.Fragment key={request.id}>
                    <View style={{ marginHorizontal: 24 }}>
                      <SentRequestItem
                        request={request}
                        revoking={revoking === request.id}
                        onRevoke={() =>
                          handleRevoke(request.id, request.receiver.displayName)
                        }
                      />
                    </View>
                    {index < sentRequests.length - 1 && (
                      <View
                        style={[
                          styles.separator,
                          {
                            backgroundColor:
                              theme.colors.outlineVariant + '30',
                          },
                        ]}
                      />
                    )}
                  </React.Fragment>
                ))}
              </>
            )}

            {/* Networking tip */}
            <View style={{ marginHorizontal: 24 }}>
              <NetworkingTip />
            </View>
          </Animated.View>
        </ScrollView>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
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
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: 24,
    padding: 4,
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 120,
  },
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sentSectionHeader: {
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 24,
  },
});
