import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import type { Item, ItemStatus } from '@/types';
import type { ItemsPage } from '@/hooks/useItems';

type Snapshot = {
  status: ItemStatus;
  hasSummary: boolean;
  hasContent: boolean;
  mediaInsights: number;
};

const hasText = (value: string | undefined | null): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const countMediaInsights = (item: Item): number => {
  if (!item.media || item.media.length === 0) return 0;
  let n = 0;
  for (const slide of item.media) {
    if (hasText(slide.summary) || hasText(slide.extracted_text) || hasText(slide.transcript)) {
      n += 1;
    }
  }
  return n;
};

const snapshotOf = (item: Item): Snapshot => ({
  status: item.status,
  hasSummary: hasText(item.summary),
  hasContent: hasText(item.content),
  mediaInsights: countMediaInsights(item),
});

const titleOf = (item: Item): string => {
  if (hasText(item.title)) return item.title!.trim();
  if (hasText(item.original_title)) return item.original_title!.trim();
  return 'Your saved item';
};

const scheduleLocalNotification = async (
  title: string,
  body: string,
  itemId: string,
): Promise<void> => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const Notifications =
      require('expo-notifications') as typeof import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { itemId },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (err) {
    if (__DEV__) console.warn('[notifications] schedule failed:', err);
  }
};

const seedFromCache = (
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
  snapshots: Map<string, Snapshot>,
): void => {
  const matches = qc.getQueriesData<InfiniteData<ItemsPage>>({
    queryKey: ['items', userId],
  });
  for (const [, data] of matches) {
    if (!data) continue;
    for (const page of data.pages) {
      for (const item of page.items) {
        if (!snapshots.has(item.id)) {
          snapshots.set(item.id, snapshotOf(item));
        }
      }
    }
  }
  const single = qc.getQueriesData<Item>({ queryKey: ['item'] });
  for (const [, item] of single) {
    if (item && item.user === userId && !snapshots.has(item.id)) {
      snapshots.set(item.id, snapshotOf(item));
    }
  }
};

export const useItemNotifications = (): void => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const snapshotsRef = useRef<Map<string, Snapshot>>(new Map());
  const notifiedReadyRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    snapshotsRef.current.clear();
    notifiedReadyRef.current.clear();
    seedFromCache(qc, user.id, snapshotsRef.current);

    const evaluate = (action: string, item: Item): void => {
      if (item.user !== user.id) return;

      const prev = snapshotsRef.current.get(item.id);
      const next = snapshotOf(item);
      snapshotsRef.current.set(item.id, next);

      // Skip create events — the item is brand new, nothing to "complete" yet.
      if (action === 'create') return;
      if (action === 'delete') {
        snapshotsRef.current.delete(item.id);
        notifiedReadyRef.current.delete(item.id);
        return;
      }

      const prevStatus: ItemStatus | undefined = prev?.status;
      const becameReady =
        next.status === 'ready' &&
        prevStatus !== 'ready' &&
        !notifiedReadyRef.current.has(item.id);

      if (becameReady) {
        notifiedReadyRef.current.add(item.id);
        void scheduleLocalNotification(
          'Ready to read',
          `${titleOf(item)} finished processing`,
          item.id,
        );
        return;
      }

      // Already-ready item — check whether we just gained new augmented info.
      if (prev && prevStatus === 'ready' && next.status === 'ready') {
        const gainedSummary = !prev.hasSummary && next.hasSummary;
        const gainedContent = !prev.hasContent && next.hasContent;
        const gainedMedia = next.mediaInsights > prev.mediaInsights;
        if (gainedSummary || gainedContent || gainedMedia) {
          void scheduleLocalNotification(
            'New insights added',
            `${titleOf(item)} has fresh enriched details`,
            item.id,
          );
        }
      }
    };

    (async () => {
      try {
        const fn = await pb.collection('items').subscribe<Item>('*', (ev) => {
          if (cancelled) return;
          if (!ev.record) return;
          evaluate(ev.action, ev.record);
        });
        if (cancelled) {
          fn();
          return;
        }
        unsub = fn;
      } catch (err) {
        if (__DEV__) console.warn('[notifications] subscription failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user?.id, qc]);
};
