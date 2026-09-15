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


/** Owned chat sources, independent of the visible inbox page and browsing filters. */
export async function loadChatSources(userId: string, ids: string[], signal?: AbortSignal): Promise<import('../types').Item[]> {
  if (!pb.authStore.isValid || pb.authStore.model?.id !== userId) throw new Error('Sign in again to see your saves.');
  const token = pb.authStore.token;
  const unique = [...new Set(ids)];
  const items: import('../types').Item[] = [];
  for (let offset = 0; offset < unique.length; offset += 50) {
    if (signal?.aborted) throw new Error('Request cancelled');
    const batch = unique.slice(offset, offset + 50);
    const membership = batch.map(id => pb.filter('id = {:id}', { id })).join(' || ');
    const result = await pb.collection('items').getList<import('../types').Item>(1, batch.length, {
      filter: `${pb.filter('user = {:userId}', { userId })} && (${membership})`, requestKey: null, signal,
    });
    items.push(...result.items);
  }
  if (signal?.aborted || pb.authStore.model?.id !== userId || pb.authStore.token !== token) throw new Error('Session changed');
  const byId = new Map(items.filter(item => item.user === userId).map(item => [item.id, item]));
  return unique.map(id => byId.get(id)).filter((item): item is import('../types').Item => Boolean(item));
}
