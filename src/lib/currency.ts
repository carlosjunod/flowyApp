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

export function formatCurrency(
  amount: number,
  symbol: CurrencySymbol = getDefaultCurrencySymbol(),
): string {
  if (!Number.isFinite(amount)) return '';
  const safe = Math.round(amount);
  return `${symbol}${safe.toLocaleString('en-US')}`;
}
