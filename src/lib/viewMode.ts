import { useCallback, useEffect, useState } from 'react';

import type { ViewMode } from '@/types';

import { localSecureStore } from './secureStore';

const VIEW_MODE_KEY = 'tryflowy.viewMode';
const DEFAULT: ViewMode = 'grid';

const isViewMode = (value: unknown): value is ViewMode =>
  value === 'grid' || value === 'list' || value === 'detail';

export const useViewMode = (): [ViewMode, (mode: ViewMode) => void] => {
  const [mode, setMode] = useState<ViewMode>(DEFAULT);

  useEffect(() => {
    let mounted = true;
    localSecureStore.getItem(VIEW_MODE_KEY).then((raw) => {
      if (!mounted) return;
      if (isViewMode(raw)) setMode(raw);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const update = useCallback((next: ViewMode) => {
    setMode(next);
    void localSecureStore.setItem(VIEW_MODE_KEY, next);
  }, []);

  return [mode, update];
};
