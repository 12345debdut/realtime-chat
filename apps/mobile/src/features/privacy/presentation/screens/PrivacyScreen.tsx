import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../../navigation/types';
import {
  Icon,
  IconButton,
  ListItem,
  SectionHeader,
  Text,
  Toast,
  useTheme,
} from '../../../../ui';
import { usePrivacyStore } from '../state/privacyStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function PrivacyScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const {
    readReceiptsEnabled,
    onlineStatusVisible,
    typingIndicatorsEnabled,
    biometricLock,
    screenSecurity,
    updating,
    hydrate,
    updateServer,
    setBiometricLock: storeBiometricLock,
    setScreenSecurity: storeScreenSecurity,
  } = usePrivacyStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  }, []);

  const comingSoon = useCallback(
    (msg = 'Coming soon!') => {
      showToast(msg);
    },
    [showToast],
  );

  const handleToggle = useCallback(
    async (key: string, value: boolean) => {
      try {
        await updateServer({ [key]: value });
      } catch {
        showToast('Failed to update. Please try again.');
      }
    },
    [updateServer, showToast],
  );

  const renderSwitch = (
    value: boolean,
    onToggle: (v: boolean) => void,
    disabled = false,
  ) => (
    <Switch
      value={value}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{
        false: theme.colors.surfaceContainerHigh,
        true: theme.colors.primaryContainer,
      }}
      thumbColor={value ? theme.colors.primary : theme.colors.outlineVariant}
      ios_backgroundColor={theme.colors.surfaceContainerHigh}
    />
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.surface }]}
      edges={['top']}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <IconButton
          name="arrow-left"
          size={22}
          color="text"
          onPress={() => navigation.goBack()}
        />
        <Text variant="titleSm" style={{ flex: 1, marginLeft: 12 }}>
          Privacy & Security
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* ── Hero section ──────────────────────────────────────── */}
        <View style={styles.hero}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Icon name="shield-lock-outline" size={32} color="bubbleSelfText" />
          </View>
          <Text variant="headline" style={{ marginTop: 16 }}>
            Your privacy matters
          </Text>
          <Text
            variant="body"
            color="textMuted"
            align="center"
            style={{ marginTop: 6, paddingHorizontal: 32 }}
          >
            Control who can see your activity and how your data is handled.
          </Text>
        </View>

        {/* ── Visibility ────────────────────────────────────────── */}
        <SectionHeader title="Visibility" />
        <ListItem
          icon="eye-outline"
          title="Online Status"
          subtitle="Show when you're active"
          showChevron={false}
          trailing={renderSwitch(
            onlineStatusVisible,
            (v) => handleToggle('onlineStatusVisible', v),
            updating,
          )}
        />
        <ListItem
          icon="check-all"
          title="Read Receipts"
          subtitle="Let others know you've read their messages"
          showChevron={false}
          trailing={renderSwitch(
            readReceiptsEnabled,
            (v) => handleToggle('readReceiptsEnabled', v),
            updating,
          )}
        />
        <ListItem
          icon="keyboard-outline"
          title="Typing Indicators"
          subtitle="Show when you're typing"
          showChevron={false}
          trailing={renderSwitch(
            typingIndicatorsEnabled,
            (v) => handleToggle('typingIndicatorsEnabled', v),
            updating,
          )}
        />

        {/* ── Security ──────────────────────────────────────────── */}
        <SectionHeader title="Security" />
        <ListItem
          icon="fingerprint"
          title="Biometric Lock"
          subtitle="Require Face ID or fingerprint to open"
          showChevron={false}
          trailing={renderSwitch(biometricLock, storeBiometricLock)}
        />
        <ListItem
          icon="cellphone-lock"
          title="Screen Security"
          subtitle="Hide content in app switcher"
          showChevron={false}
          trailing={renderSwitch(screenSecurity, storeScreenSecurity)}
        />
        <ListItem
          icon="key-outline"
          title="Change Password"
          onPress={() => comingSoon()}
        />
        <ListItem
          icon="two-factor-authentication"
          title="Two-Factor Authentication"
          trailing={
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 9999,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text variant="micro" color="primary">
                Off
              </Text>
            </View>
          }
          onPress={() => comingSoon()}
        />

        {/* ── Blocking ──────────────────────────────────────────── */}
        <SectionHeader title="Blocking" />
        <ListItem
          icon="account-cancel-outline"
          title="Blocked Users"
          subtitle="Manage your block list"
          onPress={() => comingSoon()}
        />

        {/* ── Data ──────────────────────────────────────────────── */}
        <SectionHeader title="Data" />
        <ListItem
          icon="download-outline"
          title="Download My Data"
          subtitle="Get a copy of your Lumina data"
          onPress={() => comingSoon()}
        />
        <ListItem
          icon="trash-can-outline"
          iconColor="danger"
          title="Delete Account"
          subtitle="Permanently remove your account and data"
          onPress={() => comingSoon('This action cannot be undone.')}
        />
      </ScrollView>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        variant="info"
        onHide={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
