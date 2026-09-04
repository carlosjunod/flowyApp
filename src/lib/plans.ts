// Paywall plan catalogue. Prices here are the APP STORE prices, which are
// higher than the web prices by design — Apple takes 15% (Small Business
// Program) and the markup absorbs it.
//
// This file must never mention the web price, a discount, or any other
// purchase method. App Store Review Guideline 3.1.3 forbids steering users
// away from in-app purchase outside the US storefront.

import type { BillingInterval, PaidPlanId, PlanId } from '@/types';

export type { BillingInterval, PaidPlanId, PlanId };

export interface PaywallPlan {
  id: PaidPlanId;
  name: string;
  tagline: string;
  /**
   * FALLBACK display strings for the moment before StoreKit offerings load.
   * The paywall renders `pkg.product.priceString` whenever it has one, because
   * that carries the viewer's currency and any App Store Connect price change.
   * These must stay in step with the prices configured in App Store Connect.
   */
  priceMonth: string;
  priceYear: string;
  highlights: string[];
  badge: 'most_popular' | null;
}

/**
 * Product ids follow `flowy_<plan>_<interval>`. The server webhook parses the
 * same shape with its own copy of this regex, so the two must change together
 * — see `planFromProductId` in the Flowy web repo. An id outside this shape is
 * ignored by the webhook and grants nothing.
 */
export function productId(plan: PaidPlanId, interval: BillingInterval): string {
  return `flowy_${plan}_${interval}`;
}

/** Inverse of `productId`. Returns null for anything this app did not sell. */
export function planFromProductId(id: string): PlanId | null {
  const m = /^flowy_(starter|plus|pro)_(month|year)$/.exec(id);
  const plan = m?.[1];
  return plan ? (plan as PlanId) : null;
}

export const PAYWALL_PLANS: readonly PaywallPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For a steady stream of links, reels and screenshots.',
    priceMonth: '$11.99',
    priceYear: '$119.99',
    highlights: [
      '200 saves / month',
      '60 AI actions / month',
      '3 deep dives / month',
      'Daily digest + email-in',
    ],
    badge: null,
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'Unlimited-feeling capture and a real research assistant.',
    priceMonth: '$19.99',
    priceYear: '$199.99',
    highlights: [
      '600 saves / month',
      '250 AI actions / month',
      '20 deep dives / month',
      'Priority processing',
      'Unlimited chat history',
    ],
    badge: 'most_popular',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Everything in Plus, with room to go deep every day.',
    priceMonth: '$32.99',
    priceYear: '$329.99',
    highlights: [
      'Everything in Plus',
      '1,000 saves / month',
      '400 AI actions / month',
      '30 deep dives / month',
      'Priority support + early access',
    ],
    badge: null,
  },
];
