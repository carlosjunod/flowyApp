import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import type { ApiError, ImportBatch } from '@/types';

type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

type State = {
  phase: Phase;
  batch: ImportBatch | null;
  error: ApiError | null;
};

const POLL_MS = 2000;

export const useBulkImport = () => {
  const qc = useQueryClient();
  const [state, setState] = useState<State>({ phase: 'idle', batch: null, error: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
  }, []);

  const poll = useCallback(
    async (batchId: string) => {
      if (cancelledRef.current) return;
      const res = await api.getImportBatch(batchId);
      if (cancelledRef.current) return;
      if (res.error) {
        setState({ phase: 'error', batch: null, error: res.error });
        return;
      }
      const batch = res.data;
      if (batch.status === 'done') {
        setState({ phase: 'done', batch, error: null });
        void qc.invalidateQueries({ queryKey: ['items'] });
        return;
      }
      setState((s) => ({ ...s, batch }));
      timerRef.current = setTimeout(() => {
        void poll(batchId);
      }, POLL_MS);
    },
    [qc],
  );

  const submit = useCallback(
    async (urls: string[], dedupeAgainst?: string[]) => {
      if (urls.length === 0) {
        setState({
          phase: 'error',
          batch: null,
          error: { code: 'INVALID_INPUT', message: 'No valid URLs to import' },
        });
        return;
      }
      cancelledRef.current = false;
      clearTimer();
      setState({ phase: 'submitting', batch: null, error: null });
      const res = await api.ingestBulk({ urls, dedupeAgainst });
      if (cancelledRef.current) return;
      if (res.error) {
        setState({ phase: 'error', batch: null, error: res.error });
        return;
      }
      setState({
        phase: 'polling',
        batch: {
          id: res.data.batch_id,
          status: 'processing',
          processed: 0,
          dead_count: 0,
          total: res.data.total,
        },
        error: null,
      });
      void poll(res.data.batch_id);
    },
    [poll],
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    cancelledRef.current = false;
    setState({ phase: 'idle', batch: null, error: null });
  }, []);

  return {
    phase: state.phase,
    batch: state.batch,
    error: state.error,
    submit,
    reset,
  };
};
