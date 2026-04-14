import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
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
import { Avatar, IconButton, PressableScale, SearchBar, Text, Toast, useTheme } from '../../../../ui';
import { collections } from '../../../../foundation/storage';
import type { RoomModel } from '../../../../foundation/storage/models/RoomModel';
import type { TagModel } from '../../../../foundation/storage/models/TagModel';
import { ChatListItem } from '../components/ChatListItem';
import { EmptyChats } from '../components/EmptyChats';
import { useRooms } from '../hooks/useRooms';
import { useTags } from '../hooks/useTags';
import { roomRepository } from '../../data/RoomRepository';
import { tagRepository, TAG_COLORS } from '../../data/TagRepository';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ListItem =
  | { type: 'sectionHeader'; title: string }
  | { type: 'room'; room: RoomModel; roomTags: { color: string }[] };

export function ChatListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { rooms, refreshing, refresh, hydrated } = useRooms();
  const { tags: allTags } = useTags();

  // Search state
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Tag filter state
  const [tagFilterMode, setTagFilterMode] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagFilteredRoomIds, setTagFilteredRoomIds] = useState<string[] | null>(null);

  // Room tags cache: roomId -> tag colors
  const [roomTagsMap, setRoomTagsMap] = useState<Record<string, { color: string }[]>>({});
  // Counter to force re-fetching room tags when room_tags table changes
  const [roomTagsVersion, setRoomTagsVersion] = useState(0);

  // Subscribe to room_tags collection changes
  useEffect(() => {
    const sub = collections.roomTags
      .query()
      .observeCount()
      .subscribe(() => setRoomTagsVersion((v) => v + 1));
    return () => sub.unsubscribe();
  }, []);

  // Load room tags for all rooms (reacts to rooms, tags, and roomTag changes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, { color: string }[]> = {};
      for (const room of rooms) {
        const tags = await tagRepository.getTagsForRoom(room.id);
        map[room.id] = tags.map((t) => ({ color: t.color }));
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

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => (r.title ?? '').toLowerCase().includes(q));
    }

    // Tag filter
    if (tagFilteredRoomIds) {
      filtered = filtered.filter((r) => tagFilteredRoomIds.includes(r.id));
    }

    // Sort: pinned first, then by lastMessageAt desc
    return [...filtered].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
    });
  }, [rooms, searchQuery, tagFilteredRoomIds]);

  // Build list data with section headers
  const listData = useMemo((): ListItem[] => {
    if (searching || tagFilterMode) {
      // No section headers in search/filter mode
      return processedRooms.map((room) => ({
        type: 'room' as const,
        room,
        roomTags: roomTagsMap[room.id] ?? [],
      }));
    }

    const pinned = processedRooms.filter((r) => r.isPinned);
    const unpinned = processedRooms.filter((r) => !r.isPinned);
    const items: ListItem[] = [];

    if (pinned.length > 0) {
      items.push({ type: 'sectionHeader', title: 'Pinned' });
      items.push(
        ...pinned.map((room) => ({
          type: 'room' as const,
          room,
          roomTags: roomTagsMap[room.id] ?? [],
        })),
      );
    }

    items.push({ type: 'sectionHeader', title: 'All Messages' });
    items.push(
      ...unpinned.map((room) => ({
        type: 'room' as const,
        room,
        roomTags: roomTagsMap[room.id] ?? [],
      })),
    );

    return items;
  }, [processedRooms, searching, tagFilterMode, roomTagsMap]);

  const handleNewChat = useCallback(() => {
    navigation.navigate('NewChat');
  }, [navigation]);

  // Long press handler
  const handleLongPress = useCallback(
    (room: RoomModel) => {
      const pinLabel = room.isPinned ? 'Unpin' : 'Pin';

      Alert.alert(room.title ?? 'Chat', undefined, [
        {
          text: pinLabel,
          onPress: () => roomRepository.togglePin(room.id),
        },
        {
          text: 'Add Tag',
          onPress: () => showTagAssignMenu(room),
        },
        {
          text: 'Delete Chat',
          style: 'destructive',
          onPress: () => confirmDelete(room),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [allTags],
  );

  const confirmDelete = useCallback((room: RoomModel) => {
    Alert.alert(
      'Delete Chat',
      'This will remove the chat and all its messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => roomRepository.deleteRoom(room.id),
        },
      ],
    );
  }, []);

  const showTagAssignMenu = useCallback(
    (room: RoomModel) => {
      setTagMenuRoom(room);
    },
    [],
  );

  // Toast state
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    variant: 'info',
  });

  // Tag management modal state
  const [tagMenuRoom, setTagMenuRoom] = useState<RoomModel | null>(null);
  const [tagMenuRoomTags, setTagMenuRoomTags] = useState<TagModel[]>([]);
  const [manageTagsModal, setManageTagsModal] = useState(false);

  // Load tags assigned to the room when the tag menu opens
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

      // Optimistic update — flip checkbox and room tags cache instantly
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
          [tagMenuRoom.id]: [...(prev[tagMenuRoom.id] ?? []), { color: tag.color }],
        }));
      }

      // Persist in background — rollback on failure
      const roomId = tagMenuRoom.id;
      (async () => {
        try {
          if (isAssigned) {
            await tagRepository.removeTagFromRoom(roomId, tag.id);
          } else {
            await tagRepository.addTagToRoom(roomId, tag.id);
          }
        } catch {
          // Rollback the optimistic update
          if (isAssigned) {
            setTagMenuRoomTags((prev) =>
              prev.some((t) => t.id === tag.id) ? prev : [...prev, tag],
            );
            setRoomTagsMap((prev) => ({
              ...prev,
              [roomId]: [...(prev[roomId] ?? []), { color: tag.color }],
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

  const handleDeleteTag = useCallback(
    (tag: TagModel) => {
      Alert.alert('Delete Tag', `Delete "${tag.name}"? It will be removed from all chats.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await tagRepository.deleteTag(tag.id);
            setTagMenuRoomTags((prev) => prev.filter((t) => t.id !== tag.id));
            // Refresh all room tags since this tag might be on many rooms
            const map: Record<string, { color: string }[]> = {};
            for (const room of rooms) {
              const tags = await tagRepository.getTagsForRoom(room.id);
              map[room.id] = tags.map((t) => ({ color: t.color }));
            }
            setRoomTagsMap(map);
          },
        },
      ]);
    },
    [rooms],
  );

  // New tag creation state — works with or without a room context
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

      // If created from a room context, auto-assign the tag to that room
      if (createTagForRoom) {
        await tagRepository.addTagToRoom(createTagForRoom.id, tag.id);
        const updatedTags = await tagRepository.getTagsForRoom(createTagForRoom.id);
        setRoomTagsMap((prev) => ({
          ...prev,
          [createTagForRoom.id]: updatedTags.map((t) => ({ color: t.color })),
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

  // More menu
  const handleMoreMenu = useCallback(() => {
    Alert.alert("More", undefined, [
      {
        text: 'Search by Tag',
        onPress: () => {
          setTagFilterMode(true);
          setSearching(false);
          setSearchQuery('');
        },
      },
      {
        text: 'Manage Tags',
        onPress: () => {
          // Open the tag management modal without a specific room
          // so the user can delete tags globally
          setTagMenuRoom(null);
          setManageTagsModal(true);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const exitTagFilter = useCallback(() => {
    setTagFilterMode(false);
    setSelectedTagId(null);
    setTagFilteredRoomIds(null);
  }, []);

  // Render tag filter header
  const renderTagFilterHeader = () => (
    <View style={[styles.header, { gap: theme.spacing.sm }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xs, alignItems: 'center', paddingRight: theme.spacing.sm }}
        style={{ flex: 1 }}
      >
        {allTags.length === 0 ? (
          <Text variant="caption" color="textMuted" style={{ paddingHorizontal: theme.spacing.sm }}>
            No tags yet. Long press a chat to add one.
          </Text>
        ) : (
          allTags.map((tag) => {
            const isSelected = selectedTagId === tag.id;
            return (
              <TouchableOpacity
                key={tag.id}
                onPress={() => setSelectedTagId(isSelected ? null : tag.id)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: isSelected ? tag.color : tag.color + '26',
                }}
              >
                <Text
                  variant="caption"
                  style={{
                    color: isSelected ? '#FFFFFF' : tag.color,
                    fontWeight: '600',
                  }}
                >
                  {tag.name}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      <IconButton
        name="close"
        size={22}
        color="primary"
        onPress={exitTagFilter}
      />
    </View>
  );

  // Render search header
  const renderSearchHeader = () => (
    <View style={[styles.header, { gap: theme.spacing.sm }]}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search messages..."
        style={{ flex: 1 }}
      />
      <IconButton
        name="close"
        size={22}
        color="primary"
        onPress={() => {
          setSearching(false);
          setSearchQuery('');
        }}
      />
    </View>
  );

  // Render default header
  const renderDefaultHeader = () => (
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar name="You" size={36} />
        <Text variant="title" color="primary" style={{ fontWeight: '700' }}>Messages</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
        <IconButton name="magnify" size={22} color="primary" onPress={() => setSearching(true)} />
        <IconButton name="dots-vertical" size={22} color="primary" onPress={handleMoreMenu} />
        <View style={{ padding: theme.spacing.xxs, backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.sm, marginLeft: theme.spacing.md }}>
          <IconButton name="plus" size={22} color="primary" onPress={handleNewChat} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.surface }]}>
        {/* Header */}
        {tagFilterMode
          ? renderTagFilterHeader()
          : searching
            ? renderSearchHeader()
            : renderDefaultHeader()}

        {hydrated && rooms.length === 0 ? (
          <EmptyChats onStartChat={handleNewChat} />
        ) : (
          <View style={styles.listContainer}>
            <FlashList
              data={listData}
              contentContainerStyle={{ paddingBottom: 80 }}
              keyExtractor={(item, index) =>
                item.type === 'sectionHeader' ? `header-${item.title}` : item.room.id
              }
              getItemType={(item) => item.type}
              estimatedItemSize={74}
              refreshing={refreshing}
              onRefresh={refresh}
              renderItem={({ item }) => {
                if (item.type === 'sectionHeader') {
                  return (
                    <Text
                      variant="label"
                      color="textMuted"
                      uppercase
                      style={{
                        paddingHorizontal: theme.spacing.xl,
                        marginTop: theme.spacing.md,
                        marginBottom: theme.spacing.sm,
                        fontSize: 14,
                      }}
                    >
                      {item.title}
                    </Text>
                  );
                }

                const { room, roomTags } = item;
                return (
                  <ChatListItem
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
      {/* FAB */}
      {rooms.length > 0 && (
        <PressableScale
          onPress={handleNewChat}
          scaleTo={0.92}
          style={{ ...styles.fab, backgroundColor: theme.colors.primary }}
        >
          <MaterialCommunityIcons name="pencil" size={24} color={theme.colors.onPrimary} />
        </PressableScale>
      )}

      {/* Tag Management Modal — toggle tags on/off for a room, delete tags */}
      <Modal
        visible={tagMenuRoom !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTagMenuRoom(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text variant="title" style={{ marginBottom: theme.spacing.md }}>
              Manage Tags
            </Text>

            {allTags.length === 0 ? (
              <Text variant="body" color="textMuted" style={{ marginBottom: theme.spacing.md }}>
                No tags yet. Create one below.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 240, marginBottom: theme.spacing.md }}>
                {allTags.map((tag) => {
                  const isAssigned = tagMenuRoomTags.some((t) => t.id === tag.id);
                  return (
                    <View
                      key={tag.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: theme.spacing.sm,
                        gap: theme.spacing.sm,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => handleTagToggle(tag)}
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: theme.spacing.sm }}
                      >
                        <View style={{
                          width: 12, height: 12, borderRadius: 6,
                          backgroundColor: tag.color,
                        }} />
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

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => openCreateTag(tagMenuRoom ?? undefined)}>
                <Text variant="label" color="primary" style={{ fontWeight: '600' }}>+ New Tag</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTagMenuRoom(null)}>
                <Text variant="label" color="textMuted">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Tag Modal — with color picker */}
      <Modal
        visible={createTagVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateTagVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text variant="title" style={{ marginBottom: theme.spacing.lg }}>
              New Tag
            </Text>

            {/* Tag name input */}
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="Tag name"
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
              maxLength={30}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                fontSize: 16,
                color: theme.colors.text,
                marginBottom: theme.spacing.lg,
              }}
              onSubmitEditing={handleCreateTagSubmit}
            />

            {/* Color picker label */}
            <Text variant="caption" color="textMuted" style={{ marginBottom: theme.spacing.sm }}>
              Choose a color
            </Text>

            {/* Color swatches */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.lg,
            }}>
              {TAG_COLORS.map((color) => {
                const isSelected = newTagColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setNewTagColor(color)}
                    activeOpacity={0.7}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: color,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isSelected ? 3 : 0,
                      borderColor: theme.colors.text,
                    }}
                  >
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Preview */}
            {newTagName.trim().length > 0 && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.lg,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                backgroundColor: newTagColor + '1A',
                borderRadius: theme.radii.sm,
                alignSelf: 'flex-start',
              }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: newTagColor }} />
                <Text variant="caption" style={{ color: newTagColor, fontWeight: '600' }}>
                  {newTagName.trim()}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md }}>
              <TouchableOpacity onPress={() => setCreateTagVisible(false)} disabled={creatingTag}>
                <Text variant="label" color="textMuted">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateTagSubmit}
                disabled={!newTagName.trim() || creatingTag}
                style={{ opacity: (newTagName.trim() && !creatingTag) ? 1 : 0.4 }}
              >
                <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
                  {creatingTag ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Manage Tags Modal (from More menu) */}
      <Modal
        visible={manageTagsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setManageTagsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text variant="title" style={{ marginBottom: theme.spacing.md }}>
              Manage Tags
            </Text>

            {allTags.length === 0 ? (
              <Text variant="body" color="textMuted" style={{ marginBottom: theme.spacing.md }}>
                No tags yet. Create one below.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 300, marginBottom: theme.spacing.md }}>
                {allTags.map((tag) => (
                  <View
                    key={tag.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: theme.spacing.sm,
                      gap: theme.spacing.sm,
                    }}
                  >
                    <View style={{
                      width: 12, height: 12, borderRadius: 6,
                      backgroundColor: tag.color,
                    }} />
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

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => openCreateTag()}>
                <Text variant="label" color="primary" style={{ fontWeight: '600' }}>+ New Tag</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setManageTagsModal(false)}>
                <Text variant="label" color="textMuted">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  listContainer: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#181c23',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
});
