import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { registerPushForCurrentUser, type PushRegistrationResult } from '@/hooks/usePushRegistration';
import { useAuth } from '@/lib/auth';

export function PushNotificationSettings() {
  const { user } = useAuth();
  const [result, setResult] = useState<PushRegistrationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef<(request: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    let active = true;
    let pending = false;
    setResult(null);
    run.current = async (request) => {
      if (pending) return;
      pending = true;
      setBusy(true);
      const next = await registerPushForCurrentUser(request);
      pending = false;
      if (active) {
        setResult(next);
        setBusy(false);
      }
    };
    void run.current(false);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run.current(false);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [user?.id]);

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <Text className="text-base text-fg">Device notifications</Text>
      <Text className="text-sm text-muted" accessibilityLiveRegion="polite">
        {result?.message ?? 'Checking notification permissions…'}
      </Text>
      {result?.status !== 'unsupported' && (
        <Button
          title={result?.status === 'settings-required' ? 'Open device settings' : result?.status === 'registered' ? 'Check notifications' : result?.status === 'error' ? 'Try again' : 'Enable notifications'}
          variant="secondary"
          loading={busy}
          onPress={() => {
            if (result?.status === 'settings-required') {
              void Linking.openSettings().catch(() => setResult({
                status: 'settings-required',
                message: 'Open your device settings and allow notifications for Flowy.',
              }));
            } else {
              void run.current(true);
            }
          }}
        />
      )}
    </View>
  );
}
