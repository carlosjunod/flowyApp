import type { ChatSnapshot } from './chatModel';
import { localSecureStore } from './secureStore';

type Storage = typeof localSecureStore;
type Manifest = { generation: string; count: number };
const parseManifest = (raw: string | null): Manifest | null => {
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid chat storage');
  const m = value as Record<string, unknown>;
  if (typeof m.generation !== 'string' || !/^[a-z0-9-]+$/.test(m.generation) || typeof m.count !== 'number' || !Number.isSafeInteger(m.count) || m.count < 1 || m.count > 100000) throw new Error('Invalid chat storage');
  return { generation: m.generation, count: m.count };
};

/** Small chunks avoid native Keychain value limits. Publish manifest last. */
export function createChatStorage(storage: Storage = localSecureStore) {
  let queue = Promise.resolve();
  const deletedAccounts = new Set<string>();
  const base = (account: string) => `flowy.chat.${account.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  return {
    async read(account: string): Promise<unknown> {
      await queue;
      if (deletedAccounts.has(account)) return null;
      const key = base(account);
      const manifest = parseManifest(await storage.getItem(key));
      if (!manifest) return null;
      const chunks: string[] = [];
      for (let i = 0; i < manifest.count; i++) {
        const chunk = await storage.getItem(`${key}.${manifest.generation}.${i}`);
        if (chunk === null) throw new Error('Incomplete chat storage');
        chunks.push(chunk);
      }
      return JSON.parse(chunks.join('')) as unknown;
    },
    remove(account: string): Promise<void> {
      deletedAccounts.add(account); // queued writes and unmount cannot recreate deleted data
      const work = queue.then(async () => {
        const key = base(account);
        const manifest = parseManifest(await storage.getItem(key));
        if (manifest) for (let i = 0; i < manifest.count; i++) await storage.removeItem(`${key}.${manifest.generation}.${i}`);
        await storage.removeItem(key);
      });
      queue = work.catch(() => {});
      return work;
    },
    write(account: string, snapshot: ChatSnapshot): Promise<void> {
      const serialized = JSON.stringify(snapshot);
      const work = queue.then(async () => {
        if (deletedAccounts.has(account)) return;
        const key = base(account);
        const previous = parseManifest(await storage.getItem(key));
        const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        // At most 350 Unicode code points (1400 UTF-8 bytes); never split a surrogate pair.
        const characters = Array.from(serialized);
        const chunks: string[] = [];
        for (let i = 0; i < characters.length; i += 350) chunks.push(characters.slice(i, i + 350).join(''));
        if (!chunks.length) chunks.push('');
        let written = 0;
        try {
          for (let i = 0; i < chunks.length; i++) {
            await storage.setItem(`${key}.${generation}.${i}`, chunks[i]!);
            written++;
          }
          await storage.setItem(key, JSON.stringify({ generation, count: chunks.length }));
        } catch (error) {
          for (let i = 0; i < written; i++) await storage.removeItem(`${key}.${generation}.${i}`).catch(() => {});
          throw error;
        }
        if (previous) for (let i = 0; i < previous.count; i++) await storage.removeItem(`${key}.${previous.generation}.${i}`).catch(() => {});
      });
      queue = work.catch(() => {});
      return work;
    },
  };
}
export const chatStorage = createChatStorage();
