import { Redirect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Spinner size="large" />
      </View>
    );
  }
  return <Redirect href={user ? '/inbox' : '/login'} />;
}
