import React from 'react';
import { StyleSheet } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ChatListScreen } from '../features/chat/presentation/screens/ChatListScreen';
import { ConnectionsScreen } from '../features/connections/presentation/screens/ConnectionsScreen';
import { usePendingCount } from '../features/connections/presentation/state/pendingCountStore';
import { SettingsScreen } from '../features/settings/presentation/screens/SettingsScreen';
import { useTheme } from '../ui/theme/ThemeProvider';

import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const EDGE = 16;
const BAR_HEIGHT = 64;
const BAR_RADIUS = 22;

export function TabNavigator() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { count: pendingCount } = usePendingCount();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: Math.max(insets.bottom, EDGE),
          marginHorizontal: EDGE,
          height: BAR_HEIGHT,
          borderRadius: BAR_RADIUS,
          backgroundColor: theme.mode === 'light'
            ? 'rgba(255,255,255,0.92)'
            : 'rgba(30,30,28,0.92)',
          borderTopWidth: 0,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.mode === 'light'
            ? 'rgba(200,202,202,0.25)'
            : 'rgba(72,72,70,0.3)',
          paddingBottom: 0,
          paddingTop: 0,
          paddingHorizontal: 8,
          // Whisper Shadow
          shadowColor: '#2d2f2f',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.06,
          shadowRadius: 32,
          elevation: 12,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarActiveTintColor: theme.colors.inverseSurface,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: theme.colors.primaryContainer,
          color: theme.colors.bubbleSelfText,
          fontWeight: '700',
          fontSize: 10,
          minWidth: 18,
          height: 18,
          lineHeight: 18,
          borderRadius: 9,
        },
        sceneStyle: { flex: 1 },
      }}
    >
      <Tab.Screen
        name="Messages"
        component={ChatListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group" size={size} color={color} />
          ),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
