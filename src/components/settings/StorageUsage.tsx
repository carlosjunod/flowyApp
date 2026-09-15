import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { pb } from '@/lib/pb';
import { formatFileBytes, type StorageUsage as Usage } from '@/types/files';
export function StorageUsage() {
  const [usage, setUsage] = useState<Usage | null>(null),
    [error, setError] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const token = pb.authStore.token;
    setUsage(null);
    setError(false);
    void api.storageUsage().then((r) => {
      if (cancelled || pb.authStore.token !== token) return;
      if (r.error) setError(true);
      else setUsage(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);
  return (
    <View
      accessibilityLabel="Storage usage"
      className="rounded-xl border border-border bg-card px-4 py-3"
    >
      <Text className="text-base font-semibold text-fg">Storage</Text>
      {usage ? (
        <>
          <Text className="mt-2 text-fg">
            {formatFileBytes(usage.usedBytes + usage.reservedBytes)} of{' '}
            {formatFileBytes(usage.limitBytes)}
          </Text>
          <Text className="mt-1 text-xs text-muted">
            {usage.plan} plan · {formatFileBytes(usage.availableBytes)}{' '}
            available
          </Text>
          {usage.inventoryPending ? (
            <Text className="mt-2 text-sm text-muted">
              We are measuring your existing files. Uploads will resume once
              inventory is complete.
            </Text>
          ) : null}
          {usage.pendingDeletionBytes > 0 ? (
            <Text className="mt-2 text-sm text-muted">
              {formatFileBytes(usage.pendingDeletionBytes)} awaiting cleanup.
            </Text>
          ) : null}
          {usage.availableBytes <= usage.limitBytes * 0.2 ? (
            <Text className="mt-2 text-sm text-fg">
              Storage is almost full. Delete saved items to free space, or
              change your plan.
            </Text>
          ) : null}
        </>
      ) : (
        <Text className="mt-2 text-muted">
          {error ? 'Could not load storage.' : 'Loading storage…'}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => setVersion((v) => v + 1)}
        className="min-h-[44px] justify-center"
      >
        <Text className="text-accent">Refresh usage</Text>
      </Pressable>
    </View>
  );
}
