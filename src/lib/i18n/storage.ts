/**
 * Persistence for an explicit language choice.
 *
 * Uses the app's existing `localSecureStore` adapter rather than talking to
 * `expo-secure-store` directly, and deliberately the *local* one, not the
 * shared-keychain one: the interface language is a per-device UI preference,
 * not session state the iOS share extension needs to read.
 *
 * Both functions swallow their errors. A device that cannot reach the keychain
 * (Expo Go without the entitlement, a locked keychain during boot) must still
 * start the app in a sensible language — losing the preference is acceptable,
 * blocking startup is not.
 */

import { localSecureStore } from '@/lib/secureStore';

import { isLocale, LOCALE_STORAGE_KEY, type Locale } from './locale';

/** Reads the persisted choice. Returns `null` when absent, invalid or unreadable. */
export async function readStoredLocale(): Promise<Locale | null> {
  try {
    const value = await localSecureStore.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** Persists an explicit choice. Resolves even when the write fails. */
export async function writeStoredLocale(locale: Locale): Promise<void> {
  try {
    await localSecureStore.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The in-memory choice still applies for this session.
  }
}

/**
 * Drops the explicit choice so the device language applies again.
 *
 * This is what makes "Automatic" mean anything after a restart: without the
 * delete, the next launch would read the previous explicit locale back and
 * quietly re-pin the user to a language they had just stopped choosing.
 */
export async function clearStoredLocale(): Promise<void> {
  try {
    await localSecureStore.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // Nothing to recover: the session already follows the device language.
  }
}
