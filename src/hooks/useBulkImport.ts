import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import type { ApiError, ImportBatch } from '@/types';

// Client-side bulk import. Loops `POST /api/ingest` one URL at a time
// with bounded concurrency — mirrors the web's `BulkAddBookmarksButton`
// (Flowy/apps/web/components/inbox/BulkAddBookmarksButton.tsx). The web
// has no `/api/ingest/bulk` or `/api/import-batches/:id` endpoint, so
// this hook owns the batch state locally instead of polling the server.
//
// The public shape (phase / batch / error / submit / reset) is preserved
// so `BulkImportSheet.tsx` keeps working without changes. `phase` now
// transitions idle → submitting → done | error (no `polling` step, since
// the work is in-process).

type Phase = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

type State = {
  phase: Phase;
  batch: ImportBatch | null;
  error: ApiError | null;
};

// Matches the web's `CONCURRENCY = 4` so we don't overrun /api/ingest's
// upstream scraping/AI rate limits when a user pastes 50+ links.
const CONCURRENCY = 4;
const MAX_URLS = 100;

const randomBatchId = (): string =>
  `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useBulkImport = () => {
  const qc = useQueryClient();
  const [state, setState] = useState<State>({ phase: 'idle', batch: null, error: null });
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const submit = useCallback(
    async (urls: string[]) => {
      if (urls.length === 0) {
        setState({
          phase: 'error',
          batch: null,
          error: { code: 'INVALID_INPUT', message: 'No valid URLs to import' },
        });
        return;
      }
      if (urls.length > MAX_URLS) {
        setState({
          phase: 'error',
          batch: null,
          error: { code: 'INVALID_INPUT', message: `Max ${MAX_URLS} URLs per batch` },
        });
        return;
      }

      cancelledRef.current = false;
      const batchId = randomBatchId();
      const total = urls.length;

      setState({
        phase: 'submitting',
        batch: { id: batchId, status: 'processing', processed: 0, dead_count: 0, total },
        error: null,
      });

      const queue = [...urls];
      let processed = 0;
      let dead = 0;

      const worker = async () => {
        while (queue.length > 0) {
          if (cancelledRef.current) return;
          const url = queue.shift();
          if (!url) break;
          const res = await api.ingest({ type: 'url', raw_url: url });
          if (cancelledRef.current) return;
          if (res.error) dead += 1;
          processed += 1;
          setState((s) =>
            s.batch
              ? {
                  ...s,
                  batch: { ...s.batch, processed, dead_count: dead },
                }
              : s,
          );
        }
      };

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, urls.length) },
        () => worker(),
      );
      await Promise.all(workers);

      if (cancelledRef.current) return;

      setState({
        phase: 'done',
        batch: { id: batchId, status: 'done', processed, dead_count: dead, total },
        error: null,
      });
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
    [qc],
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
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
