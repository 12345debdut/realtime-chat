import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Avatar, PressableScale, Text, useTheme } from '../../../../ui';
import type { SentConnectionRequestWithUser } from '@rtc/contracts';

interface SentRequestItemProps {
  request: SentConnectionRequestWithUser;
  revoking: boolean;
  onRevoke: () => void;
}

export function SentRequestItem({ request, revoking, onRevoke }: SentRequestItemProps) {
  const theme = useTheme();
  const { receiver } = request;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      <View style={styles.row}>
        <Avatar
          uri={receiver.avatarUrl ?? undefined}
          name={receiver.displayName}
          size={44}
        />

        <View style={styles.info}>
          <Text variant="titleSm" numberOfLines={1}>
            {receiver.displayName}
          </Text>
          <Text
            variant="micro"
            style={[styles.handle, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            @{receiver.handle}
          </Text>
        </View>

        <PressableScale
          onPress={onRevoke}
          scaleTo={0.95}
          hitSlop={8}
          disabled={revoking}
        >
          {revoking ? (
            <ActivityIndicator size="small" color={theme.colors.danger} />
          ) : (
            <Text
              variant="label"
              style={{ color: theme.colors.danger }}
            >
              REVOKE
            </Text>
          )}
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  handle: {
    marginTop: 1,
  },
});
