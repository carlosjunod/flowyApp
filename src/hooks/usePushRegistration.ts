import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';

const isPhysicalDevice = (): boolean => {
  if (Platform.OS === 'web') return false;
  try {
    const Constants = require('expo-constants').default as { isDevice?: boolean };
    return Constants.isDevice ?? false;
  } catch {
    return false;
  }
};

const getProjectId = (): string | undefined => {
  try {
    const Constants = require('expo-constants').default as {
      expoConfig?: { extra?: { eas?: { projectId?: string } } };
      easConfig?: { projectId?: string };
    };
    return (
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined
    );
  } catch {
    return undefined;
  }
};

const writePushToken = async (userId: string, token: string): Promise<void> => {
  try {
    await pb.collection('users').update(userId, { push_token: token });
  } catch (err) {
    if (__DEV__) console.warn('[push] failed to persist token:', err);
  }
};

export const usePushRegistration = (): void => {
  const { user } = useAuth();
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (!isPhysicalDevice()) return;

    let cancelled = false;
    (async () => {
      try {
        // Lazy-require so a missing native module / entitlement at app load
        // doesn't crash module evaluation.
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          const ask = await Notifications.requestPermissionsAsync();
          status = ask.status;
        }
        if (status !== 'granted') return;

        const projectId = getProjectId();
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (cancelled) return;
        const token = tokenResult.data;
        if (!token || token === lastTokenRef.current) return;
        lastTokenRef.current = token;
        await writePushToken(user.id, token);
      } catch (err) {
        if (__DEV__) console.warn('[push] registration skipped:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);
};
