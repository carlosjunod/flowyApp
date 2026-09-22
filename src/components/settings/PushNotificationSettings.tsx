import React, { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { registerPushForCurrentUser, type PushRegistrationResult } from '@/hooks/usePushRegistration';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export function PushNotificationSettings() {
  const { user } = useAuth();
  const { t, tKey } = useI18n();
  const [result, setResult] = useState<PushRegistrationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef<(request: boolean) => Promise<void>>(async () => undefined);
  // Read through a ref so the effect below does not re-run on a language
  // switch, which would re-request permission state for no reason.
  const channelName = useRef(t('settings.notifications.channelName'));
  channelName.current = t('settings.notifications.channelName');

  useEffect(() => {
    let active = true;
    let pending = false;
    setResult(null);
    run.current = async (request) => {
      if (pending) return;
      pending = true;
      setBusy(true);
      try {
        const next = await registerPushForCurrentUser(request, channelName.current);
        if (active) setResult(next);
      } finally {
        pending = false;
        if (active) setBusy(false);
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
      <Text className="text-base text-fg">{t('settings.notifications.title')}</Text>
      <Text className="text-sm text-muted" accessibilityLiveRegion="polite">
        {result ? tKey(result.messageKey) : t('settings.notifications.checking')}
      </Text>
      {result?.status !== 'unsupported' && (
        <Button
          title={
            result?.status === 'settings-required'
              ? t('settings.notifications.openSettings')
              : result?.status === 'registered'
                ? t('settings.notifications.check')
                : result?.status === 'error'
                  ? t('settings.notifications.tryAgain')
                  : t('settings.notifications.enable')
          }
          variant="secondary"
          loading={busy}
          onPress={() => {
            if (result?.status === 'settings-required') {
              void Linking.openSettings().catch(() => setResult({
                status: 'settings-required',
                messageKey: 'settings.notifications.settingsFallback',
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
