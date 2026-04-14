import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Text, useTheme } from '../../../../ui';

interface Props {
  senderName: string;
  senderAvatar?: string;
  onAccept: () => void;
  onIgnore: () => void;
}

export function MessageRequest({ senderName, senderAvatar, onAccept, onIgnore }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceContainerLow,
          borderRadius: theme.radii.md,
          marginHorizontal: theme.spacing.lg,
          marginVertical: theme.spacing.sm,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <View style={styles.row}>
        <Avatar uri={senderAvatar} name={senderName} size={40} />
        <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <Text variant="titleSm">
            {senderName} wants to connect
          </Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {senderName} wants to send you a message. You can choose to accept or ignore this request.
          </Text>
        </View>
      </View>
      <View style={[styles.actions, { marginTop: theme.spacing.md, gap: theme.spacing.sm }]}>
        <Button
          label="Ignore"
          variant="secondary"
          onPress={onIgnore}
          fullWidth={false}
          style={{ flex: 1, paddingVertical: 10 }}
        />
        <Button
          label="Accept"
          variant="primary"
          onPress={onAccept}
          fullWidth={false}
          style={{ flex: 1, paddingVertical: 10 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  actions: { flexDirection: 'row' },
});
