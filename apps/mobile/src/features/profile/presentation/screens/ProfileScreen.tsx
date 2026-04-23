import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '../../../auth/presentation/state/authStore';
import type { RootStackParamList } from '../../../../navigation/types';
import { Avatar, Icon, IconButton, SectionHeader, Text, useTheme } from '../../../../ui';

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
        <Text variant="titleSm">Profile</Text>
        <View style={{ width: 36 }} />
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
          {user?.bio ? (
            <Text
              variant="body"
              color="textMuted"
              style={{ marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}
            >
              {user.bio}
            </Text>
          ) : null}
        </View>

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
              gap: theme.spacing.md,
            },
          ]}
        >
          <InfoRow label="Handle" value={user?.handle ? `@${user.handle}` : 'Not set'} theme={theme} />
          <InfoRow label="Email" value={user?.email ?? 'Not set'} theme={theme} />
          <InfoRow label="Phone" value={user?.phone ?? 'Not set'} theme={theme} />
          <InfoRow label="Date of Birth" value={user?.dateOfBirth ? formatDate(user.dateOfBirth) : 'Not set'} theme={theme} />
          <InfoRow label="Location" value={user?.location ?? 'Not set'} theme={theme} />
        </View>

        {/* Quick Links */}
        <SectionHeader title="Quick Links" />
        <View
          style={{
            marginHorizontal: theme.spacing.xl,
            gap: theme.spacing.sm,
          }}
        >
          <QuickLinkRow
            icon="account-edit-outline"
            label="Edit Personal Information"
            onPress={() => navigation.navigate('PersonalInfo')}
            theme={theme}
          />
          <QuickLinkRow
            icon="shield-lock-outline"
            label="Privacy & Security"
            onPress={() => navigation.navigate('Privacy')}
            theme={theme}
          />
        </View>

        {/* Member since */}
        <View style={{ alignItems: 'center', marginTop: theme.spacing.xxl }}>
          <Text variant="micro" color="textMuted">
            Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function InfoRow({
  label,
  value,
  theme: _theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  const isEmpty = value === 'Not set';
  return (
    <View>
      <Text variant="micro" color="textMuted" uppercase style={{ letterSpacing: 0.8 }}>
        {label}
      </Text>
      <Text
        variant="caption"
        color={isEmpty ? 'textMuted' : 'text'}
        style={[{ marginTop: 2 }, isEmpty && { fontStyle: 'italic' }]}
      >
        {value}
      </Text>
    </View>
  );
}

function QuickLinkRow({
  icon,
  label,
  onPress,
  theme,
}: {
  icon: string;
  label: string;
  onPress: () => void;
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
      onTouchEnd={onPress}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <Icon name={icon} size={20} color="textSecondary" />
        <Text variant="caption">{label}</Text>
      </View>
      <Icon name="chevron-right" size={20} color="textMuted" />
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
