import { describe, expect, it } from 'vitest';

import { mayCommit, satisfiesTarget, shouldPoll } from '../src/lib/entitlement';
import type { PlanId, SubscriptionView } from '../src/types';

const view = (over: Partial<SubscriptionView> = {}): SubscriptionView => ({
  plan: 'free',
  status: 'none',
  billingInterval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  trialEnd: null,
  hasBillingAccount: false,
  isPaid: false,
  trialEligible: true,
  limits: {
    savesPerMonth: 50,
    aiActionsPerMonth: 10,
    deepDivesPerMonth: 0,
    dailyDigest: false,
    emailIn: false,
    priorityProcessing: false,
    chatHistoryDays: 7,
  },
  ...over,
});

const paid = (plan: PlanId, billingInterval: 'month' | 'year'): SubscriptionView =>
  view({ plan, billingInterval, isPaid: true, status: 'active' });

describe('satisfiesTarget — the upgrade race', () => {
  it('does NOT accept the old plan when a different one was just purchased', () => {
    // The exact bug this predicate exists to prevent: a Plus subscriber buys
    // Pro. The webhook has not landed, so the first read still says Plus and
    // isPaid is already true. Treating that as success would close the paywall
    // on a purchase that had not been applied.
    const stillOldPlan = paid('plus', 'month');
    expect(satisfiesTarget(stillOldPlan, { waitForPaid: true })).toBe(true);
    expect(satisfiesTarget(stillOldPlan, { expectedPlan: 'pro' })).toBe(false);
  });

  it('accepts once the server reports the purchased plan', () => {
    expect(satisfiesTarget(paid('pro', 'month'), { expectedPlan: 'pro' })).toBe(true);
  });

  it('does NOT accept the old interval on a monthly to yearly switch', () => {
    const monthly = paid('plus', 'month');
    const target = { expectedPlan: 'plus' as const, expectedInterval: 'year' as const };
    expect(satisfiesTarget(monthly, target)).toBe(false);
    expect(satisfiesTarget(paid('plus', 'year'), target)).toBe(true);
  });

  it('never accepts an unpaid view for a purchase', () => {
    // A server that names the plan but has not marked it paid is mid-write.
    const naming = view({ plan: 'pro', billingInterval: 'month', isPaid: false });
    expect(satisfiesTarget(naming, { expectedPlan: 'pro' })).toBe(false);
  });
});

describe('satisfiesTarget — restore', () => {
  it('accepts any entitled plan, because restore does not know what it will find', () => {
    expect(satisfiesTarget(paid('starter', 'year'), { waitForPaid: true })).toBe(true);
    expect(satisfiesTarget(view(), { waitForPaid: true })).toBe(false);
  });
});

describe('satisfiesTarget — plain read', () => {
  it('accepts anything when nothing is being waited for', () => {
    expect(satisfiesTarget(view(), {})).toBe(true);
  });
});

describe('shouldPoll', () => {
  it('polls for a purchase or a restore, reads once otherwise', () => {
    expect(shouldPoll({ expectedPlan: 'pro' })).toBe(true);
    expect(shouldPoll({ waitForPaid: true })).toBe(true);
    expect(shouldPoll({})).toBe(false);
    // An interval on its own never triggers polling — it only narrows a plan.
    expect(shouldPoll({ expectedInterval: 'year' })).toBe(false);
  });
});

describe('mayCommit — a poll that outlived its screen', () => {
  it('refuses to write back after the user signed out', () => {
    // The bug this exists to stop: the post-purchase poll runs for ~10s, the
    // user closes the paywall and signs out, and the callback then repopulates
    // the cache — after queryClient.clear() — with the old paid plan.
    expect(mayCommit('user_a', null)).toBe(false);
  });

  it('refuses to write one account result into another account', () => {
    expect(mayCommit('user_a', 'user_b')).toBe(false);
  });

  it('commits when the session is still the one that started the poll', () => {
    expect(mayCommit('user_a', 'user_a')).toBe(true);
  });

  it('never commits a poll that began with no session', () => {
    expect(mayCommit(null, null)).toBe(false);
    expect(mayCommit(null, 'user_a')).toBe(false);
  });
});
