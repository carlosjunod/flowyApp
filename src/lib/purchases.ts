// RevenueCat wrapper. Two rules this file exists to enforce:
//
// 1. `app_user_id` is ALWAYS the PocketBase user id. It is the join key the
//    server webhook uses to find the user; a purchase made under an anonymous
//    `$RCAnonymousID:` grants nobody, and no later fix recovers it.
// 2. This module never decides entitlement. It completes a purchase; the
//    server's GET /api/billing/subscription is the only source of truth for
//    what the user may do.
//
// Every export is a no-op when the SDK is not configured (no key, or a
// platform without StoreKit), so callers never need to branch on it.

import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { ENV } from './env';
import { createSerialQueue } from './serialQueue';

/** StoreKit only. Android would need its own RevenueCat key and products. */
const SUPPORTED = Platform.OS === 'ios';

let configurePromise: Promise<boolean> | null = null;
let configured = false;

export function isPurchasesConfigured(): boolean {
  return configured;
}

/**
 * Idempotent, and safe to call from several places at once — concurrent
 * callers await the same configure. Resolves false when purchases are
 * unavailable, which is the normal state in a build without the key.
 */
export function initPurchases(): Promise<boolean> {
  if (configurePromise) return configurePromise;
  if (!SUPPORTED || !ENV.REVENUECAT_IOS_KEY) {
    configurePromise = Promise.resolve(false);
    return configurePromise;
  }
  configurePromise = (async () => {
    try {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey: ENV.REVENUECAT_IOS_KEY });
      configured = true;
      return true;
    } catch (err) {
      // A misconfigured key must not take the app down on launch; the paywall
      // degrades to "unavailable" and everything else keeps working.
      console.warn('[purchases] configure failed:', err);
      return false;
    }
  })();
  return configurePromise;
}

/**
 * Every operation that reads or changes the RevenueCat identity — and every
 * operation that spends money under it — runs through one queue.
 *
 * Verifying the app user id and then calling StoreKit as two separate awaits
 * is not enough: a logIn or logOut started by the auth effect can land in
 * between, so the gate passes for user A and Apple charges user B. Holding the
 * check and the charge in a single queued section is what closes that window.
 */
const identityQueue = createSerialQueue();

/** The id currently bound in RevenueCat, as far as this module knows. */
let boundUserId: string | null = null;

/** Thrown when a purchase or restore could not be proven to belong to the user. */
export class PurchaserIdentityError extends Error {
  constructor() {
    super('RevenueCat identity does not match the signed-in user');
    this.name = 'PurchaserIdentityError';
  }
}

/**
 * Bind and verify. MUST be called only from inside the queue — it performs the
 * check that the caller's very next line depends on staying true.
 */
async function bindLocked(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (!(await initPurchases())) return false;

  if (boundUserId !== userId) {
    try {
      await Purchases.logIn(userId);
      boundUserId = userId;
    } catch (err) {
      console.warn('[purchases] logIn failed:', err);
      if (boundUserId === userId) boundUserId = null;
      return false;
    }
  }

  // Ask the SDK rather than trusting this module's bookkeeping.
  try {
    return (await Purchases.getAppUserID()) === userId;
  } catch (err) {
    console.warn('[purchases] app user id check failed:', err);
    return false;
  }
}

/**
 * Bind the RevenueCat identity to the PocketBase user. Fired from the auth
 * effect and deliberately not awaited there; the queue is what makes that safe.
 */
export function identifyPurchaser(userId: string): Promise<boolean> {
  if (!userId) return Promise.resolve(false);
  return identityQueue(() => bindLocked(userId));
}

export function forgetPurchaser(): Promise<void> {
  return identityQueue(async () => {
    boundUserId = null;
    if (!configured) return;
    try {
      await Purchases.logOut();
    } catch (err) {
      // logOut throws when the current user is already anonymous. Harmless.
      console.warn('[purchases] logOut failed:', err);
    }
  });
}

/**
 * Buy, fail-closed, with the identity check and the charge in one section.
 *
 * Throws `PurchaserIdentityError` when the buyer could not be proven to be
 * `userId` — a purchase completed under an anonymous `$RCAnonymousID:` is
 * charged by Apple and grants nobody, and nothing downstream can repair it.
 */
export function purchaseAs(userId: string, pkg: PurchasesPackage): Promise<CustomerInfo> {
  return identityQueue(async () => {
    if (!(await bindLocked(userId))) throw new PurchaserIdentityError();
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  });
}

/** Same gate as a purchase: restoring under the wrong identity would attach
 * someone else's entitlement to this account. */
export function restoreAs(userId: string): Promise<CustomerInfo> {
  return identityQueue(async () => {
    if (!(await bindLocked(userId))) throw new PurchaserIdentityError();
    return Purchases.restorePurchases();
  });
}

/** Empty when purchases are unavailable or the offering has no packages. */
export async function getOfferingPackages(): Promise<PurchasesPackage[]> {
  if (!(await initPurchases())) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/** True when the user dismissed the App Store sheet — not an error to report. */
export function isUserCancelled(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { userCancelled?: boolean }).userCancelled === true
  );
}
