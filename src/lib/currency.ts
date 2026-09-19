/**
 * Currency utilities for Flowy mobile — currency-agnostic.
 *
 * Mirrors the public API of `apps/web/utils/currency.ts` so call sites stay
 * identical across web and mobile. The web version uses dinero.js for
 * precision-safe math (allocations, splits) — mobile doesn't need those yet,
 * so this is a thin `Intl.NumberFormat` wrapper that keeps the bundle lean.
 *
 * Convention: every monetary value is an INTEGER representing whole units in
 * the user's chosen currency (no decimal subunits). 156915 → "$156,915".
 */

export enum CurrencySymbol {
  Dollar = '$',
  Euro = '€',
  Pound = '£',
  Yen = '¥',
}

const HARDCODED_DEFAULT = CurrencySymbol.Dollar;

export function getDefaultCurrencySymbol(): CurrencySymbol {
  return HARDCODED_DEFAULT;
}

/**
 * `locale` controls grouping only ("$156,915" vs "$156.915"); the symbol is the
 * account's, not the locale's, so it is never inferred from the language.
 */
export function formatCurrency(
  amount: number,
  locale = 'en',
  symbol: CurrencySymbol = getDefaultCurrencySymbol(),
): string {
  if (!Number.isFinite(amount)) return '';
  const safe = Math.round(amount);
  try {
    return `${symbol}${new Intl.NumberFormat(locale).format(safe)}`;
  } catch {
    return `${symbol}${safe.toLocaleString('en-US')}`;
  }
}
