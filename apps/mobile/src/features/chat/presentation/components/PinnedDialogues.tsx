import React from 'react';
import { ScrollView, View } from 'react-native';

import { Avatar, PressableScale, Text, useTheme } from '../../../../ui';

interface PinnedUser {
  id: string;
  name: string;
  avatarUri?: string;
  status?: string;
}

interface Props {
  users: PinnedUser[];
  onPress: (user: PinnedUser) => void;
}

export function PinnedDialogues({ users, onPress }: Props) {
  const theme = useTheme();

  if (users.length === 0) return null;

  return (
    <View>
      <Text
        variant="label"
        color="textMuted"
        uppercase
        style={{ paddingHorizontal: theme.spacing.xl, marginBottom: theme.spacing.md }}
      >
        Pinned Dialogues
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.xl,
          gap: theme.spacing.xl,
        }}
      >
        {users.map((user) => (
          <PressableScale
            key={user.id}
            onPress={() => onPress(user)}
            scaleTo={0.95}
            style={{ alignItems: 'center', width: 64 }}
          >
            <Avatar
              uri={user.avatarUri}
              name={user.name}
              size={56}
            />
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ marginTop: theme.spacing.xs, textAlign: 'center' }}
            >
              {user.name.split(' ')[0]}
            </Text>
            {user.status && (
              <Text variant="micro" color="textMuted" numberOfLines={1}>
                {user.status}
              </Text>
            )}
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}
