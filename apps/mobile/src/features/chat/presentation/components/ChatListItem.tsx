/**
 * ChatListItem — two rendering modes:
 *
 *  • "card"  → Pinned items. Warm ochre-tinted card with accent strip,
 *              larger avatar, pin badge, elevated with deeper shadow.
 *  • "flat"  → Recent items. Clean white card, compact, subtle border.
 *
 * Design reference: high-end editorial chat list (Digital Curator).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Avatar, PressableScale, Text, useTheme } from '../../../../ui';

export interface TagInfo {
  name: string;
  color: string;
}

interface Props {
  name: string;
  avatarUri?: string;
  preview: string;
  time: string;
  unreadCount?: number;
  isPinned?: boolean;
  isOnline?: boolean;
  tags?: TagInfo[];
  variant?: 'card' | 'flat';
  onPress: () => void;
  onLongPress?: () => void;
}

export function ChatListItem({
  name,
  avatarUri,
  preview,
  time,
  unreadCount,
  isPinned,
  isOnline,
  tags,
  variant = 'flat',
  onPress,
  onLongPress,
}: Props) {
  const theme = useTheme();
  const isCard = variant === 'card';

  const tagBadges = tags && tags.length > 0 ? (
    <View style={styles.tagRow}>
      {tags.slice(0, 2).map((tag, i) => (
        <View
          key={i}
          style={[
            styles.tagBadge,
            { backgroundColor: tag.color + '1A', borderColor: tag.color + '33' },
          ]}
        >
          <Text
            variant="micro"
            style={{ color: tag.color, fontWeight: '700', fontSize: 9, letterSpacing: 0.6 }}
          >
            {tag.name.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  ) : null;

  // ── Pinned card ──
  if (isCard) {
    return (
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        scaleTo={0.96}
        style={{
          ...styles.pinnedCard,
          backgroundColor: theme.colors.primaryContainer + '12',
          borderColor: theme.colors.primaryContainer + '55',
          shadowColor: theme.colors.primary,
        }}
      >
        {/* Ochre accent strip on the left */}
        <View style={[styles.accentStrip, { backgroundColor: theme.colors.primaryContainer }]} />

        <View style={styles.pinnedInner}>
          <Avatar
            uri={avatarUri}
            name={name}
            size={46}
            showStatus={isOnline}
            statusColor={theme.colors.success}
          />
          <View style={styles.pinnedContent}>
            <View style={styles.topRow}>
              <Text
                variant="titleSm"
                numberOfLines={1}
                style={{ flex: 1, fontWeight: '700', marginRight: 8 }}
              >
                {name}
              </Text>
              <Text variant="micro" color="textMuted">{time}</Text>
            </View>
            <View style={styles.bottomRow}>
              <Text
                variant="caption"
                color="textSecondary"
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {preview}
              </Text>
              <View style={styles.trailing}>
                {tagBadges}
                {!!unreadCount && unreadCount > 0 && (
                  <View style={[styles.unreadDot, { backgroundColor: theme.colors.inverseSurface }]} />
                )}
              </View>
            </View>
          </View>
        </View>
      </PressableScale>
    );
  }

  // ── Recent (flat card) ──
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.97}
      style={{
        ...styles.flatCard,
        backgroundColor: theme.colors.surfaceContainerLowest,
        borderColor: theme.colors.primary + '18',
        shadowColor: '#2d2f2f',
      }}
    >
      <Avatar uri={avatarUri} name={name} size={46} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            variant="titleSm"
            numberOfLines={1}
            style={{ flex: 1, fontWeight: '600', marginRight: 8 }}
          >
            {name}
          </Text>
          <Text variant="micro" color="textMuted">
            {time}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text
            variant="caption"
            color="textMuted"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {preview}
          </Text>

          <View style={styles.trailing}>
            {tagBadges}
            {!!unreadCount && unreadCount > 0 && (
              <View style={[styles.unreadDot, { backgroundColor: theme.colors.inverseSurface }]} />
            )}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // ── Pinned card ──
  pinnedCard: {
    marginHorizontal: 20,
    marginVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    // Deeper shadow for pinned
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  accentStrip: {
    width: 4,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  pinnedInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pinnedContent: {
    flex: 1,
    gap: 3,
  },

  // ── Recent flat card ──
  flatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginVertical: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
  },

  // ── Shared ──
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
