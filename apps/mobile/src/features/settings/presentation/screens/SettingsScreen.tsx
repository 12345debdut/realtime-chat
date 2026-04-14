import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../../../auth/presentation/state/authStore';
import type { RootStackParamList } from '../../../../navigation/types';
import { Avatar, Icon, ListItem, PressableScale, SectionHeader, Text, Toast, useTheme } from '../../../../ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  }, []);

  const comingSoon = useCallback(() => {
    showToast('Coming soon!');
  }, [showToast]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.surface }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Avatar name={user?.displayName ?? 'U'} size={32} />
          <Text variant="headline">Lumina</Text>
        </View>
        <PressableScale scaleTo={0.9}>
          <Icon name="magnify" size={22} color="text" />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Title */}
        <View style={{ paddingHorizontal: theme.spacing.xl }}>
          <Text variant="display" style={{ fontSize: 32, lineHeight: 38 }}>
            Settings
          </Text>
          <Text variant="body" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
            Fine-tune your Lumina experience.
          </Text>
        </View>

        {/* Profile Card */}
        <PressableScale
          onPress={() => navigation.navigate('Profile', {})}
          scaleTo={0.98}
          style={{
            backgroundColor: theme.colors.surfaceContainerLowest,
            borderRadius: theme.radii.md,
            marginHorizontal: theme.spacing.xl,
            marginTop: theme.spacing.xl,
            padding: theme.spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={user?.displayName ?? 'User'} size={52} />
            <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
              <Text variant="title">{user?.displayName ?? 'User'}</Text>
              <Text variant="caption" color="textMuted">
                {user?.handle ? `@${user.handle}` : 'No handle set'}
              </Text>
            </View>
            <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>
              Edit
            </Text>
          </View>
        </PressableScale>

        {/* Account Section */}
        <SectionHeader title="Account" />
        <ListItem
          icon="account-outline"
          title="Personal Information"
          onPress={comingSoon}
        />
        <ListItem
          icon="shield-lock-outline"
          title="Privacy & Security"
          onPress={comingSoon}
        />

        {/* Preferences Section */}
        <SectionHeader title="Preferences" />
        <ListItem
          icon="bell-outline"
          title="Notifications"
          trailing={
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text variant="micro" color="primary">
                Enabled
              </Text>
            </View>
          }
          onPress={comingSoon}
        />
        <ListItem
          icon="database-outline"
          title="Data & Storage"
          onPress={comingSoon}
        />
        <ListItem
          icon="palette-outline"
          title="Appearance"
          onPress={comingSoon}
        />

        {/* Support Section */}
        <SectionHeader title="Support" />
        <ListItem
          icon="help-circle-outline"
          title="Help & Support"
          onPress={comingSoon}
        />
        <ListItem
          icon="information-outline"
          title="About Lumina"
          trailing={
            <Text variant="micro" color="textMuted">
              v 1.0.0
            </Text>
          }
          onPress={() => Alert.alert('About', 'Forest Chat v1.0.0\nBuilt with React Native')}
        />

        {/* Log Out */}
        <Pressable
          onPress={() => void logout()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.xxl,
            paddingVertical: theme.spacing.md,
          }}
        >
          <Icon name="logout" size={18} color="danger" />
          <Text variant="bodyBold" color="danger">
            Log Out
          </Text>
        </Pressable>
      </ScrollView>
      <Toast visible={toastVisible} message={toastMessage} variant="info" onHide={() => setToastVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
});
