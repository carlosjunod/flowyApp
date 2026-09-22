import { dictionaries } from './i18n/dictionaries';
import { formatRelativeDate } from './i18n/format';
import { DEFAULT_LOCALE, type Locale } from './i18n/locale';
import { createTranslate } from './i18n/translate';

/**
 * Compact relative time, in a given locale.
 *
 * Kept as a standalone helper for call sites that are not React components (and
 * for the node test scripts), but the thresholds and the wording now live in
 * one place: `lib/i18n/format.formatRelativeDate` plus `common.time.*`.
 *
 * In a component prefer `useI18n().formatRelativeDate`, which already knows the
 * active locale.
 */
export const relativeDate = (
  input: string | Date,
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE,
): string =>
  formatRelativeDate(
    input,
    locale,
    createTranslate({
      locale,
      dictionary: dictionaries[locale],
      fallback: dictionaries[DEFAULT_LOCALE],
    }),
    now.getTime(),
  );
