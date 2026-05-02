import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { View, useWindowDimensions } from 'react-native';

import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth';
import { SelectionProvider } from '@/lib/selection';
import { useResolvedColors } from '@/lib/theme';

export default function AppLayout() {
  const { user, ready } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const colors = useResolvedColors();

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Spinner size="large" />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <SelectionProvider>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: isWide
          ? { display: 'none' }
          : { borderTopColor: colors.border, backgroundColor: colors.bg },
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
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-square" size={size ?? 20} color={color} />
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
      <Tabs.Screen name="digest" options={{ href: null, title: 'Digest' }} />
      <Tabs.Screen name="digest-settings" options={{ href: null, title: 'Digest settings' }} />
    </Tabs>
    </SelectionProvider>
  );
}
