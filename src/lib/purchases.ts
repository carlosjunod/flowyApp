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

/**
 * Bind the RevenueCat identity to the PocketBase user. Awaits configure first
 * so callers can fire this the moment a session appears.
 */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (!userId) return;
  if (!(await initPurchases())) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.warn('[purchases] logIn failed:', err);
  }
}

export async function forgetPurchaser(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    // logOut throws when the current user is already anonymous. Harmless.
    console.warn('[purchases] logOut failed:', err);
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
