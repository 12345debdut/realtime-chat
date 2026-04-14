import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '../features/auth/presentation/screens/LoginScreen';
import { useAuthStore } from '../features/auth/presentation/state/authStore';
import { ChatRoomScreen } from '../features/chat/presentation/screens/ChatRoomScreen';
import { NewChatScreen } from '../features/chat/presentation/screens/NewChatScreen';
import { ProfileScreen } from '../features/profile/presentation/screens/ProfileScreen';
import { useTheme } from '../ui/theme/ThemeProvider';

import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);

  // Show splash while bootstrap is checking stored tokens
  if (status === 'loading' && !user) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: theme.mode === 'dark',
        colors: {
          background: theme.colors.bg,
          border: theme.colors.outlineVariant,
          card: theme.colors.surface,
          notification: theme.colors.danger,
          primary: theme.colors.primary,
          text: theme.colors.text,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' as const },
          medium: { fontFamily: 'System', fontWeight: '500' as const },
          bold: { fontFamily: 'System', fontWeight: '700' as const },
          heavy: { fontFamily: 'System', fontWeight: '900' as const },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen
              name="ChatRoom"
              component={ChatRoomScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="NewChat"
              component={NewChatScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
