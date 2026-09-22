import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { dictionaries, type TranslationKey } from './dictionaries';
import { deviceLanguageTags } from './device';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeDate,
  formatTime,
} from './format';
import {
  DEFAULT_LOCALE,
  isLocale,
  matchLocale,
  resolveLocale,
  type Locale,
} from './locale';
import { clearStoredLocale, readStoredLocale, writeStoredLocale } from './storage';
import { createTranslate, type TranslateFn } from './translate';

export interface I18nContextValue {
  locale: Locale;
  /** The locale the device asks for, regardless of what is currently active. */
  detected: Locale;
  /** True once the user has picked a language explicitly on this device. */
  explicit: boolean;
  /** Translate a dot-path key, with `{placeholder}` interpolation and plurals. */
  t: TranslateFn<TranslationKey>;
  /**
   * The same translator, typed to accept any string.
   *
   * For the *computed* keys produced by the shared presentation contracts
   * (`itemPresentation`, `readerAction`, `chatErrorKey`, …), whose return type
   * is `string` because they are mirrored into a repo with its own dictionary.
   * Those keys are covered by the contract tests rather than by the compiler —
   * prefer `t` everywhere a literal key is available.
   */
  tKey: TranslateFn<string>;
  /** Persist an explicit choice. Overrides the device language from then on. */
  setLocale: (next: Locale) => void;
  /** Clear the explicit choice and follow the device language again. */
  useDeviceLocale: () => void;
  formatDate: (
    value: string | number | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatDateTime: (
    value: string | number | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatTime: (
    value: string | number | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatRelativeDate: (value: string | number | Date | null | undefined) => string;
  formatBytes: (bytes: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function buildValue(
  locale: Locale,
  detected: Locale,
  explicit: boolean,
  setLocale: (next: Locale) => void,
  useDeviceLocale: () => void,
): I18nContextValue {
  const t = createTranslate<TranslationKey>({
    locale,
    dictionary: dictionaries[locale],
    fallback: dictionaries[DEFAULT_LOCALE],
    fallbackLocale: DEFAULT_LOCALE,
  });
  return {
    locale,
    detected,
    explicit,
    t,
    // Same closure, widened key type. The runtime behaviour is identical; only
    // the compile-time contract differs.
    tKey: t as TranslateFn<string>,
    setLocale,
    useDeviceLocale,
    formatDate: (value, options) => formatDate(value, locale, options),
    formatDateTime: (value, options) => formatDateTime(value, locale, options),
    formatTime: (value, options) => formatTime(value, locale, options),
    formatNumber: (value, options) => formatNumber(value, locale, options),
    formatRelativeDate: (value) => formatRelativeDate(value, locale, t),
    formatBytes: (bytes) => formatBytes(bytes, locale),
  };
}

/**
 * LocaleProvider — the single source of the active interface language.
 *
 * Startup order matters here:
 *
 *   1. The first render resolves the device language *synchronously*. Reading
 *      the secure store is asynchronous, and gating the first frame on it would
 *      mean either a blank screen or a visible English flash on a Spanish
 *      phone. Detection needs no I/O, so it can run in the `useState`
 *      initialiser.
 *   2. The persisted explicit choice is read after mount and applied if there
 *      is one. A failed read is swallowed by the storage adapter: a locked or
 *      unavailable keychain degrades to the detected language, it never blocks
 *      or crashes boot.
 *   3. If the user picks a language — *or picks Automatic* — while that read is
 *      still in flight, `interactions` has moved on and the hydration result is
 *      discarded. This is the race the acceptance criteria call out: without
 *      the guard, a slow keychain could silently revert a tap already made.
 *      A counter rather than a boolean, because "Automatic" is also a choice
 *      and must be just as protected as picking a language.
 *   4. Persistence is serialised through one promise chain. Two taps in quick
 *      succession (es → Automatic) issue a write and a delete; if those raced,
 *      the delete could land first and leave `es` persisted, so the next launch
 *      would come back in Spanish after the user asked for Automatic.
 *
 * Changing the locale re-renders this provider, and with it every consumer, so
 * the switch is immediate rather than deferred to the next navigation.
 */
export const LocaleProvider: React.FC<{
  children: ReactNode;
  /** Test seam: skips detection and storage so a test can pin the locale. */
  initialLocale?: Locale;
}> = ({ children, initialLocale }) => {
  const detected = useMemo<Locale>(
    () => (initialLocale ?? resolveLocale({ preferences: deviceLanguageTags() })),
    [initialLocale],
  );
  const [locale, setLocaleState] = useState<Locale>(detected);
  const [explicit, setExplicit] = useState(false);
  // Refs, not state: the hydration effect reads these *after* an await and must
  // see whatever happened during it. State would still hold the value captured
  // when the effect started.
  const interactions = useRef(0);
  const persistence = useRef<Promise<void>>(Promise.resolve());

  const enqueue = useCallback((operation: () => Promise<void>) => {
    // `then(op, op)` rather than `.finally(op)`: the chain must keep going even
    // if an earlier operation rejected, and it must never reject itself.
    persistence.current = persistence.current.then(operation, operation);
  }, []);

  useEffect(() => {
    if (initialLocale) return;
    let cancelled = false;
    const startedAt = interactions.current;
    void readStoredLocale().then((stored) => {
      if (cancelled || interactions.current !== startedAt || !stored) return;
      setExplicit(true);
      setLocaleState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [initialLocale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (!isLocale(next)) return;
      interactions.current += 1;
      setExplicit(true);
      setLocaleState(next);
      // Fire-and-forget: the choice already applies to this session, and the
      // adapter never rejects. Awaiting here would delay the re-render for no
      // user-visible benefit.
      enqueue(() => writeStoredLocale(next));
    },
    [enqueue],
  );

  const useDeviceLocale = useCallback(() => {
    interactions.current += 1;
    setExplicit(false);
    setLocaleState(resolveLocale({ preferences: deviceLanguageTags() }));
    // Without this delete the row would survive the restart and re-pin the
    // previous explicit language, making "Automatic" a lie after a relaunch.
    enqueue(clearStoredLocale);
  }, [enqueue]);

  const value = useMemo(
    () => buildValue(locale, detected, explicit, setLocale, useDeviceLocale),
    [locale, detected, explicit, setLocale, useDeviceLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/**
 * Fallback used when no provider is mounted.
 *
 * Deliberately graceful rather than a throw — unlike `useChat`, a translation
 * layer is not an invariant. Rendering English is always better than crashing
 * the tree, and unit tests that mount a leaf component in isolation depend on
 * it. `setLocale` is a no-op there, which is correct: there is nothing to
 * re-render.
 */
const FALLBACK: I18nContextValue = buildValue(
  DEFAULT_LOCALE,
  DEFAULT_LOCALE,
  false,
  () => {},
  () => {},
);

export function useI18n(): I18nContextValue {
  return useContext(I18nContext) ?? FALLBACK;
}

/** Convenience for the common case of only needing `t`. */
export function useTranslate(): TranslateFn<TranslationKey> {
  return useI18n().t;
}

/** The device's preferred locale, for the "Automatic (…)" selector row. */
export function detectDeviceLocale(): Locale {
  return matchLocale(deviceLanguageTags()) ?? DEFAULT_LOCALE;
}
