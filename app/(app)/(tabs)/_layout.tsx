import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useChat } from '@/hooks/useChat';
import { useResolvedColors } from '@/lib/theme';

export default function AppTabs() {
  const colors = useResolvedColors();
  const chat = useChat();
  return (
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
          title: 'Digests',
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
    </Tabs>
  );
}
