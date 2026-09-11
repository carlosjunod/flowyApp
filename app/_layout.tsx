import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useShareIntent } from 'expo-share-intent';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useNotificationIntent } from '@/hooks/useNotificationIntent';
import { AuthProvider, useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { payloadFromShareIntent, readSharedFileBase64 } from '@/lib/shareIntent';
import { ThemeProvider, useResolvedVars, useTheme } from '@/lib/theme';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Notifications native module not available (e.g. missing entitlement, web).
}

function AppShell() {
  const { resolved } = useTheme();
  const themeVars = useResolvedVars();
  const queryClient = useQueryClient();
  const { user, ready } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    // iOS already owns its native extension. Keeping the Android intent until
    // this app confirms the save also lets a cold-start wait for auth hydration.
    disabled: Platform.OS !== 'android',
    resetOnBackground: false,
  });
  const savingShare = useRef(false);
  usePushRegistration();

  useNotificationIntent();

  useEffect(() => {
    if (!ready || !user || !hasShareIntent || savingShare.current) return;
    savingShare.current = true;

    void (async () => {
      try {
        const payload = await payloadFromShareIntent(shareIntent, readSharedFileBase64);
        if (!payload) {
          Alert.alert('Can’t save this item', 'Share a link, photo, video, PDF, or file to Flowy.');
          return;
        }
        const result = await api.ingest(payload);
        if (result.error) {
          Alert.alert('Couldn’t save item', result.error.code === 'UNAUTHORIZED'
            ? 'Your session has ended. Sign in to save shared items.'
            : 'Check your connection and try sharing again.');
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ['items'] });
        router.replace('/inbox');
      } catch {
        Alert.alert('Couldn’t read this item', 'Check that the shared file is still available, then try again.');
      } finally {
        resetShareIntent();
        savingShare.current = false;
      }
    })();
  }, [hasShareIntent, ready, resetShareIntent, shareIntent, user]);

  return (
    <View style={[{ flex: 1 }, themeVars]}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    InstrumentSerif_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <AppShell />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
