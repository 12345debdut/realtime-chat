import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Button } from '../../../../ui/Button';
import { Icon } from '../../../../ui/Icon';
import { Text } from '../../../../ui/Text';
import { useTheme } from '../../../../ui/theme/ThemeProvider';
import { useAuthStore } from '../state/authStore';

export function LoginScreen() {
  const theme = useTheme();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);

  const handleSubmit = () => {
    if (isSignUp) {
      void register(handle, displayName.trim() || handle, password);
    } else {
      void login(handle, password);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <View
            style={[
              styles.logoIcon,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <MaterialCommunityIcons name="chat" size={28} color={theme.colors.onPrimary} />
          </View>
          <Text variant="headline" color="primary" style={{ marginTop: theme.spacing.sm }}>
            Forest Chat
          </Text>
        </View>

        {/* Header */}
        <View style={styles.headerSection}>
          <Text variant="headline" align="center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text variant="body" color="textMuted" align="center" style={{ marginTop: theme.spacing.xs }}>
            {isSignUp
              ? 'Join Forest Chat and start your conversations.'
              : 'Enter your credentials to continue your conversations.'}
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.xl }}>
          {/* Username Field */}
          <View style={{ opacity: status === 'loading' ? 0.5 : 1 }}>
            <Text variant="label" color="textMuted" uppercase style={{ marginBottom: theme.spacing.sm }}>
              Username
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.colors.surfaceContainerLow,
                  borderRadius: theme.radii.sm,
                },
              ]}
            >
              <Icon name="account-outline" size={20} color="textMuted" />
              <TextInput
                placeholder="john_doe"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={handle}
                onChangeText={setHandle}
                editable={status !== 'loading'}
                style={[styles.input, { color: theme.colors.text }]}
              />
            </View>
          </View>

          {/* Display Name Field (sign-up only) */}
          {isSignUp && (
            <View style={{ opacity: status === 'loading' ? 0.5 : 1 }}>
              <Text variant="label" color="textMuted" uppercase style={{ marginBottom: theme.spacing.sm }}>
                Display Name
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme.colors.surfaceContainerLow,
                    borderRadius: theme.radii.sm,
                  },
                ]}
              >
                <Icon name="account-outline" size={20} color="textMuted" />
                <TextInput
                  placeholder="John Doe"
                  placeholderTextColor={theme.colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  value={displayName}
                  onChangeText={setDisplayName}
                  editable={status !== 'loading'}
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>
            </View>
          )}

          {/* Password Field */}
          <View style={{ opacity: status === 'loading' ? 0.5 : 1 }}>
            <View style={styles.passwordHeader}>
              <Text variant="label" color="textMuted" uppercase>
                Password
              </Text>
              {!isSignUp && (
                <Pressable hitSlop={8}>
                  <Text variant="caption" color="primary">
                    Forgot?
                  </Text>
                </Pressable>
              )}
            </View>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.colors.surfaceContainerLow,
                  borderRadius: theme.radii.sm,
                  marginTop: theme.spacing.sm,
                },
              ]}
            >
              <Icon name="lock-outline" size={20} color="textMuted" />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={status !== 'loading'}
                style={[styles.input, { color: theme.colors.text }]}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Icon
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="textMuted"
                />
              </Pressable>
            </View>
          </View>

          {/* Remember Me */}
          {!isSignUp && (
            <Pressable
              onPress={() => setRememberMe(!rememberMe)}
              style={styles.rememberRow}
              hitSlop={4}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: rememberMe ? theme.colors.primary : theme.colors.outlineVariant,
                    backgroundColor: rememberMe ? theme.colors.primary : theme.colors.transparent,
                    borderRadius: theme.radii.xs,
                  },
                ]}
              >
                {rememberMe && (
                  <MaterialCommunityIcons name="check" size={14} color={theme.colors.onPrimary} />
                )}
              </View>
              <Text variant="caption" color="textSecondary">
                Remember me on this device
              </Text>
            </Pressable>
          )}

          {/* Error */}
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}

          {/* Submit Button */}
          <Button
            label={isSignUp ? 'Create Account' : 'Sign In'}
            icon="arrow-right"
            loading={status === 'loading'}
            onPress={handleSubmit}
          />
        </View>

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <Text variant="caption" color="textMuted">
            {isSignUp ? 'Already have an account? ' : 'New to Forest Chat? '}
          </Text>
          <Pressable onPress={() => setIsSignUp(!isSignUp)} hitSlop={8}>
            <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>
              {isSignUp ? 'Sign In' : 'Create Account'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSection: { alignItems: 'center' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
});
