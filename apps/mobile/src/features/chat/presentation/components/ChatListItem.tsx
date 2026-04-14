import React from 'react';
import { View } from 'react-native';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Avatar, PressableScale, Text, useTheme } from '../../../../ui';

interface TagInfo {
  color: string;
}

interface Props {
  name: string;
  avatarUri?: string;
  preview: string;
  time: string;
  unreadCount?: number;
  isPinned?: boolean;
  tags?: TagInfo[];
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
  tags,
  onPress,
  onLongPress,
}: Props) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.98}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.md,
      }}
    >
      <Avatar uri={avatarUri} name={name} size={50} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="titleSm" numberOfLines={1} style={{ flex: 1, marginRight: 8 }}>
            {name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {isPinned && (
              <MaterialCommunityIcons
                name="pin"
                size={14}
                color={theme.colors.textMuted}
              />
            )}
            <Text variant="micro" color="textMuted">
              {time}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8, gap: 6 }}>
            <Text
              variant="caption"
              color="textMuted"
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {preview}
            </Text>
            {tags && tags.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {tags.slice(0, 3).map((tag, i) => (
                  <View
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: tag.color,
                    }}
                  />
                ))}
              </View>
            )}
          </View>
          {unreadCount ? (
            <View
              style={{
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 6,
              }}
            >
              <Text variant="micro" style={{ color: theme.colors.onPrimary, fontSize: 10 }}>
                {unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}
