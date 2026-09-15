import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewMode } from '@/types';
import { isCardSize, type CardSize } from '@/types/inbox-presentation';
import { localSecureStore } from './secureStore';

const isViewMode = (value: unknown): value is ViewMode => value === 'grid' || value === 'list';

function usePreference<T extends string>(key: string, fallback: T, valid: (value: unknown) => value is T): [T, (value: T) => void] {
  const [value, setValue] = useState(fallback);
  const edited = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    void localSecureStore.getItem(key).then(raw => { if (alive && !edited.current && valid(raw)) setValue(raw); }).catch(() => {});
    return () => { alive = false; };
  }, [key, valid]);
  const update = useCallback((next: T) => {
    edited.current = true;
    setValue(next);
    writes.current = writes.current.then(() => localSecureStore.setItem(key, next)).catch(() => {});
  }, [key]);
  return [value, update];
}

export const useViewMode = () => usePreference<ViewMode>('tryflowy.viewMode', 'grid', isViewMode);
export const useCardSize = () => usePreference<CardSize>('tryflowy.cardSize', 'medium', isCardSize);
