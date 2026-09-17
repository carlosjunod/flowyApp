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

export function instagramConnectionError(code?: string): string {
  if (code === 'UNAUTHORIZED') return 'Your session changed. Reopen this screen or sign in again.';
  if (code === 'AI_CONSENT_REQUIRED') return 'Accept AI processing in Flowy before connecting Instagram.';
  if (code === 'ALREADY_LINKED') return 'This account is already connected. Refresh its status.';
  if (code === 'NETWORK_ERROR') return 'Could not reach Flowy. Check your connection and try again.';
  return 'Could not update Instagram. Please try again.';
}
