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

// Upper bound on how long we keep watching an exploration. A worker that dies
// after writing `exploring` would otherwise leave this polling every 3s and
// holding a realtime subscription for as long as the screen stays open.
const MAX_EXPLORE_WATCH_MS = 5 * 60_000;

/**
 * @param id           item to watch
 * @param watchKey     re-arms the watcher when it changes. Pass the item's
 *                     `exploration.status`: settling is not permanent, because
 *                     an exploration can start *after* the item is ready. The
 *                     effect only depends on [id, qc], so without this the
 *                     watcher stops on the first tick of a ready, unexplored
 *                     item and never comes back when the user presses Explore
 *                     — leaving the CTA on its shimmer forever.
 */
export const useItemStatus = (id: string | undefined, watchKey?: string): void => {
  const qc = useQueryClient();

  useEffect(() => {
    if (!id) return;
    const startedAt = Date.now();
    let cancelled = false;
    // Set once we have stopped watching, so a subscription whose setup resolves
    // after that point is torn down instead of quietly staying live.
    let settled = false;
    let intervalHandle: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const stopPolling = () => {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
    };

    const maybeStop = (item: Item) => {
      const givingUp = Date.now() - startedAt > MAX_EXPLORE_WATCH_MS;
      if (isSettled(item) || givingUp) {
        settled = true;
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
        // `settled` matters as much as `cancelled`: if subscribe() takes longer
        // than a poll tick and that tick settled the item, assigning here would
        // leave a live subscription nobody ever closes.
        if (cancelled || settled) {
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
  }, [id, qc, watchKey]);
};
