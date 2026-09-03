import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { pb } from '@/lib/pb';
import type { Item } from '@/types';

const POLL_MS = 3000;

// An item is only "settled" when nothing is still running on it.
//
// Watching `status` alone was not enough: an exploration ("Explore & Enrich" /
// "Deep dive") never touches `status` — it moves `exploration.status` through
// exploring -> enriched. Since the user opens the detail screen on an item
// that is already `ready`, the first poll tick used to tear down both the
// interval and the realtime subscription ~3s after mount, before the job
// finished. The CTA would sit on its "Enriching…" shimmer forever, because
// this screen has no pull-to-refresh, until the user left and came back.
const isSettled = (item: Item): boolean => {
  const ingestDone = item.status === 'ready' || item.status === 'error';
  const exploringNow = item.exploration?.status === 'exploring';
  return ingestDone && !exploringNow;
};

export const useItemStatus = (id: string | undefined): void => {
  const qc = useQueryClient();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let intervalHandle: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const stopPolling = () => {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
    };

    const maybeStop = (item: Item) => {
      if (isSettled(item)) {
        stopPolling();
        unsubscribe?.();
      }
    };

    const handleItem = (item: Item) => {
      if (cancelled) return;
      qc.setQueryData<Item>(['item', id], item);
      qc.invalidateQueries({ queryKey: ['items'] });
      maybeStop(item);
    };

    (async () => {
      try {
        const fn = await pb.collection('items').subscribe<Item>(id, (ev) => {
          if (ev.record) handleItem(ev.record);
        });
        if (cancelled) {
          fn();
          return;
        }
        unsubscribe = fn;
      } catch {
        // ignore, polling will still run
      }
    })();

    intervalHandle = setInterval(async () => {
      try {
        const item = await pb.collection('items').getOne<Item>(id);
        handleItem(item);
      } catch {
        // swallow transient poll errors
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      stopPolling();
      unsubscribe?.();
    };
  }, [id, qc]);
};
