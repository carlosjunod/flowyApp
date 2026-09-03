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
  // Monotonic run id rather than a shared `cancelled` boolean.
  //
  // A boolean cannot express what this hook needs: `reset()` must abandon the
  // run that is in flight while leaving the hook able to start a new one. The
  // previous code did `cancelled = true; cancelled = false;` back to back, so
  // the in-flight workers — which only observe the flag after each `await` —
  // never saw the `true` and kept importing into a sheet the user had closed.
  //
  // Each submit claims the next id and compares against it; `reset()` and
  // unmount simply bump the id, which invalidates every run in flight without
  // blocking the next one.
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
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

      // Claim this run. Anything already in flight is now stale.
      const runId = (runIdRef.current += 1);
      const isStale = (): boolean => runIdRef.current !== runId;

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
          if (isStale()) return;
          const url = queue.shift();
          if (!url) break;
          const res = await api.ingest({ type: 'url', raw_url: url });
          if (isStale()) return;
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

      if (isStale()) return;

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
    // Bumping the id abandons whatever is in flight; the next submit claims a
    // fresh one, so this does not block starting another import.
    runIdRef.current += 1;
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
