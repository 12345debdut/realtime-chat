/**
 * ChatListScreen — "Digital Curator" editorial chat list.
 *
 * Layout (top → bottom):
 *  1. Search bar (pill, always visible)
 *  2. Tag filter chips (horizontal scroll — "All" + user tags)
 *  3. "PINNED" section → elevated white cards
 *  4. "RECENT CONVERSATIONS" section → flat rows
 *  5. FAB (bottom-right, dark charcoal rounded-square)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '../../../../navigation/types';
import { formatTime } from '../../../../lib/formatTime';
import {
  BottomSheet,
  BottomSheetAction,
  BottomSheetDivider,
  BottomSheetHeader,
  IconButton,
  PressableScale,
  SearchBar,
  Text,
  Toast,
  useTheme,
} from '../../../../ui';
import { collections } from '../../../../foundation/storage';
import type { RoomModel } from '../../../../foundation/storage/models/RoomModel';
import type { TagModel } from '../../../../foundation/storage/models/TagModel';
import { ChatListItem, type TagInfo } from '../components/ChatListItem';
import { EmptyChats } from '../components/EmptyChats';
import { useRooms } from '../hooks/useRooms';
import { useTags } from '../hooks/useTags';
import { roomRepository } from '../../data/RoomRepository';
import { tagRepository, TAG_COLORS } from '../../data/TagRepository';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ListItem =
  | { type: 'sectionHeader'; title: string; trailing?: 'pin' }
  | { type: 'room'; room: RoomModel; roomTags: TagInfo[]; variant: 'card' | 'flat' };

export function ChatListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { rooms, refreshing, refresh, hydrated } = useRooms();
  const { tags: allTags } = useTags();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Tag filter
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagFilteredRoomIds, setTagFilteredRoomIds] = useState<string[] | null>(null);

  // Room tags cache: roomId -> TagInfo[]
  const [roomTagsMap, setRoomTagsMap] = useState<Record<string, TagInfo[]>>({});
  const [roomTagsVersion, setRoomTagsVersion] = useState(0);

  // Subscribe to room_tags collection changes
  useEffect(() => {
    const sub = collections.roomTags
      .query()
      .observeCount()
      .subscribe(() => setRoomTagsVersion((v) => v + 1));
    return () => sub.unsubscribe();
  }, []);

  // Load room tags (name + color) for all rooms
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, TagInfo[]> = {};
      for (const room of rooms) {
        const tags = await tagRepository.getTagsForRoom(room.id);
        map[room.id] = tags.map((t) => ({ name: t.name, color: t.color }));
      }
      if (!cancelled) setRoomTagsMap(map);
    })();
    return () => { cancelled = true; };
  }, [rooms, allTags, roomTagsVersion]);

  // Load filtered room IDs when tag is selected
  useEffect(() => {
    if (!selectedTagId) {
      setTagFilteredRoomIds(null);
      return;
    }
    let cancelled = false;
    tagRepository.getRoomIdsForTag(selectedTagId).then((ids) => {
      if (!cancelled) setTagFilteredRoomIds(ids);
    });
    return () => { cancelled = true; };
  }, [selectedTagId, rooms]);

  // Filter and sort rooms
  const processedRooms = useMemo(() => {
    let filtered = rooms;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => (r.title ?? '').toLowerCase().includes(q));
    }

    if (tagFilteredRoomIds) {
      filtered = filtered.filter((r) => tagFilteredRoomIds.includes(r.id));
    }

    return [...filtered].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
    });
  }, [rooms, searchQuery, tagFilteredRoomIds]);

  // Build list data with section headers
  const listData = useMemo((): ListItem[] => {
    const pinned = processedRooms.filter((r) => r.isPinned);
    const unpinned = processedRooms.filter((r) => !r.isPinned);
    const items: ListItem[] = [];

    if (pinned.length > 0) {
      items.push({ type: 'sectionHeader', title: 'Pinned', trailing: 'pin' });
      items.push(
        ...pinned.map((room) => ({
          type: 'room' as const,
          room,
          roomTags: roomTagsMap[room.id] ?? [],
          variant: 'card' as const,
        })),
      );
    }

    if (unpinned.length > 0) {
      items.push({ type: 'sectionHeader', title: 'Recent Conversations' });
      items.push(
        ...unpinned.map((room) => ({
          type: 'room' as const,
          room,
          roomTags: roomTagsMap[room.id] ?? [],
          variant: 'flat' as const,
        })),
      );
    }

    return items;
  }, [processedRooms, roomTagsMap]);

  const handleNewChat = useCallback(() => {
    navigation.navigate('NewChat');
  }, [navigation]);

  // ── Long-press context menu ──
  const [contextRoom, setContextRoom] = useState<RoomModel | null>(null);
  const [deleteConfirmRoom, setDeleteConfirmRoom] = useState<RoomModel | null>(null);

  const handleLongPress = useCallback((room: RoomModel) => {
    setContextRoom(room);
  }, []);

  const closeContextSheet = useCallback(() => setContextRoom(null), []);

  const handlePinFromSheet = useCallback(() => {
    if (contextRoom) roomRepository.togglePin(contextRoom.id);
    setContextRoom(null);
  }, [contextRoom]);

  const handleAddTagFromSheet = useCallback(() => {
    if (contextRoom) showTagAssignMenu(contextRoom);
    setContextRoom(null);
  }, [contextRoom]);

  const handleDeleteFromSheet = useCallback(() => {
    setDeleteConfirmRoom(contextRoom);
    setContextRoom(null);
  }, [contextRoom]);

  const confirmDelete = useCallback(() => {
    if (deleteConfirmRoom) roomRepository.deleteRoom(deleteConfirmRoom.id);
    setDeleteConfirmRoom(null);
  }, [deleteConfirmRoom]);

  const closeDeleteSheet = useCallback(() => setDeleteConfirmRoom(null), []);

  const showTagAssignMenu = useCallback((room: RoomModel) => {
    setTagMenuRoom(room);
  }, []);

  // ── Toast ──
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    variant: 'info',
  });

  // ── Tag management ──
  const [tagMenuRoom, setTagMenuRoom] = useState<RoomModel | null>(null);
  const [tagMenuRoomTags, setTagMenuRoomTags] = useState<TagModel[]>([]);
  const [manageTagsModal, setManageTagsModal] = useState(false);

  useEffect(() => {
    if (!tagMenuRoom) {
      setTagMenuRoomTags([]);
      return;
    }
    tagRepository.getTagsForRoom(tagMenuRoom.id).then(setTagMenuRoomTags);
  }, [tagMenuRoom]);

  const handleTagToggle = useCallback(
    (tag: TagModel) => {
      if (!tagMenuRoom) return;
      const isAssigned = tagMenuRoomTags.some((t) => t.id === tag.id);

      if (isAssigned) {
        setTagMenuRoomTags((prev) => prev.filter((t) => t.id !== tag.id));
        setRoomTagsMap((prev) => ({
          ...prev,
          [tagMenuRoom.id]: (prev[tagMenuRoom.id] ?? []).filter((t) => t.color !== tag.color),
        }));
      } else {
        setTagMenuRoomTags((prev) => [...prev, tag]);
        setRoomTagsMap((prev) => ({
          ...prev,
          [tagMenuRoom.id]: [...(prev[tagMenuRoom.id] ?? []), { name: tag.name, color: tag.color }],
        }));
      }

      const roomId = tagMenuRoom.id;
      (async () => {
        try {
          if (isAssigned) {
            await tagRepository.removeTagFromRoom(roomId, tag.id);
          } else {
            await tagRepository.addTagToRoom(roomId, tag.id);
          }
        } catch {
          if (isAssigned) {
            setTagMenuRoomTags((prev) =>
              prev.some((t) => t.id === tag.id) ? prev : [...prev, tag],
            );
            setRoomTagsMap((prev) => ({
              ...prev,
              [roomId]: [...(prev[roomId] ?? []), { name: tag.name, color: tag.color }],
            }));
          } else {
            setTagMenuRoomTags((prev) => prev.filter((t) => t.id !== tag.id));
            setRoomTagsMap((prev) => ({
              ...prev,
              [roomId]: (prev[roomId] ?? []).filter((t) => t.color !== tag.color),
            }));
          }
          setToast({
            visible: true,
            message: isAssigned
              ? `Failed to remove "${tag.name}" from this chat`
              : `Failed to add "${tag.name}" to this chat`,
            variant: 'error',
          });
        }
      })();
    },
    [tagMenuRoom, tagMenuRoomTags],
  );

  const [deleteTagTarget, setDeleteTagTarget] = useState<TagModel | null>(null);

  const handleDeleteTag = useCallback((tag: TagModel) => {
    setDeleteTagTarget(tag);
  }, []);

  const confirmDeleteTag = useCallback(async () => {
    if (!deleteTagTarget) return;
    await tagRepository.deleteTag(deleteTagTarget.id);
    setTagMenuRoomTags((prev) => prev.filter((t) => t.id !== deleteTagTarget.id));
    const map: Record<string, TagInfo[]> = {};
    for (const room of rooms) {
      const tags = await tagRepository.getTagsForRoom(room.id);
      map[room.id] = tags.map((t) => ({ name: t.name, color: t.color }));
    }
    setRoomTagsMap(map);
    setDeleteTagTarget(null);
  }, [deleteTagTarget, rooms]);

  const closeDeleteTagSheet = useCallback(() => setDeleteTagTarget(null), []);

  // ── Create tag ──
  const [createTagVisible, setCreateTagVisible] = useState(false);
  const [createTagForRoom, setCreateTagForRoom] = useState<RoomModel | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [creatingTag, setCreatingTag] = useState(false);

  const openCreateTag = useCallback((room?: RoomModel) => {
    setTagMenuRoom(null);
    setManageTagsModal(false);
    setCreateTagForRoom(room ?? null);
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
    setCreatingTag(false);
    setCreateTagVisible(true);
  }, []);

  const handleCreateTagSubmit = useCallback(async () => {
    if (!newTagName.trim() || creatingTag) return;
    setCreatingTag(true);
    try {
      const tag = await tagRepository.createTag(newTagName.trim(), newTagColor);
      if (createTagForRoom) {
        await tagRepository.addTagToRoom(createTagForRoom.id, tag.id);
        const updatedTags = await tagRepository.getTagsForRoom(createTagForRoom.id);
        setRoomTagsMap((prev) => ({
          ...prev,
          [createTagForRoom.id]: updatedTags.map((t) => ({ name: t.name, color: t.color })),
        }));
      }
      setCreateTagVisible(false);
      setCreateTagForRoom(null);
      setNewTagName('');
    } catch (err: any) {
      if (err?.message === 'tag_exists') {
        setToast({ visible: true, message: `A tag named "${newTagName.trim()}" already exists`, variant: 'error' });
      } else {
        setToast({ visible: true, message: 'Failed to create tag', variant: 'error' });
      }
    } finally {
      setCreatingTag(false);
    }
  }, [newTagName, newTagColor, createTagForRoom, creatingTag]);

  // ── More menu ──
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <SafeAreaView style={styles.root}>
        {/* ── Header row: title + actions ── */}
        <View style={styles.header}>
          <Text variant="headline" style={{ fontWeight: '700' }}>Messages</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {!(hydrated && rooms.length === 0) && (
              <IconButton name="dots-vertical" size={22} color="textSecondary" onPress={() => setMoreMenuVisible(true)} />
            )}
            <PressableScale
              onPress={handleNewChat}
              scaleTo={0.92}
              style={{
                backgroundColor: theme.colors.primaryContainer,
                borderRadius: theme.radii.sm,
                padding: 8,
                marginLeft: 4,
              }}
            >
              <MaterialCommunityIcons name="plus" size={20} color={theme.colors.bubbleSelfText} />
            </PressableScale>
          </View>
        </View>

        {/* ── Search + Tag chips (hidden when no chats) ── */}
        {!(hydrated && rooms.length === 0) && <View style={styles.headerContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations..."
          />

          {/* Tag filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={{ marginTop: 12 }}
          >
            {/* "All" chip */}
            <TouchableOpacity
              onPress={() => setSelectedTagId(null)}
              activeOpacity={0.7}
              style={[
                styles.chip,
                !selectedTagId
                  ? { backgroundColor: theme.colors.primaryContainer }
                  : { backgroundColor: theme.colors.surfaceContainerLowest, borderWidth: 1, borderColor: theme.colors.outlineVariant },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  fontWeight: '600',
                  color: !selectedTagId ? theme.colors.bubbleSelfText : theme.colors.textSecondary,
                }}
              >
                All
              </Text>
            </TouchableOpacity>

            {allTags.map((tag) => {
              const isActive = selectedTagId === tag.id;
              return (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => setSelectedTagId(isActive ? null : tag.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.chip,
                    isActive
                      ? { backgroundColor: tag.color + '1A', borderWidth: 1, borderColor: tag.color + '55' }
                      : { backgroundColor: theme.colors.surfaceContainerLowest, borderWidth: 1, borderColor: theme.colors.outlineVariant },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{
                      fontWeight: '600',
                      color: isActive ? tag.color : theme.colors.textSecondary,
                    }}
                  >
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>}

        {/* ── Content ── */}
        {hydrated && rooms.length === 0 ? (
          <EmptyChats onStartChat={handleNewChat} />
        ) : (
          <View style={styles.listContainer}>
            <FlashList
              data={listData}
              contentContainerStyle={{ paddingBottom: 90 }}
              keyExtractor={(item, index) =>
                item.type === 'sectionHeader' ? `header-${item.title}` : item.room.id
              }
              getItemType={(item) => item.type}
              estimatedItemSize={80}
              refreshing={refreshing}
              onRefresh={refresh}
              renderItem={({ item }) => {
                if (item.type === 'sectionHeader') {
                  return (
                    <View style={styles.sectionRow}>
                      <Text
                        variant="label"
                        color="textMuted"
                        uppercase
                        style={styles.sectionTitle}
                      >
                        {item.title}
                      </Text>
                      {item.trailing === 'pin' && (
                        <MaterialCommunityIcons
                          name="pin"
                          size={14}
                          color={theme.colors.textMuted}
                        />
                      )}
                    </View>
                  );
                }

                const { room, roomTags, variant } = item;
                return (
                  <ChatListItem
                    variant={variant}
                    name={room.title ?? 'Chat'}
                    preview={room.lastMessagePreview ?? 'No messages yet'}
                    time={formatTime(room.lastMessageAt)}
                    isPinned={room.isPinned}
                    unreadCount={room.unreadCount ?? 0}
                    tags={roomTags}
                    onPress={() =>
                      navigation.navigate('ChatRoom', {
                        roomId: room.serverId,
                        title: room.title ?? 'Chat',
                      })
                    }
                    onLongPress={() => handleLongPress(room)}
                  />
                );
              }}
            />
          </View>
        )}
      </SafeAreaView>

      {/* ── FAB ── */}
      {rooms.length > 0 && (
        <PressableScale
          onPress={handleNewChat}
          scaleTo={0.92}
          style={{ ...styles.fab, backgroundColor: theme.colors.inverseSurface }}
        >
          <MaterialCommunityIcons name="pencil" size={22} color={theme.colors.inverseOnSurface} />
        </PressableScale>
      )}

      {/* ── Bottom Sheets ── */}

      {/* Room context menu */}
      <BottomSheet visible={contextRoom !== null} onClose={closeContextSheet}>
        {contextRoom && (
          <BottomSheetHeader>
            <Text variant="bodyBold" numberOfLines={1}>{contextRoom.title ?? 'Chat'}</Text>
          </BottomSheetHeader>
        )}
        <BottomSheetAction
          label={contextRoom?.isPinned ? 'Unpin' : 'Pin'}
          icon={contextRoom?.isPinned ? 'pin-off-outline' : 'pin-outline'}
          onPress={handlePinFromSheet}
        />
        <BottomSheetAction label="Add Tag" icon="tag-outline" onPress={handleAddTagFromSheet} />
        <BottomSheetAction
          label="Delete Chat"
          icon="delete-outline"
          labelColor={theme.colors.danger}
          iconColor={theme.colors.danger}
          onPress={handleDeleteFromSheet}
        />
      </BottomSheet>

      {/* Delete chat confirmation */}
      <BottomSheet visible={deleteConfirmRoom !== null} onClose={closeDeleteSheet}>
        <BottomSheetHeader>
          <Text variant="caption" color="textMuted">
            This will remove the chat and all its messages. This cannot be undone.
          </Text>
        </BottomSheetHeader>
        <BottomSheetAction
          label="Delete"
          icon="delete-outline"
          labelColor={theme.colors.danger}
          iconColor={theme.colors.danger}
          onPress={confirmDelete}
        />
        <BottomSheetAction label="Cancel" icon="close" onPress={closeDeleteSheet} />
      </BottomSheet>

      {/* More menu */}
      <BottomSheet visible={moreMenuVisible} onClose={() => setMoreMenuVisible(false)}>
        <BottomSheetAction label="Manage Tags" icon="tag-multiple-outline" onPress={() => {
          setMoreMenuVisible(false);
          setTagMenuRoom(null);
          setManageTagsModal(true);
        }} />
      </BottomSheet>

      {/* Tag management — toggle tags on/off for a room */}
      <BottomSheet visible={tagMenuRoom !== null} onClose={() => setTagMenuRoom(null)}>
        <BottomSheetHeader>
          <Text variant="bodyBold">Manage Tags</Text>
        </BottomSheetHeader>

        {allTags.length === 0 ? (
          <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
            <Text variant="body" color="textMuted">No tags yet. Create one below.</Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 260 }}>
            {allTags.map((tag) => {
              const isAssigned = tagMenuRoomTags.some((t) => t.id === tag.id);
              return (
                <View
                  key={tag.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    gap: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleTagToggle(tag)}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                  >
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tag.color }} />
                    <Text variant="body" style={{ flex: 1 }}>{tag.name}</Text>
                    <MaterialCommunityIcons
                      name={isAssigned ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={22}
                      color={isAssigned ? theme.colors.primary : theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteTag(tag)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        <BottomSheetDivider />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, height: 52, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => openCreateTag(tagMenuRoom ?? undefined)}>
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>+ New Tag</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTagMenuRoom(null)}>
            <Text variant="body" color="textMuted">Done</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Create tag */}
      <BottomSheet visible={createTagVisible} onClose={() => setCreateTagVisible(false)}>
        <BottomSheetHeader>
          <Text variant="bodyBold">New Tag</Text>
        </BottomSheetHeader>

        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          <TextInput
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder="Tag name"
            placeholderTextColor={theme.colors.textMuted}
            autoFocus
            maxLength={30}
            style={{
              backgroundColor: theme.colors.surfaceContainerLow,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 16,
              color: theme.colors.text,
              marginBottom: 20,
            }}
            onSubmitEditing={handleCreateTagSubmit}
          />

          <Text variant="caption" color="textMuted" style={{ marginBottom: 10 }}>
            Choose a color
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {TAG_COLORS.map((color) => {
              const isSelected = newTagColor === color;
              return (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewTagColor(color)}
                  activeOpacity={0.7}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: color,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: isSelected ? 3 : 0,
                    borderColor: theme.colors.text,
                  }}
                >
                  {isSelected && <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>

          {newTagName.trim().length > 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginBottom: 20,
              paddingHorizontal: 12, paddingVertical: 8,
              backgroundColor: newTagColor + '1A', borderRadius: 8, alignSelf: 'flex-start',
            }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: newTagColor }} />
              <Text variant="caption" style={{ color: newTagColor, fontWeight: '600' }}>{newTagName.trim()}</Text>
            </View>
          )}
        </View>

        <BottomSheetDivider />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 24, height: 52, alignItems: 'center', gap: 24 }}>
          <TouchableOpacity onPress={() => setCreateTagVisible(false)} disabled={creatingTag}>
            <Text variant="body" color="textMuted">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCreateTagSubmit}
            disabled={!newTagName.trim() || creatingTag}
            style={{ opacity: (newTagName.trim() && !creatingTag) ? 1 : 0.4 }}
          >
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
              {creatingTag ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Global manage tags (from More menu) */}
      <BottomSheet visible={manageTagsModal} onClose={() => setManageTagsModal(false)}>
        <BottomSheetHeader>
          <Text variant="bodyBold">Manage Tags</Text>
        </BottomSheetHeader>

        {allTags.length === 0 ? (
          <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
            <Text variant="body" color="textMuted">No tags yet. Create one below.</Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 300 }}>
            {allTags.map((tag) => (
              <View
                key={tag.id}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 14, paddingHorizontal: 24, gap: 12,
                }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tag.color }} />
                <Text variant="body" style={{ flex: 1 }}>{tag.name}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteTag(tag)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <BottomSheetDivider />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, height: 52, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => openCreateTag()}>
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>+ New Tag</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setManageTagsModal(false)}>
            <Text variant="body" color="textMuted">Done</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Delete tag confirmation */}
      <BottomSheet visible={deleteTagTarget !== null} onClose={closeDeleteTagSheet}>
        <BottomSheetHeader>
          <Text variant="caption" color="textMuted">
            Delete "{deleteTagTarget?.name}"? It will be removed from all chats.
          </Text>
        </BottomSheetHeader>
        <BottomSheetAction
          label="Delete"
          icon="delete-outline"
          labelColor={theme.colors.danger}
          iconColor={theme.colors.danger}
          onPress={confirmDeleteTag}
        />
        <BottomSheetAction label="Cancel" icon="close" onPress={closeDeleteTagSheet} />
      </BottomSheet>

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  listContainer: { flex: 1 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
  },
  fab: {
    position: 'absolute',
    bottom: 112,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // Whisper Shadow
    shadowColor: '#2d2f2f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 8,
  },
});
