import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth';
import { ChatProvider } from '@/hooks/useChat';
import { SelectionProvider } from '@/lib/selection';
import { useResolvedColors } from '@/lib/theme';
import { api } from '@/lib/api';

// A cold /item/:id deep link still has the library underneath it.
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <View className="flex-1 items-center justify-center bg-bg"><Spinner size="large" /></View>;
  if (!user) return <Redirect href="/login" />;
  return (
    <ChatProvider key={user.id} accountId={user.id}>
      <SelectionProvider><AppNavigator /><AiProcessingConsentGate /></SelectionProvider>
    </ChatProvider>
  );
}

/** Existing accounts must explicitly accept before API routes allow AI processing. */
function AiProcessingConsentGate() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const colors = useResolvedColors();
  const { signOut } = useAuth();
  useEffect(() => { void api.getAiProcessingConsent().then((result) => setVisible(result.data?.accepted !== true)); }, []);
  async function accept(): Promise<void> {
    setSaving(true);
    const result = await api.acceptAiProcessingConsent();
    if (result.data?.accepted) setVisible(false);
    setSaving(false);
  }
  return <Modal transparent visible={visible} animationType="fade" presentationStyle="overFullScreen">
    <View className="flex-1 items-center justify-center bg-black/50 px-6">
      <View className="w-full rounded-2xl bg-card p-6">
        <Text className="text-fg text-2xl" style={{ fontFamily: 'InstrumentSerif_400Regular' }}>Use AI features</Text>
        <Text className="mt-3 text-muted text-sm leading-5">To process saved content and answer chats, Flowy sends the necessary text, images, documents, audio, and chat requests to Anthropic, OpenAI, and Voyage AI. They process it only to provide these features.</Text>
        <Text className="mt-3 text-muted text-xs leading-5">Review the Privacy Policy and Terms of Service in Settings.</Text>
        <Pressable disabled={saving} onPress={() => void accept()} accessibilityRole="button" className="mt-5 h-11 items-center justify-center rounded-xl" style={{ backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }}>
          <Text className="text-bg font-medium">{saving ? 'Saving…' : 'I agree'}</Text>
        </Pressable>
        <Pressable disabled={saving} onPress={() => void signOut()} accessibilityRole="button" className="mt-3 h-11 items-center justify-center">
          <Text className="text-muted text-sm underline">Not now — sign out</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
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
      <Stack.Screen name="personalization" />
      <Stack.Screen name="digest-settings" />
      <Stack.Screen name="inbox-alias" />
    </Stack>
  );
}
