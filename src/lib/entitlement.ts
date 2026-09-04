// Pure entitlement predicates. Deliberately free of react-native imports so
// the purchase-race logic can be unit tested.

import type { BillingInterval, PlanId, SubscriptionView } from '@/types';

export type RefreshTarget = {
  /** Stop once the server reports any entitled plan. Use for restore. */
  waitForPaid?: boolean;
  /**
   * Stop only once the server reports THIS plan. Use after a purchase.
   *
   * `waitForPaid` alone is wrong for an upgrade or downgrade: an existing
   * subscriber is already `isPaid`, so the first read returns the OLD plan and
   * the UI would declare success before the new transaction was ever applied.
   */
  expectedPlan?: PlanId;
  /** Same trap as `expectedPlan` for a monthly <-> yearly switch. */
  expectedInterval?: BillingInterval;
};

/** Has the server landed on what the caller was waiting for? */
export function satisfiesTarget(view: SubscriptionView, target: RefreshTarget): boolean {
  if (target.expectedPlan && view.plan !== target.expectedPlan) return false;
  if (target.expectedInterval && view.billingInterval !== target.expectedInterval) return false;
  if ((target.expectedPlan || target.waitForPaid) && !view.isPaid) return false;
  return true;
}

/** True when the target asks the caller to keep polling rather than read once. */
export function shouldPoll(target: RefreshTarget): boolean {
  return Boolean(target.waitForPaid || target.expectedPlan);
}

/**
 * May a poll that outlived its screen still write to the cache?
 *
 * The post-purchase poll runs for up to ~10s, during which the user can close
 * the paywall and sign out. Writing the result afterwards would repopulate the
 * cache — after `queryClient.clear()` — with the previous account's paid plan,
 * which the next account would then be shown. Only the identity that started
 * the poll may commit its result.
 */
export function mayCommit(purchaserId: string | null, currentId: string | null): boolean {
  return purchaserId !== null && purchaserId === currentId;
}
