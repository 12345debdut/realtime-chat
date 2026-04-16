import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../../../auth/presentation/state/authStore';
import type { RootStackParamList } from '../../../../navigation/types';
import { Avatar, Icon, IconButton, PressableScale, SectionHeader, Text, useTheme } from '../../../../ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);

  const displayName = user?.displayName ?? 'User';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.surface }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton name="arrow-left" size={22} color="text" onPress={() => navigation.goBack()} />
        <IconButton name="magnify" size={22} color="text" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Profile Hero */}
        <View style={styles.heroSection}>
          <Avatar name={displayName} size={88} />
          <Text variant="headline" style={{ marginTop: theme.spacing.lg }}>
            {displayName}
          </Text>
          <Text variant="body" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
            {user?.handle ? `@${user.handle}` : ''}
          </Text>
          {user?.bio && (
            <Text variant="body" color="textMuted" style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              {user.bio}
            </Text>
          )}
        </View>

        {/* Stats row removed — real counts will be wired in v2 */}

        {/* Account Information */}
        <SectionHeader title="Account Information" />
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.colors.surfaceContainerLowest,
              borderRadius: theme.radii.md,
              marginHorizontal: theme.spacing.xl,
              padding: theme.spacing.lg,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="titleSm">Account Information</Text>
            <PressableScale scaleTo={0.95}>
              <Icon name="pencil-outline" size={18} color="primary" />
            </PressableScale>
          </View>
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
            <InfoRow label="Handle" value={user?.handle ? `@${user.handle}` : 'Not set'} theme={theme} />
            <InfoRow label="Phone" value={user?.phone ?? 'Not set'} theme={theme} />
            <InfoRow label="Location" value={user?.location ?? 'Not set'} theme={theme} />
          </View>
        </View>

        {/* Media & Links */}
        <SectionHeader title="Media & Links" />
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: theme.spacing.xl,
            gap: theme.spacing.sm,
          }}
        >
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                aspectRatio: 1,
                backgroundColor: theme.colors.surfaceContainerHigh,
                borderRadius: theme.radii.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="image-outline" size={24} color="textMuted" />
            </View>
          ))}
          <View
            style={{
              flex: 1,
              aspectRatio: 1,
              backgroundColor: theme.colors.surfaceContainerHigh,
              borderRadius: theme.radii.sm,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>
              +12
            </Text>
          </View>
        </View>

        {/* Privacy & Security */}
        <SectionHeader title="Privacy & Security" />
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.colors.surfaceContainerLowest,
              borderRadius: theme.radii.md,
              marginHorizontal: theme.spacing.xl,
              padding: theme.spacing.lg,
            },
          ]}
        >
          <Text variant="caption" color="textMuted">
            Manage your encryption, chat settings, and online visibility.
          </Text>
          <View style={{ flexDirection: 'row', marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
            <PressableScale
              scaleTo={0.96}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: theme.colors.surfaceContainerHigh,
                borderRadius: theme.radii.sm,
              }}
            >
              <Icon name="clipboard-text-outline" size={16} color="textSecondary" />
              <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                Audit Log
              </Text>
            </PressableScale>
            <PressableScale
              scaleTo={0.96}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radii.sm,
              }}
            >
              <Icon name="cog-outline" size={16} rawColor={theme.colors.onPrimary} />
              <Text variant="caption" style={{ color: theme.colors.onPrimary, fontWeight: '600' }}>
                Manage Settings
              </Text>
            </PressableScale>
          </View>
        </View>

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View
          style={{
            marginHorizontal: theme.spacing.xl,
            gap: theme.spacing.sm,
          }}
        >
          <PreferenceRow icon="bell-outline" label="Push Notifications" theme={theme} />
          <PreferenceRow icon="bookmark-outline" label="Read Receipts" theme={theme} />
        </View>

        {/* Session Control */}
        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="titleSm" color="danger">
            Session Control
          </Text>
          <PressableScale
            scaleTo={0.96}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 20,
              backgroundColor: theme.colors.surfaceContainerHigh,
              borderRadius: theme.radii.sm,
            }}
          >
            <Icon name="logout" size={18} color="danger" />
            <Text variant="caption" color="danger" style={{ fontWeight: '600' }}>
              Sign Out Everywhere
            </Text>
          </PressableScale>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View>
      <Text variant="micro" color="textMuted" uppercase>
        {label}
      </Text>
      <Text variant="caption" style={{ marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function PreferenceRow({
  icon,
  label,
  theme,
}: {
  icon: string;
  label: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: theme.colors.surfaceContainerLowest,
        borderRadius: theme.radii.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon name={icon} size={20} color="textSecondary" />
        <Text variant="caption">{label}</Text>
      </View>
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center',
          paddingHorizontal: 3,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: theme.colors.onPrimary,
            alignSelf: 'flex-end',
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 8,
  },
  infoCard: {},
});
