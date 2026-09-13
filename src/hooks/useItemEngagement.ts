import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import type { Item } from '@/types';

/** Kept alive for the entire reader lifetime, including already-ready items. */
export function useItemEngagement(item: Item | undefined) {
  const { user } = useAuth();
  const userId = user?.id;
  const id = item?.id;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    setError(null);
    setBusy(false);
    inFlight.current = false;
    if (!id || !userId || item?.user !== userId) return;
    let cancelled = false;
    let opened = !!item.first_opened_at;
    let opening = false;
    let unsubscribe: (() => void) | undefined;
    const token = pb.authStore.token;
    const current = () => !cancelled && pb.authStore.model?.id === userId && pb.authStore.token === token;
    const refresh = () => {
      if (!current()) return;
      void qc.invalidateQueries({ queryKey: ['item', id, userId] });
      void qc.invalidateQueries({ queryKey: ['items', userId] });
    };
    const recordOpen = async () => {
      if (!current() || opened || opening || AppState.currentState !== 'active') return;
      opening = true;
      const result = await api.itemEngagement(userId, id, 'open');
      opening = false;
      if (!current()) return;
      if (!result.error) { opened = true; refresh(); }
      // Transient failures retry on foreground or the periodic reconciliation.
    };
    void recordOpen();
    void pb.collection('items').subscribe<Item>(id, event => {
      if (event.record?.user === userId) refresh();
    }).then(fn => { if (!current()) fn(); else unsubscribe = fn; }).catch(() => {});
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') { refresh(); void recordOpen(); }
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') { refresh(); void recordOpen(); }
    }, 30_000);
    return () => { cancelled = true; unsubscribe?.(); foreground.remove(); clearInterval(timer); };
  }, [id, userId, item?.user, qc]);

  const toggleRead = useCallback(async () => {
    if (!item || !userId || item.user !== userId || inFlight.current) return;
    const token = pb.authStore.token;
    const startedGeneration = generation.current;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const result = await api.itemEngagement(userId, item.id, item.read_at ? 'mark_unread' : 'mark_read');
    if (generation.current !== startedGeneration || pb.authStore.model?.id !== userId || pb.authStore.token !== token) return;
    if (result.error) setError('Could not save your reading status. Check your connection and try again.');
    else {
      // Refetch instead of merging a response that could precede another client's write.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['item', item.id, userId] }),
        qc.invalidateQueries({ queryKey: ['items', userId] }),
      ]);
    }
    if (generation.current !== startedGeneration) return;
    inFlight.current = false;
    setBusy(false);
  }, [item, userId, qc]);
  return { busy, error, toggleRead };
}
