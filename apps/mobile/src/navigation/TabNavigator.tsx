import React from 'react';
import { StyleSheet, View } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ChatListScreen } from '../features/chat/presentation/screens/ChatListScreen';
import { ConnectionsScreen } from '../features/connections/presentation/screens/ConnectionsScreen';
import { usePendingCount } from '../features/connections/presentation/state/pendingCountStore';
import { SettingsScreen } from '../features/settings/presentation/screens/SettingsScreen';
import { useTheme } from '../ui/theme/ThemeProvider';

import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function TabNavigator() {
  const theme = useTheme();
  const { count: pendingCount } = usePendingCount();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceContainerHighest,
          borderTopWidth: 0,
          elevation: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
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
