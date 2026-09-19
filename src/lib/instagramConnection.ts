import type { InstagramConnection } from '@/types/instagram';

export const INSTAGRAM_CHAT_URL = 'https://ig.me/m/tryflowy';
export function instagramHandle(connection?: InstagramConnection): string {
  const handle = connection?.handle;
  return typeof handle === 'string' && /^[a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?$/.test(handle) && !handle.includes('..') ? handle : 'tryflowy';
}
export function instagramChatUrl(connection?: InstagramConnection): string {
  return `https://ig.me/m/${instagramHandle(connection)}`;
}

/** Never put auth tokens or unvalidated server values into an external URL. */
export function instagramConnectionUrl(connection: InstagramConnection, now = Date.now()): string | null {
  if (!connection.enabled || !connection.referralEnabled || connection.connected ||
      !/^FLOWY-[A-F0-9]{32}$/.test(connection.code ?? '') ||
      !Number.isFinite(connection.expiresAt) || (connection.expiresAt ?? 0) <= now) return null;
  return `${instagramChatUrl(connection)}?ref=${encodeURIComponent(connection.code!)}`;
}

/** Translation key for a connection failure; the server code stays the contract. */
export function instagramConnectionErrorKey(code?: string): string {
  if (code === 'UNAUTHORIZED') return 'settings.instagram.errors.sessionChanged';
  if (code === 'AI_CONSENT_REQUIRED') return 'settings.instagram.errors.consentRequired';
  if (code === 'ALREADY_LINKED') return 'settings.instagram.errors.alreadyLinked';
  if (code === 'NETWORK_ERROR') return 'settings.instagram.errors.network';
  return 'settings.instagram.errors.updateFailed';
}
