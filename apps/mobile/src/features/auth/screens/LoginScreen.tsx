import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../ui/Button';
import { Text } from '../../../ui/Text';
import { useTheme } from '../../../ui/theme/ThemeProvider';
import { useAuthStore } from '../state/authStore';

export function LoginScreen() {
  const theme = useTheme();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={{ gap: theme.spacing.lg, padding: theme.spacing.xl }}>
        <Text variant="display">Welcome back</Text>
        <Text variant="body" color="textMuted">
          Sign in to start chatting.
        </Text>

        <TextInput
          placeholder="Handle"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          value={handle}
          onChangeText={setHandle}
          style={inputStyle(theme)}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={inputStyle(theme)}
        />
        {error ? (
          <Text variant="caption" color="danger">
            {error}
          </Text>
        ) : null}
        <Button
          label="Log in"
          loading={status === 'loading'}
          onPress={() => void login(handle, password)}
        />
        <Button
          label="Create account"
          variant="ghost"
          onPress={() => void register(handle, handle, password)}
        />
      </View>
    </SafeAreaView>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: theme.colors.bgElevated,
    color: theme.colors.text,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  } as const;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
