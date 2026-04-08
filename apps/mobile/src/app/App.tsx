/**
 * Root providers, in the order they must wrap:
 *   GestureHandlerRootView → SafeAreaProvider → QueryClientProvider
 *     → ThemeProvider → RootNavigator
 *
 * `react-native-gesture-handler` must be the outermost view for gestures
 * to work on Android; safe area must wrap navigation for correct insets;
 * theme must wrap navigation so the navigator can read mode-aware colors.
 */
import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuthStore } from '../features/auth/state/authStore';
import { RootNavigator } from '../navigation/RootNavigator';
import { ThemeProvider } from '../ui/theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const scheme = useColorScheme();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
            <RootNavigator />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
