/**
 * Public entry point for the native i18n layer.
 *
 * Components import from `@/lib/i18n` and nothing else; the individual modules
 * are internal. Keeping one entry point is what lets the node test scripts mock
 * the whole layer with a single loader entry.
 */

export {
  LocaleProvider,
  detectDeviceLocale,
  useI18n,
  useTranslate,
  type I18nContextValue,
} from './LocaleProvider';
export { deviceLanguageTags } from './device';
export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_BCP47,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  isLocale,
  matchLocale,
  normalizeLocale,
  resolveLocale,
  type Locale,
} from './locale';
export { clearStoredLocale, readStoredLocale, writeStoredLocale } from './storage';
export {
  createTranslate,
  interpolate,
  selectPluralForm,
  type TranslateFn,
} from './translate';
export {
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeDate,
  formatTime,
  toDate,
} from './format';
export { collectKeys, lookup, type TranslationVars } from './dictionary';
export { dictionaries, typedDictionaries, type TranslationKey } from './dictionaries';
