import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/lib/api';
import { pb } from '@/lib/pb';
import { useResolvedColors } from '@/lib/theme';
import { formatFileBytes, type StorageUsage as Usage } from '@/types/files';
import { StorageAction } from './StorageAction';
import { StorageManager } from './StorageManager';

export function StorageUsage() {
  const colors = useResolvedColors();
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
  const width = (bytes: number): `${number}%` =>
    `${Math.min(100, (bytes / (usage?.limitBytes || 1)) * 100)}%`;
  return (
    <>
      <View
        accessibilityLabel="Storage usage"
        accessibilityState={{ busy: loading }}
        className="pb-4"
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-sans text-sm font-medium text-fg">
            Space used
          </Text>
          <StorageAction
            label="Refresh usage"
            icon="refresh-cw"
            disabled={loading}
            onPress={() => setVersion((v) => v + 1)}
          />
        </View>
        {usage ? (
          <>
            <View className="mb-4 flex-row flex-wrap items-baseline justify-between gap-2">
              <Text className="font-sans text-xl font-medium text-fg">
                {formatFileBytes(total)}{' '}
                <Text className="font-normal text-muted">
                  of {formatFileBytes(usage.limitBytes)}
                </Text>
              </Text>
              <Text className="font-sans text-[13px] capitalize text-muted">
                {usage.plan} plan
              </Text>
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Storage used"
              accessibilityValue={{
                min: 0,
                max: usage.limitBytes,
                now: Math.min(total, usage.limitBytes),
                text: `${formatFileBytes(total)} of ${formatFileBytes(usage.limitBytes)}`,
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
              {formatFileBytes(usage.availableBytes)} available
            </Text>
            {usage.reservedBytes > 0 ? (
              <Text className="mt-2 font-sans text-[13px] leading-5 text-muted">
                {formatFileBytes(usage.reservedBytes)} reserved for uploads in
                progress.
              </Text>
            ) : null}
            {usage.pendingDeletionBytes > 0 ? (
              <Text className="mt-2 font-sans text-[13px] leading-5 text-muted">
                {formatFileBytes(usage.pendingDeletionBytes)} awaiting deletion.
                Space is released after cleanup succeeds.
              </Text>
            ) : null}
            {usage.inventoryPending ? (
              <Text className="mt-3 font-sans text-sm leading-5 text-muted">
                Measuring your existing files. Uploads will resume when the
                inventory is complete.
              </Text>
            ) : null}
            {total >= usage.limitBytes * 0.8 ? (
              <Text className="mt-3 font-sans text-sm leading-5 text-fg">
                {total >= usage.limitBytes
                  ? 'Your storage is full.'
                  : 'Your storage is almost full.'}{' '}
                Remove unneeded originals below, or change your plan.
              </Text>
            ) : null}
          </>
        ) : loading ? (
          <View accessibilityLabel="Loading storage" className="gap-4">
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
              Could not load storage.
            </Text>
            <StorageAction
              title="Retry"
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
