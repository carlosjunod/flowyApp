/**
 * Locale-aware formatting helpers.
 *
 * Native-owned copy of `apps/web/lib/i18n/format.ts`, extended with the two
 * coarser buckets (`w` / `mo` / `y`) the native `relativeDate` has always had.
 * The thresholds below reproduce `src/lib/relativeDate.ts` exactly, so
 * switching locale changes the words and never the cut-offs.
 *
 * Every function takes the locale explicitly rather than reading ambient
 * state: that keeps them pure, testable from plain node, and impossible to
 * call with a stale locale after a language switch. `Intl` formatters are
 * memoised per (locale, options) because constructing one is comparatively
 * expensive and an inbox list formats hundreds of dates per render.
 */

import type { TranslateFn } from './translate';
import { DEFAULT_LOCALE, type Locale } from './locale';

const dateCache = new Map<string, Intl.DateTimeFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();

function dateFormatter(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = dateCache.get(key);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, options);
  } catch {
    formatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, options);
  }
  dateCache.set(key, formatter);
  return formatter;
}

function numberFormatter(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = numberCache.get(key);
  if (cached) return cached;
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(locale, options);
  } catch {
    formatter = new Intl.NumberFormat(DEFAULT_LOCALE, options);
  }
  numberCache.set(key, formatter);
  return formatter;
}

/** Accepts ISO strings, PocketBase's `YYYY-MM-DD HH:mm:ss` and Date/number. */
export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.valueOf()) ? null : fromNumber;
  }
  // PocketBase serialises timestamps with a space separator, which some JS
  // engines reject; normalising to ISO keeps every platform in agreement.
  const normalized = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function formatDate(
  value: string | number | Date | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  const date = toDate(value);
  if (!date) return '';
  return dateFormatter(locale, options).format(date);
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
): string {
  return formatDate(value, locale, options);
}

export function formatTime(
  value: string | number | Date | null | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  return formatDate(value, locale, options);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return '';
  return numberFormatter(locale, options).format(value);
}

/**
 * The only keys `formatRelativeDate` reads.
 *
 * Declaring the exact subset — rather than `TranslateFn<string>` — is what lets
 * a strongly typed `TranslateFn<TranslationKey>` be passed in. Function
 * parameters are contravariant: a translator that accepts *every* key is a
 * valid substitute for one that accepts only these, but not the reverse.
 */
export type RelativeTimeKey =
  | 'common.time.justNow'
  | 'common.time.minutesAgo'
  | 'common.time.hoursAgo'
  | 'common.time.daysAgo'
  | 'common.time.weeksAgo'
  | 'common.time.monthsAgo'
  | 'common.time.yearsAgo';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Compact relative time, translated through the dictionary.
 *
 * Mirrors `src/lib/relativeDate.ts` thresholds exactly. An empty string is
 * returned for an unparsable input, matching the previous behaviour that
 * several list rows depend on.
 */
export function formatRelativeDate(
  value: string | number | Date | null | undefined,
  locale: Locale,
  t: TranslateFn<RelativeTimeKey>,
  now: number = Date.now(),
): string {
  const date = toDate(value);
  if (!date) return '';
  const diff = Math.max(0, now - date.getTime());
  if (diff < MINUTE) return t('common.time.justNow');
  if (diff < HOUR) return t('common.time.minutesAgo', { count: Math.floor(diff / MINUTE) });
  if (diff < DAY) return t('common.time.hoursAgo', { count: Math.floor(diff / HOUR) });
  if (diff < WEEK) return t('common.time.daysAgo', { count: Math.floor(diff / DAY) });
  if (diff < MONTH) return t('common.time.weeksAgo', { count: Math.floor(diff / WEEK) });
  if (diff < YEAR) return t('common.time.monthsAgo', { count: Math.floor(diff / MONTH) });
  return t('common.time.yearsAgo', { count: Math.floor(diff / YEAR) });
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Byte sizes with locale-aware decimal separators ("1,2 MB" in Spanish). */
export function formatBytes(bytes: number, locale: Locale): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  return `${formatNumber(value, locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${BYTE_UNITS[unit] ?? 'B'}`;
}
