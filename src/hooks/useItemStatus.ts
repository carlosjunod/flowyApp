import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { pb } from '@/lib/pb';
import type { Item, ItemStatus } from '@/types';

const POLL_MS = 3000;

const isSettled = (status: ItemStatus): boolean =>
  status === 'ready' || status === 'error';

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

    const maybeStop = (status: ItemStatus) => {
      if (isSettled(status)) {
        stopPolling();
        unsubscribe?.();
      }
    };

    const handleItem = (item: Item) => {
      if (cancelled) return;
      qc.setQueryData<Item>(['item', id], item);
      qc.invalidateQueries({ queryKey: ['items'] });
      maybeStop(item.status);
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
