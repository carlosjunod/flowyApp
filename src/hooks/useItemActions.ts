import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { api } from '@/lib/api';
import type { ApiError, BulkActionResult } from '@/types';

type SingleResult = { ok: true } | { ok: false; error: ApiError };
type BulkResult =
  | { ok: true; data: BulkActionResult }
  | { ok: false; error: ApiError }
  | { ok: false; cancelled: true };

const invalidateItem = (id: string) => ['item', id] as const;

const confirm = (message: string): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert('Confirm', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });

export const useItemActions = () => {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const mark = useCallback((ids: string[], on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const open = useCallback((id: string) => {
    router.push(`/item/${id}`);
  }, []);

  const reloadItem = useCallback(
    async (id: string): Promise<SingleResult> => {
      mark([id], true);
      const res = await api.reloadItem(id);
      mark([id], false);
      if (res.error) return { ok: false, error: res.error };
      void qc.invalidateQueries({ queryKey: invalidateItem(id) });
      void qc.invalidateQueries({ queryKey: ['items'] });
      return { ok: true };
    },
    [qc, mark],
  );

  const deleteItem = useCallback(
    async (id: string, opts: { confirm?: boolean } = { confirm: true }): Promise<SingleResult> => {
      if (opts.confirm) {
        const ok = await confirm('Delete this item? This cannot be undone.');
        if (!ok) return { ok: false, error: { code: 'INVALID_INPUT', message: 'Cancelled' } };
      }
      mark([id], true);
      const res = await api.deleteItem(id);
      mark([id], false);
      if (res.error) return { ok: false, error: res.error };
      void qc.invalidateQueries({ queryKey: invalidateItem(id) });
      void qc.invalidateQueries({ queryKey: ['items'] });
      return { ok: true };
    },
    [qc, mark],
  );

  const reloadMany = useCallback(
    async (ids: string[]): Promise<BulkResult> => {
      if (ids.length === 0) return { ok: true, data: { succeeded: [], failed: [] } };
      mark(ids, true);
      const res = await api.bulkReloadItems({ ids });
      mark(ids, false);
      if (res.error) return { ok: false, error: res.error };
      void qc.invalidateQueries({ queryKey: ['items'] });
      return { ok: true, data: res.data };
    },
    [qc, mark],
  );

  const deleteMany = useCallback(
    async (ids: string[]): Promise<BulkResult> => {
      if (ids.length === 0) return { ok: true, data: { succeeded: [], failed: [] } };
      const ok = await confirm(
        ids.length === 1 ? 'Delete 1 item?' : `Delete ${ids.length} items? This cannot be undone.`,
      );
      if (!ok) return { ok: false, cancelled: true };
      mark(ids, true);
      const res = await api.bulkDeleteItems({ ids });
      mark(ids, false);
      if (res.error) return { ok: false, error: res.error };
      void qc.invalidateQueries({ queryKey: ['items'] });
      return { ok: true, data: res.data };
    },
    [qc, mark],
  );

  return useMemo(
    () => ({ open, reloadItem, deleteItem, reloadMany, deleteMany, pending }),
    [open, reloadItem, deleteItem, reloadMany, deleteMany, pending],
  );
};

export type UseItemActionsReturn = ReturnType<typeof useItemActions>;
