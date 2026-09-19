/**
 * The translator: dictionary lookup + interpolation + plurals + fallback.
 *
 * Native-owned copy of `apps/web/lib/i18n/translate.ts`, with one change: the
 * development-only warning gate reads React Native's `__DEV__` global instead
 * of `process.env.NODE_ENV`, guarded by `typeof` so the plain-node test
 * scripts (where `__DEV__` does not exist) still run.
 *
 * Deliberately tiny and dependency-free. It is a pure function of
 * (locale, dictionaries) — no module-level mutable locale — so switching
 * language is a re-render, not a global mutation other components must observe.
 */

import {
  isPluralForms,
  lookup,
  type PluralForms,
  type TranslationLeaf,
  type TranslationTree,
  type TranslationVars,
} from './dictionary';
import { DEFAULT_LOCALE, type Locale } from './locale';

/** `{name}` / `{count}`. Braces are literal everywhere else. */
const PLACEHOLDER_RE = /\{(\w+)\}/g;

const warned = new Set<string>();

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

function warnOnce(message: string): void {
  if (!isDev()) return;
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[i18n] ${message}`);
}

/** Exposed only so tests can assert warning behaviour deterministically. */
export function __resetI18nWarnings(): void {
  warned.clear();
}

/**
 * Pick the plural form for `count`.
 *
 * An explicit `zero` wins at count 0 even though neither English nor Spanish
 * has a CLDR `zero` category — "Sin elementos" reads far better than
 * "0 elementos", and encoding that in the dictionary keeps it translatable.
 *
 * `Intl.PluralRules` is optional on Hermes, so its absence must not throw. The
 * `one`/`other` fallback below is not an approximation for the locales this app
 * ships: English and Spanish both select `one` exactly at n = 1.
 */
export function selectPluralForm(forms: PluralForms, count: number, locale: Locale): string {
  if (!Number.isFinite(count)) return forms.other;
  if (count === 0 && typeof forms.zero === 'string') return forms.zero;
  let category: Intl.LDMLPluralRule = count === 1 ? 'one' : 'other';
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
      category = new Intl.PluralRules(locale).select(count);
    }
  } catch {
    category = count === 1 ? 'one' : 'other';
  }
  return forms[category] ?? forms.other;
}

export function interpolate(
  template: string,
  vars: TranslationVars | undefined,
  locale: Locale,
): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER_RE, (match, name: string) => {
    const value = vars[name];
    if (typeof value === 'number') {
      // Locale-aware digits/grouping: 1,250 (en) vs 1.250 (es).
      try {
        return new Intl.NumberFormat(locale).format(value);
      } catch {
        return String(value);
      }
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return String(value);
    // Unknown/absent placeholder: keep it visible rather than rendering a gap.
    warnOnce(`missing interpolation value "${name}" in "${template}"`);
    return match;
  });
}

function render(leaf: TranslationLeaf, vars: TranslationVars | undefined, locale: Locale): string {
  if (isPluralForms(leaf)) {
    const count = typeof vars?.count === 'number' ? vars.count : Number.NaN;
    if (!Number.isFinite(count)) {
      warnOnce('plural key rendered without a numeric "count"');
    }
    return interpolate(selectPluralForm(leaf, count, locale), vars, locale);
  }
  return interpolate(leaf, vars, locale);
}

export interface TranslateOptions {
  locale: Locale;
  dictionary: TranslationTree;
  /** Fallback dictionary consulted when a key is missing from `dictionary`. */
  fallback?: TranslationTree;
  fallbackLocale?: Locale;
}

export type TranslateFn<K extends string = string> = (key: K, vars?: TranslationVars) => string;

/**
 * Build a translator bound to one locale.
 *
 * Fallback order: active locale → fallback locale (English) → the key itself.
 * Returning the key rather than an empty string means a missing translation
 * surfaces as visibly wrong text in QA instead of a blank region in the layout.
 */
export function createTranslate<K extends string = string>(
  options: TranslateOptions,
): TranslateFn<K> {
  const { locale, dictionary, fallback, fallbackLocale = DEFAULT_LOCALE } = options;

  return function translate(key: K, vars?: TranslationVars): string {
    const leaf = lookup(dictionary, key);
    if (leaf !== undefined) return render(leaf, vars, locale);

    if (fallback) {
      const fallbackLeaf = lookup(fallback, key);
      if (fallbackLeaf !== undefined) {
        warnOnce(`missing "${key}" for locale "${locale}" — using ${fallbackLocale}`);
        return render(fallbackLeaf, vars, fallbackLocale);
      }
    }

    warnOnce(`unknown translation key "${key}"`);
    return key;
  };
}
