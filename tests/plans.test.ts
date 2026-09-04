import { describe, expect, it } from 'vitest';

import {
  PAYWALL_PLANS,
  planFromProductId,
  productId,
  type PaidPlanId,
  type PaywallPlan,
} from '../src/lib/plans';

// `noUncheckedIndexedAccess` makes every index lookup `| undefined`, so reach
// for a plan through a helper that fails loudly instead of casting.
const plan = (id: PaidPlanId): PaywallPlan => {
  const found = PAYWALL_PLANS.find((p) => p.id === id);
  if (!found) throw new Error(`PAYWALL_PLANS is missing the "${id}" plan`);
  return found;
};

describe('productId', () => {
  it('builds the exact ids the server webhook parses', () => {
    expect(productId('plus', 'month')).toBe('flowy_plus_month');
    expect(productId('pro', 'year')).toBe('flowy_pro_year');
    expect(productId('starter', 'month')).toBe('flowy_starter_month');
  });
});

describe('planFromProductId', () => {
  it('round-trips every paywall plan and interval', () => {
    for (const p of PAYWALL_PLANS) {
      for (const interval of ['month', 'year'] as const) {
        expect(planFromProductId(productId(p.id, interval))).toBe(p.id);
      }
    }
  });

  it('returns null for anything unrecognised', () => {
    expect(planFromProductId('flowy_enterprise_month')).toBeNull();
    expect(planFromProductId('com.other.app.sub')).toBeNull();
    expect(planFromProductId('flowy_plus_week')).toBeNull();
    expect(planFromProductId('FLOWY_PLUS_MONTH')).toBeNull();
    expect(planFromProductId('')).toBeNull();
  });
});

describe('PAYWALL_PLANS', () => {
  it('prices match the App Store prices in the spec', () => {
    expect(plan('starter').priceMonth).toBe('$11.99');
    expect(plan('starter').priceYear).toBe('$119.99');
    expect(plan('plus').priceMonth).toBe('$19.99');
    expect(plan('plus').priceYear).toBe('$199.99');
    expect(plan('pro').priceMonth).toBe('$32.99');
    expect(plan('pro').priceYear).toBe('$329.99');
  });

  it('sells exactly the three plans the product-id regex accepts', () => {
    // A fourth plan added here without widening the regex in plans.ts (and its
    // twin in the Flowy web repo) would sell a product the webhook ignores.
    expect(PAYWALL_PLANS.map((p) => p.id)).toEqual(['starter', 'plus', 'pro']);
  });

  it('marks exactly one plan as most popular', () => {
    expect(PAYWALL_PLANS.filter((p) => p.badge === 'most_popular')).toHaveLength(1);
  });

  it('never mentions the web, a discount, or another purchase method', () => {
    // App Store Review Guideline 3.1.3: no steering to another purchase method.
    const text = JSON.stringify(PAYWALL_PLANS).toLowerCase();
    for (const banned of [
      'tryflowy.app',
      'web price',
      'on the web',
      'discount',
      '% off',
      'cheaper',
      'save 2',
      'browser',
    ]) {
      expect(text).not.toContain(banned);
    }
  });
});
