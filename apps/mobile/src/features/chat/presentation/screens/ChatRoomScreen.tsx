import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../../navigation/types';
import type { MessageModel } from '../../../../foundation/storage/models/MessageModel';
import { Avatar, BottomSheet, BottomSheetAction, BottomSheetHeader, IconButton, Text, useTheme } from '../../../../ui';
import { messageRepository } from '../../data/MessageRepository';
import { onSyncEvent } from '../../data/SyncEngine';
import { DateDivider, shouldShowDivider } from '../components/DateDivider';
import { InputBar, type ReplyContext } from '../components/InputBar';
import { MessageBubble, type ReplyPreview } from '../components/MessageBubble';
import { TypingDots } from '../components/TypingDots';
import { useChatRoom } from '../hooks/useChatRoom';
import { usePresence } from '../hooks/usePresence';
import { useTypingIndicator } from '../hooks/useTypingIndicator';

/**
 * Subscribes to the SyncEngine's connection event bus so it always reflects
 * the *current* socket's state — even after socket replacements (reconnect,
 * token refresh, etc.).
 */
function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsub = onSyncEvent('connection', (payload: unknown) => {
      const { connected } = payload as { connected: boolean };
      setOnline(connected);
    });
    return unsub;
  }, []);

  return online;
}

// ─── Extracted row component ───
// Reads volatile values (highlightedId, getReplyPreview) from refs passed in,
// so the parent's `renderItem` callback stays stable and FlashList doesn't
// re-render every visible cell on each message arrival or highlight toggle.

interface MessageRowProps {
  item: MessageModel;
  currentUserId: string;
  showDateDivider: boolean;
  highlightedIdRef: React.RefObject<string | null>;
  getReplyPreviewRef: React.RefObject<(id: string | null) => ReplyPreview | null>;
  onReply: (messageId: string, serverId: string | null, authorId: string, body: string) => void;
  onQuotePress: (replyToId: string | null) => void;
  onRetry: (clientId: string) => void;
  onDelete: (serverId: string, roomId: string) => void;
}

const MessageRow = memo(function MessageRow({
  item,
  currentUserId,
  showDateDivider,
  highlightedIdRef,
  getReplyPreviewRef,
  onReply,
  onQuotePress,
  onRetry,
  onDelete,
}: MessageRowProps) {
  const fromSelf = item.authorId === currentUserId;

  const highlightedId = highlightedIdRef.current;
  const isHighlighted =
    highlightedId != null &&
    (item.id === highlightedId || item.serverId === highlightedId);

  // Memoize reply preview so a new object ref isn't passed to MessageBubble
  const replyPreview = useMemo(
    () => getReplyPreviewRef.current?.(item.replyToId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.replyToId, item.id],
  );

  const handleReply = useCallback(
    () => onReply(item.id, item.serverId, item.authorId, item.body),
    [onReply, item.id, item.serverId, item.authorId, item.body],
  );

  const handleQuotePress = useCallback(
    () => onQuotePress(item.replyToId),
    [onQuotePress, item.replyToId],
  );

  const handleRetry = useCallback(
    () => onRetry(item.clientId),
    [onRetry, item.clientId],
  );

  const isDeleted = item.deletedAt != null;

  const handleDelete = useCallback(
    () => {
      if (item.serverId) onDelete(item.serverId, item.roomId);
    },
    [onDelete, item.serverId, item.roomId],
  );

  return (
    <>
      <MessageBubble
        id={item.id}
        body={item.body}
        fromSelf={fromSelf}
        status={item.status}
        createdAt={item.createdAt.getTime()}
        replyPreview={replyPreview}
        highlighted={isHighlighted}
        isDeleted={isDeleted}
        onReply={isDeleted ? undefined : handleReply}
        onQuotePress={!isDeleted && item.replyToId ? handleQuotePress : undefined}
        onRetry={!isDeleted && fromSelf && item.status === 'failed' ? handleRetry : undefined}
        onDelete={fromSelf && !isDeleted && item.serverId ? handleDelete : undefined}
      />
      {showDateDivider && <DateDivider timestamp={item.createdAt.getTime()} />}
    </>
  );
}, (prev, next) => {
  // WatermelonDB reuses Model object references — default shallow memo sees
  // `prevItem === nextItem` and skips re-render even when fields changed.
  // Compare actual field values so status changes, deletes, etc. update instantly.
  const p = prev.item;
  const n = next.item;
  if (p.id !== n.id) return false;
  if (p.body !== n.body) return false;
  if (p.status !== n.status) return false;
  if (p.serverId !== n.serverId) return false;
  if (p.deletedAt?.getTime() !== n.deletedAt?.getTime()) return false;
  if (prev.showDateDivider !== next.showDateDivider) return false;
  if (prev.currentUserId !== next.currentUserId) return false;
  if (prev.onReply !== next.onReply) return false;
  if (prev.onQuotePress !== next.onQuotePress) return false;
  if (prev.onRetry !== next.onRetry) return false;
  if (prev.onDelete !== next.onDelete) return false;
  return true;
});

type Props = { route: RouteProp<RootStackParamList, 'ChatRoom'> };

export function ChatRoomScreen({ route }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { roomId, title } = route.params;
  const { messages, currentUserId, send, retry } = useChatRoom(roomId);
  const isOnline = useIsOnline();
  const { online: peerOnline } = usePresence(roomId);
  const { visible: typingVisible, onTypingChange } = useTypingIndicator(roomId);
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageModel>>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Refs for volatile values ──
  // These are read by MessageRow without being in renderItem's deps,
  // so renderItem stays stable across message / highlight state changes.
  const highlightedIdRef = useRef<string | null>(null);
  highlightedIdRef.current = highlightedId;

  // Build a lookup map: messageId / serverId → { authorName, body, fromSelf }
  const messageMap = useMemo(() => {
    const map = new Map<string, { authorName: string; body: string; fromSelf: boolean }>();
    for (const m of messages) {
      const entry = {
        authorName: m.authorId === currentUserId ? 'You' : title,
        body: m.body,
        fromSelf: m.authorId === currentUserId,
      };
      map.set(m.id, entry);
      if (m.serverId) map.set(m.serverId, entry);
    }
    return map;
  }, [messages, currentUserId, title]);

  // Stable ref wrapper for getReplyPreview — the function changes when
  // messageMap changes, but the ref identity never does.
  const getReplyPreviewFn = useCallback(
    (replyToId: string | null): ReplyPreview | null => {
      if (!replyToId) return null;
      return messageMap.get(replyToId) ?? null;
    },
    [messageMap],
  );
  const getReplyPreviewRef = useRef(getReplyPreviewFn);
  getReplyPreviewRef.current = getReplyPreviewFn;

  // Build an index lookup: messageId / serverId → array index in `messages`
  const indexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      map.set(m.id, i);
      if (m.serverId) map.set(m.serverId, i);
    }
    return map;
  }, [messages]);

  /** Scroll to a message by id (local or server) and briefly highlight it. */
  const scrollToMessage = useCallback(
    (targetId: string) => {
      const idx = indexMap.get(targetId);
      if (idx == null) return;

      try {
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      } catch {
        // scrollToIndex can throw if the index is out of the visible window;
        // FlashList may not have measured that far. Fall back silently.
      }

      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      setHighlightedId(targetId);
      highlightTimer.current = setTimeout(() => {
        setHighlightedId(null);
      }, 1600);
    },
    [indexMap],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  // ── Stable handlers ──
  const handleReply = useCallback(
    (messageId: string, serverId: string | null, authorId: string, body: string) => {
      setReplyTo({
        messageId,
        serverId: serverId ?? messageId,
        authorName: authorId === currentUserId ? 'You' : title,
        body: body.slice(0, 200),
        fromSelf: authorId === currentUserId,
      });
    },
    [currentUserId, title],
  );

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // Delete message bottom sheet state
  const [deleteTarget, setDeleteTarget] = useState<{ serverId: string; roomId: string } | null>(null);

  const handleDelete = useCallback(
    (serverId: string, msgRoomId: string) => {
      setDeleteTarget({ serverId, roomId: msgRoomId });
    },
    [],
  );

  const confirmDeleteMessage = useCallback(() => {
    if (deleteTarget) {
      void messageRepository.deleteMessage(deleteTarget.serverId, deleteTarget.roomId);
    }
    setDeleteTarget(null);
  }, [deleteTarget]);

  const closeDeleteSheet = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleSend = useCallback(
    (body: string, replyToId?: string) => {
      send(body, replyToId);
    },
    [send],
  );

  const handleQuotePress = useCallback(
    (replyToId: string | null) => {
      if (!replyToId) return;
      scrollToMessage(replyToId);
    },
    [scrollToMessage],
  );

  // ── Date divider set ──
  // Pre-compute which messages should show a date divider above them.
  // In the inverted list, messages are desc (newest first). A divider
  // should appear when a message's date differs from the next item in the
  // array (which is the previous message chronologically and appears above).
  const dateDividerSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < messages.length; i++) {
      const curr = messages[i].createdAt.getTime();
      const next = i + 1 < messages.length ? messages[i + 1].createdAt.getTime() : undefined;
      if (shouldShowDivider(curr, next)) {
        set.add(messages[i].id);
      }
    }
    return set;
  }, [messages]);

  // ── Stable FlashList props ──
  const keyExtractor = useCallback((m: MessageModel) => m.id, []);

  // renderItem has MINIMAL deps — volatile values are read via refs inside
  // MessageRow, so this callback is almost never recreated.
  const renderItem = useCallback(
    ({ item }: { item: MessageModel }) => (
      <MessageRow
        item={item}
        currentUserId={currentUserId}
        showDateDivider={dateDividerSet.has(item.id)}
        highlightedIdRef={highlightedIdRef}
        getReplyPreviewRef={getReplyPreviewRef}
        onReply={handleReply}
        onQuotePress={handleQuotePress}
        onRetry={retry}
        onDelete={handleDelete}
      />
    ),
    [currentUserId, dateDividerSet, handleReply, handleQuotePress, retry, handleDelete],
  );

  const typingHeader = useMemo(() => <TypingDots visible={typingVisible} />, [typingVisible]);

  return (
    <KeyboardProvider>
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.surfaceContainerLow }]}
        edges={['top']}
      >
        {/* Header */}
        <View
          style={[styles.header, { backgroundColor: theme.colors.surface }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <IconButton
              name="arrow-left"
              size={22}
              color="text"
              onPress={() => navigation.goBack()}
            />
            <Avatar
              name={title}
              size={36}
              showStatus={peerOnline}
              statusColor={theme.colors.primary}
              style={{ marginLeft: 4 }}
            />
            <View style={{ marginLeft: theme.spacing.md, flex: 1 }}>
              <Text variant="titleSm" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="micro" color={peerOnline ? 'textSecondary' : 'textMuted'}>
                {peerOnline ? 'Active now' : 'Offline'}
              </Text>
            </View>
          </View>
          {/* TODO: search + menu icons */}
        </View>

        {!isOnline && (
          <View style={[styles.offlineBanner, { backgroundColor: theme.colors.primarySoft }]}>
            <MaterialCommunityIcons name="wifi-off" size={16} color={theme.colors.primary} />
            <Text variant="caption" style={{ color: theme.colors.primary, marginLeft: 8, flex: 1 }}>
              You're offline. Messages will be sent when you reconnect.
            </Text>
          </View>
        )}

        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <FlatList
            ref={listRef}
            inverted
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListHeaderComponent={typingHeader}
            removeClippedSubviews
            maxToRenderPerBatch={15}
            windowSize={11}
          />
          <InputBar
            onSend={handleSend}
            onTypingChange={onTypingChange}
            replyTo={replyTo}
            onCancelReply={handleCancelReply}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Delete message bottom sheet */}
      <BottomSheet visible={deleteTarget !== null} onClose={closeDeleteSheet}>
        <BottomSheetHeader>
          <Text variant="caption" color="textMuted">
            Are you sure? The other person will see "This message was deleted".
          </Text>
        </BottomSheetHeader>
        <BottomSheetAction
          label="Delete"
          icon="delete-outline"
          labelColor={theme.colors.danger}
          iconColor={theme.colors.danger}
          onPress={confirmDeleteMessage}
        />
        <BottomSheetAction
          label="Cancel"
          icon="close"
          onPress={closeDeleteSheet}
        />
      </BottomSheet>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
