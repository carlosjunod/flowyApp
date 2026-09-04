import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginTransaction,
  endTransaction,
  isTransactionInFlight,
  subscribeTransaction,
} from '../src/lib/billingCoordinator';

beforeEach(() => {
  endTransaction();
});

describe('billing transaction lock', () => {
  it('refuses a second transaction while one is running', () => {
    expect(beginTransaction()).toBe(true);
    // This is the paywall being closed and reopened mid-purchase: the new
    // screen must not be able to start a second StoreKit transaction.
    expect(beginTransaction()).toBe(false);
    expect(isTransactionInFlight()).toBe(true);
  });

  it('allows the next transaction once the first releases', () => {
    expect(beginTransaction()).toBe(true);
    endTransaction();
    expect(isTransactionInFlight()).toBe(false);
    expect(beginTransaction()).toBe(true);
  });

  it('survives a release it does not hold', () => {
    endTransaction();
    endTransaction();
    expect(isTransactionInFlight()).toBe(false);
  });

  it('notifies subscribers on both edges so a remounted paywall sees the lock', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTransaction(listener);
    beginTransaction();
    expect(listener).toHaveBeenCalledTimes(1);
    endTransaction();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    beginTransaction();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
