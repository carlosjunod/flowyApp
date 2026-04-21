import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth';
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
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>📥</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>💬</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="item/[id]"
        options={{ href: null, title: 'Item' }}
      />
    </Tabs>
  );
}
