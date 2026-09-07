import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth';
import { ChatProvider, useChat } from '@/hooks/useChat';
import { SelectionProvider } from '@/lib/selection';
import { useResolvedColors } from '@/lib/theme';

export default function AppLayout() {
  const { user, ready } = useAuth();
  const colors = useResolvedColors();

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Spinner size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;

  return <ChatProvider key={user.id} accountId={user.id}><AppTabs /></ChatProvider>;
}

function AppTabs() {
  const colors = useResolvedColors();
  const chat = useChat();
  return (
    <SelectionProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <Feather name="inbox" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarBadge: chat.generatingId ? '…' : chat.unread ? '•' : undefined,
          tabBarAccessibilityLabel: chat.generatingId ? 'Chat, preparing response' : chat.unread ? 'Chat, new response' : 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-square" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="digest"
        options={{
          title: 'Daily',
          tabBarIcon: ({ color, size }) => (
            <Feather name="sunrise" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size ?? 20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="item/[id]"
        options={{ href: null, title: 'Item' }}
      />
      <Tabs.Screen name="digest-settings" options={{ href: null, title: 'Digest settings' }} />
      <Tabs.Screen name="inbox-alias" options={{ href: null, title: 'Email to inbox' }} />
    </Tabs>
    </SelectionProvider>
  );
}
