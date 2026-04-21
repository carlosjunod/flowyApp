import PocketBase, { AsyncAuthStore } from 'pocketbase';

import { ENV } from './env';
import { sharedSecureStore } from './secureStore';

const store = new AsyncAuthStore({
  save: (serialized) => sharedSecureStore.setItem(ENV.AUTH_KEY, serialized),
  initial: undefined,
  clear: () => sharedSecureStore.removeItem(ENV.AUTH_KEY),
});

export const pb = new PocketBase(ENV.PB_URL, store);

export const hydratePbAuth = async (): Promise<void> => {
  const raw = await sharedSecureStore.getItem(ENV.AUTH_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { token?: string; model?: unknown };
    if (typeof parsed.token === 'string' && parsed.model) {
      pb.authStore.save(parsed.token, parsed.model as Parameters<typeof pb.authStore.save>[1]);
    }
  } catch {
    await sharedSecureStore.removeItem(ENV.AUTH_KEY);
  }
};
