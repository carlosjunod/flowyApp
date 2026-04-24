import * as SecureStore from 'expo-secure-store';

import { ENV } from './env';

const sharedOptions: SecureStore.SecureStoreOptions = {
  accessGroup: ENV.APP_GROUP,
  keychainService: ENV.APP_GROUP,
};

// The shared access group requires the `keychain-access-groups` entitlement,
// which is absent in Expo Go. Fall back to the default keychain so boot still
// completes and the error is visible once, instead of crashing `hydratePbAuth`.
const isEntitlementError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /entitlement/i.test(message);
};

let sharedKeychainAvailable = true;
const warnOnce = (() => {
  let warned = false;
  return (err: unknown) => {
    if (warned) return;
    warned = true;
    if (__DEV__) {
      console.warn(
        '[secureStore] Shared keychain access group unavailable — falling back to the default keychain. ' +
          'This is expected in Expo Go; use a development build for the share extension to read auth.',
        err,
      );
    }
  };
})();

export const sharedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    if (sharedKeychainAvailable) {
      try {
        return await SecureStore.getItemAsync(key, sharedOptions);
      } catch (err) {
        if (!isEntitlementError(err)) throw err;
        sharedKeychainAvailable = false;
        warnOnce(err);
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (sharedKeychainAvailable) {
      try {
        await SecureStore.setItemAsync(key, value, sharedOptions);
        return;
      } catch (err) {
        if (!isEntitlementError(err)) throw err;
        sharedKeychainAvailable = false;
        warnOnce(err);
      }
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (sharedKeychainAvailable) {
      try {
        await SecureStore.deleteItemAsync(key, sharedOptions);
        return;
      } catch (err) {
        if (!isEntitlementError(err)) throw err;
        sharedKeychainAvailable = false;
        warnOnce(err);
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const localSecureStore = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};
