/**
 * Locale primitives — pure, dependency-free, and importable from anything:
 * components, hooks, the storage adapter and the plain-node test scripts.
 *
 * Native-owned copy of the negotiation half of
 * `apps/web/lib/i18n/locale.ts`. The *policy* is identical to the web client
 * (D-040); only the transport differs, because a phone has no cookie jar and
 * no `Accept-Language` header:
 *
 *   1. An explicit user choice, persisted under `flowy.locale` in the device's
 *      local secure store, always wins.
 *   2. Otherwise the device's language preferences are negotiated; any Spanish
 *      variant — `es`, `es-419`, `es-MX`, `es_CO` — resolves to `es`.
 *   3. Otherwise English.
 *
 * Detection is intentionally NOT persisted: only an explicit choice writes
 * storage. That keeps "explicit choice wins" meaningful — someone who later
 * changes their phone's language is not pinned to a locale they never picked.
 */

export const LOCALES = ['en', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Secure-store key holding an explicit choice.
 *
 * Deliberately the same string the web client writes to its cookie and
 * `localStorage`, so the two platforms describe the same preference even
 * though they never share a store.
 */
export const LOCALE_STORAGE_KEY = 'flowy.locale';

/** BCP-47 tags handed to `Intl.*`. */
export const LOCALE_BCP47: Record<Locale, string> = {
  en: 'en',
  es: 'es',
};

/** Native language names, shown in the selector in their own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Map an arbitrary BCP-47 tag onto a supported locale.
 *
 * Regional Spanish collapses onto `es` (`es-419` → `es`, `es_MX` → `es`), which
 * is the whole point: we ship one Spanish, not per-region variants. Returns
 * `null` — not the default — for unsupported tags so callers can keep walking a
 * preference list instead of stopping at the first unknown entry.
 */
export function normalizeLocale(tag: unknown): Locale | null {
  if (typeof tag !== 'string') return null;
  const trimmed = tag.trim();
  if (!trimmed) return null;
  // `es_MX` (POSIX style, what Android's localeIdentifier reports) and `es-MX`
  // both reduce to the primary subtag.
  const primary = trimmed.toLowerCase().replace(/_/g, '-').split('-')[0];
  return isLocale(primary) ? primary : null;
}

/**
 * Pick the best supported locale from an ordered preference list.
 * `*` (wildcard) is ignored — it expresses "anything", which the default covers.
 */
export function matchLocale(preferences: readonly string[]): Locale | null {
  for (const tag of preferences) {
    if (tag === '*') continue;
    const locale = normalizeLocale(tag);
    if (locale) return locale;
  }
  return null;
}

export interface ResolveLocaleInput {
  /** Explicit, persisted choice read back from secure storage. Highest priority. */
  stored?: string | null;
  /** Device language preferences, already ordered most-preferred first. */
  preferences?: readonly string[] | null;
}

/**
 * The single locale decision used by every surface. Keeping one function means
 * the provider, the selector and the tests can never disagree about priority.
 */
export function resolveLocale(input: ResolveLocaleInput): Locale {
  const explicit = normalizeLocale(input.stored);
  if (explicit) return explicit;

  const detected = input.preferences ? matchLocale(input.preferences) : null;
  if (detected) return detected;

  return DEFAULT_LOCALE;
}
