import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { useAuthStore } from '../features/auth/state/authStore';
import { ChatListScreen } from '../features/chat/screens/ChatListScreen';
import { ChatRoomScreen } from '../features/chat/screens/ChatRoomScreen';
import { useTheme } from '../ui/theme/ThemeProvider';

import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);

  return (
    <NavigationContainer
      theme={{
        dark: theme.mode === 'dark',
        colors: {
          background: theme.colors.bg,
          border: theme.colors.border,
          card: theme.colors.bgElevated,
          notification: theme.colors.danger,
          primary: theme.colors.primary,
          text: theme.colors.text,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
