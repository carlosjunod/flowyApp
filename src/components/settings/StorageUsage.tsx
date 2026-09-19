import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { pb } from '@/lib/pb';
import { useResolvedColors } from '@/lib/theme';
import { formatFileBytes, type StorageUsage as Usage } from '@/types/files';
import { StorageAction } from './StorageAction';
import { StorageManager } from './StorageManager';

export function StorageUsage() {
  const colors = useResolvedColors();
  const { t, locale } = useI18n();
  const [usage, setUsage] = useState<Usage | null>(null),
    [error, setError] = useState(false),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const token = pb.authStore.token;
    setLoading(true);
    setError(false);
    void api
      .storageUsage()
      .then((r) => {
        if (cancelled || pb.authStore.token !== token) return;
        if (r.error) setError(true);
        else setUsage(r.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);
  const total = usage ? usage.usedBytes + usage.reservedBytes : 0;
  // Unit symbols stay international; only the decimal separator follows locale.
  const size = (bytes: number): string => formatFileBytes(bytes, locale);
  const width = (bytes: number): `${number}%` =>
    `${Math.min(100, (bytes / (usage?.limitBytes || 1)) * 100)}%`;
  return (
    <>
      <View
        accessibilityLabel={t('settings.storage.usageLabel')}
        accessibilityState={{ busy: loading }}
        className="pb-4"
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-sans text-sm font-medium text-fg">
            {t('settings.storage.spaceUsed')}
          </Text>
          <StorageAction
            label={t('settings.storage.refreshUsage')}
            icon="refresh-cw"
            disabled={loading}
            onPress={() => setVersion((v) => v + 1)}
          />
        </View>
        {usage ? (
          <>
            <View className="mb-4 flex-row flex-wrap items-baseline justify-between gap-2">
              <Text className="font-sans text-xl font-medium text-fg">
                {size(total)}{' '}
                <Text className="font-normal text-muted">
                  {t('settings.storage.of', { total: size(usage.limitBytes) })}
                </Text>
              </Text>
              {/* The plan name comes from the server and is shown as given. */}
              <Text className="font-sans text-[13px] capitalize text-muted">
                {t('settings.storage.planSuffix', { plan: usage.plan })}
              </Text>
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t('settings.storage.usedProgress')}
              accessibilityValue={{
                min: 0,
                max: usage.limitBytes,
                now: Math.min(total, usage.limitBytes),
                text: t('settings.storage.usedOf', {
                  used: size(total),
                  total: size(usage.limitBytes),
                }),
              }}
              className="h-1.5 flex-row overflow-hidden rounded bg-surface"
            >
              <View
                style={{
                  width: width(
                    Math.max(0, usage.usedBytes - usage.pendingDeletionBytes),
                  ),
                  backgroundColor: colors.accent,
                }}
              />
              <View
                style={{
                  width: width(usage.pendingDeletionBytes),
                  backgroundColor: colors.muted,
                }}
              />
              <View
                style={{
                  width: width(usage.reservedBytes),
                  backgroundColor: colors.muted,
                  opacity: 0.45,
                }}
              />
            </View>
            <Text className="mt-3 font-sans text-sm text-muted">
              {t('settings.storage.available', { size: size(usage.availableBytes) })}
            </Text>
            {usage.reservedBytes > 0 ? (
              <Text className="mt-2 font-sans text-[13px] leading-5 text-muted">
                {t('settings.storage.reserved', { size: size(usage.reservedBytes) })}
              </Text>
            ) : null}
            {usage.pendingDeletionBytes > 0 ? (
              <Text className="mt-2 font-sans text-[13px] leading-5 text-muted">
                {t('settings.storage.pendingDeletion', {
                  size: size(usage.pendingDeletionBytes),
                })}
              </Text>
            ) : null}
            {usage.inventoryPending ? (
              <Text className="mt-3 font-sans text-sm leading-5 text-muted">
                {t('settings.storage.inventoryPending')}
              </Text>
            ) : null}
            {total >= usage.limitBytes * 0.8 ? (
              <Text className="mt-3 font-sans text-sm leading-5 text-fg">
                {total >= usage.limitBytes
                  ? t('settings.storage.full')
                  : t('settings.storage.almostFull')}
                {t('settings.storage.fullHint')}
              </Text>
            ) : null}
          </>
        ) : loading ? (
          <View accessibilityLabel={t('settings.storage.loadingUsage')} className="gap-4">
            <View className="h-6 w-48 rounded bg-surface" />
            <View className="h-1.5 rounded bg-surface" />
            <View className="h-4 w-32 rounded bg-surface" />
          </View>
        ) : null}
        {error ? (
          <View className="mt-3">
            <Text
              accessibilityRole="alert"
              className="font-sans text-sm text-fg"
            >
              {t('settings.storage.loadFailed')}
            </Text>
            <StorageAction
              title={t('settings.storage.retry')}
              tone="action"
              onPress={() => setVersion((v) => v + 1)}
            />
          </View>
        ) : null}
      </View>
      <StorageManager onChanged={() => setVersion((v) => v + 1)} />
    </>
  );
}
