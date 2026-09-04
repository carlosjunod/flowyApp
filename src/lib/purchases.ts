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

/** The id we last bound successfully, and the binding currently in flight. */
let boundUserId: string | null = null;
let identityPromise: Promise<boolean> | null = null;

/**
 * Bind the RevenueCat identity to the PocketBase user. Awaits configure first
 * so callers can fire this the moment a session appears.
 *
 * Callers that are about to move money must NOT rely on this having finished —
 * it is started from an effect and is not awaited there. Use
 * `ensurePurchaserBound` immediately before a purchase or restore.
 */
export function identifyPurchaser(userId: string): Promise<boolean> {
  if (!userId) return Promise.resolve(false);
  const pending = (async () => {
    if (!(await initPurchases())) return false;
    try {
      await Purchases.logIn(userId);
      boundUserId = userId;
      return true;
    } catch (err) {
      console.warn('[purchases] logIn failed:', err);
      if (boundUserId === userId) boundUserId = null;
      return false;
    }
  })();
  identityPromise = pending;
  return pending;
}

export async function forgetPurchaser(): Promise<void> {
  boundUserId = null;
  identityPromise = null;
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    // logOut throws when the current user is already anonymous. Harmless.
    console.warn('[purchases] logOut failed:', err);
  }
}

/**
 * Fail-closed gate to run immediately before any purchase or restore.
 *
 * `identifyPurchaser` is fired from an auth effect and is NOT awaited there, so
 * a user who reaches the paywall quickly — or who just switched accounts — can
 * otherwise transact while `logIn` is still in flight or after it failed. A
 * purchase completed under an anonymous `$RCAnonymousID:` is charged by Apple
 * and grants nobody, and nothing downstream can repair it.
 *
 * Waits for any binding in flight, rebinds if needed, then asks the SDK for the
 * app user id rather than trusting this module's own bookkeeping. Returns false
 * whenever it cannot prove the identity matches; callers must abort on false.
 */
export async function ensurePurchaserBound(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (!(await initPurchases())) return false;

  // Whatever the auth effect started, let it settle before judging the state.
  if (identityPromise) {
    try {
      await identityPromise;
    } catch {
      // Swallowed: the verification below is what decides, not this outcome.
    }
  }

  if (boundUserId !== userId && !(await identifyPurchaser(userId))) return false;

  try {
    return (await Purchases.getAppUserID()) === userId;
  } catch (err) {
    console.warn('[purchases] app user id check failed:', err);
    return false;
  }
}

/** Empty when purchases are unavailable or the offering has no packages. */
export async function getOfferingPackages(): Promise<PurchasesPackage[]> {
  if (!(await initPurchases())) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restore(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** True when the user dismissed the App Store sheet — not an error to report. */
export function isUserCancelled(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { userCancelled?: boolean }).userCancelled === true
  );
}
