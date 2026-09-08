import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth';
import { ChatProvider } from '@/hooks/useChat';
import { SelectionProvider } from '@/lib/selection';
import { useResolvedColors } from '@/lib/theme';

// A cold /item/:id deep link still has the library underneath it.
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <View className="flex-1 items-center justify-center bg-bg"><Spinner size="large" /></View>;
  if (!user) return <Redirect href="/login" />;
  return (
    <ChatProvider key={user.id} accountId={user.id}>
      <SelectionProvider><AppNavigator /></SelectionProvider>
    </ChatProvider>
  );
}

export function AppNavigator() {
  const colors = useResolvedColors();
  const reducedMotion = useReducedMotion();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: reducedMotion ? 'none' : 'default' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="item/[id]" options={{
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        // Reserve the edge for back; horizontal media keeps the rest of the screen.
        fullScreenGestureEnabled: false,
      }} />
      <Stack.Screen name="digest-settings" />
      <Stack.Screen name="inbox-alias" />
    </Stack>
  );
}
