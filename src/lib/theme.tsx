import * as SecureStore from 'expo-secure-store';
import { colorScheme } from 'nativewind';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

type Theme = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

type Ctx = {
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const STORAGE_KEY = 'flowy.theme';

const ThemeContext = createContext<Ctx | null>(null);

const isTheme = (v: unknown): v is Theme =>
  v === 'light' || v === 'dark' || v === 'system';

const resolveFrom = (t: Theme, system: ColorSchemeName): Resolved => {
  if (t === 'system') return system === 'dark' ? 'dark' : 'light';
  return t;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolved, setResolved] = useState<Resolved>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (cancelled) return;
        const next: Theme = isTheme(stored) ? stored : 'system';
        setThemeState(next);
        const r = resolveFrom(next, Appearance.getColorScheme());
        setResolved(r);
        colorScheme.set(r);
      } catch {
        colorScheme.set(resolved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const sub = Appearance.addChangeListener(({ colorScheme: next }) => {
      const r: Resolved = next === 'dark' ? 'dark' : 'light';
      setResolved(r);
      colorScheme.set(r);
    });
    return () => sub.remove();
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (next === 'system') {
      SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
    } else {
      SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
    }
    const r = resolveFrom(next, Appearance.getColorScheme());
    setResolved(r);
    colorScheme.set(r);
  }, []);

  const toggle = useCallback(() => {
    const order: Theme[] = ['system', 'light', 'dark'];
    const i = order.indexOf(theme);
    setTheme(order[(i + 1) % order.length] ?? 'system');
  }, [theme, setTheme]);

  const value = useMemo<Ctx>(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Ctx => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};

export const themeColors = {
  light: {
    bg: '#F8F4EA',
    surface: '#F0E8D4',
    card: '#FFFFFF',
    fg: '#1C1815',
    muted: '#6B6258',
    accent: '#DB663C',
    border: '#DFD5C2',
    danger: '#DC2626',
    success: '#10B981',
  },
  dark: {
    bg: '#1A1C20',
    surface: '#20232A',
    card: '#272A31',
    fg: '#EEEAE0',
    muted: '#9DA1AA',
    accent: '#EB7C4C',
    border: '#3A3D44',
    danger: '#F87171',
    success: '#34D399',
  },
} as const;

export const useResolvedColors = () => {
  const { resolved } = useTheme();
  return themeColors[resolved];
};
