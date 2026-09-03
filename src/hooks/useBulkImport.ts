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

// The web app has no bulk-ingest endpoint — it loops single POST /api/ingest
// calls with bounded concurrency (see web BulkAddBookmarksButton). We mirror
// that here while keeping this hook's public {phase,batch,error,submit,reset}
// contract so BulkImportSheet (which reads batch.processed/total/dead_count)
// needs no changes.
const CONCURRENCY = 4;

export const useBulkImport = () => {
  const qc = useQueryClient();
  const [state, setState] = useState<State>({ phase: 'idle', batch: null, error: null });
  // Monotonic run id rather than a shared `cancelled` boolean. reset() must
  // abandon the run in flight while leaving the hook able to start a new one,
  // which a boolean cannot express: the old code set it true then immediately
  // false, so workers — which only check after each await — never saw the
  // true and kept importing into a sheet the user had closed.
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  const submit = useCallback(
    async (urls: string[], _dedupeAgainst?: string[]) => {
      if (urls.length === 0) {
        setState({
          phase: 'error',
          batch: null,
          error: { code: 'INVALID_INPUT', message: 'No valid URLs to import' },
        });
        return;
      }
      // Claim this run. Anything already in flight is now stale.
      const runId = (runIdRef.current += 1);
      const isStale = (): boolean => runIdRef.current !== runId;

      const total = urls.length;
      let processed = 0;
      let dead = 0;
      const publish = (done: boolean) =>
        setState({
          phase: done ? 'done' : 'polling',
          batch: {
            id: 'local',
            status: done ? 'done' : 'processing',
            processed,
            dead_count: dead,
            total,
          },
          error: null,
        });

      setState({
        phase: 'submitting',
        batch: { id: 'local', status: 'processing', processed: 0, dead_count: 0, total },
        error: null,
      });

      const queue = [...urls];
      const worker = async () => {
        while (queue.length > 0) {
          if (isStale()) return;
          const url = queue.shift();
          if (!url) break;
          const res = await api.ingest({ type: 'url', raw_url: url });
          if (isStale()) return;
          if (res.error) dead += 1;
          processed += 1;
          publish(false);
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker());
      await Promise.all(workers);
      if (isStale()) return;

      publish(true);
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
    [qc],
  );

  const reset = useCallback(() => {
    // Bumping the id abandons whatever is in flight without blocking the next run.
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
