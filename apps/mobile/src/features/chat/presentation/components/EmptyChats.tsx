import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '../../../../navigation/types';
import { Button, Icon, PressableScale, Text, useTheme } from '../../../../ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  onStartChat: () => void;
}

export function EmptyChats({ onStartChat }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Illustration placeholder */}
      <View
        style={[
          styles.illustration,
          { backgroundColor: theme.colors.surfaceContainerLow },
        ]}
      >
        <MaterialCommunityIcons
          name="chat-outline"
          size={64}
          color={theme.colors.primary}
          style={{ opacity: 0.5 }}
        />
      </View>

      <Text variant="headline" align="center" style={{ marginTop: theme.spacing.xl }}>
        No chats yet
      </Text>
      <Text
        variant="body"
        color="textMuted"
        align="center"
        style={{ marginTop: theme.spacing.sm, paddingHorizontal: theme.spacing.xxl }}
      >
        Connect with friends and start a dialogue that flows effortlessly.
      </Text>

      <Button
        label="Start a chat"
        icon="chat"
        iconPosition="left"
        onPress={onStartChat}
        style={{ marginTop: theme.spacing.xl, marginHorizontal: theme.spacing.xl }}
      />

      <PressableScale
        onPress={onStartChat}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.lg,
        }}
      >
        <Icon name="magnify" size={18} color="primary" />
        <Text variant="bodyBold" color="primary">
          Find people you know
        </Text>
      </PressableScale>

      {/* Quick Actions Grid */}
      <View style={[styles.grid, { marginTop: theme.spacing.xxl }]}>
        {([
          { icon: 'import', label: 'Import\nContacts', onPress: undefined },
          { icon: 'account-group', label: 'Create\nGroup', onPress: undefined },
          { icon: 'qrcode', label: 'My QR\nCode', onPress: undefined },
          { icon: 'shield-lock-outline', label: 'Privacy', onPress: () => navigation.navigate('Privacy') },
        ] as const).map((item) => (
          <PressableScale
            key={item.label}
            scaleTo={0.95}
            onPress={item.onPress}
            style={{
              width: '44%',
              backgroundColor: theme.colors.surfaceContainerLow,
              borderRadius: theme.radii.md,
              paddingVertical: theme.spacing.lg,
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Icon name={item.icon} size={24} color="primary" />
            <Text variant="caption" color="textSecondary" align="center">
              {item.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 120 },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
});
