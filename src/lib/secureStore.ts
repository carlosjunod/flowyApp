import * as SecureStore from 'expo-secure-store';

import { ENV } from './env';

const sharedOptions: SecureStore.SecureStoreOptions = {
  accessGroup: ENV.APP_GROUP,
  keychainService: ENV.APP_GROUP,
};

export const sharedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key, sharedOptions);
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, sharedOptions);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key, sharedOptions);
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
