import { usePathname } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BackHandler } from 'react-native';

type SelectionApi = {
  mode: boolean;
  selectedIds: ReadonlySet<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  enter: () => void;
  enterWith: (id: string) => void;
  exit: () => void;
};

const SelectionContext = createContext<SelectionApi | null>(null);

export const SelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [mode, setMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const enter = useCallback(() => setMode(true), []);

  const exit = useCallback(() => {
    setMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterWith = useCallback((id: string) => {
    setMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  useEffect(() => {
    exit();
  }, [pathname, exit]);

  useEffect(() => {
    if (!mode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exit();
      return true;
    });
    return () => sub.remove();
  }, [mode, exit]);

  const api = useMemo<SelectionApi>(
    () => ({ mode, selectedIds, toggle, selectAll, clear, enter, enterWith, exit }),
    [mode, selectedIds, toggle, selectAll, clear, enter, enterWith, exit],
  );

  return <SelectionContext.Provider value={api}>{children}</SelectionContext.Provider>;
};

export const useSelection = (): SelectionApi => {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used inside SelectionProvider');
  return ctx;
};
