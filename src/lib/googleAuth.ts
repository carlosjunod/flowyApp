import type { ApiResult, AuthSession } from '@/types';
import type { GoogleIdentity } from './googleSignIn';

export type GoogleAuthOutcome<Identity = GoogleIdentity> =
  | { type: 'cancelled' }
  | { type: 'consent'; identity: Identity }
  | { type: 'session'; session: AuthSession }
  | { type: 'error'; messageKey: string };

type Exchange = (idToken: string, email?: string, consent?: boolean) => Promise<ApiResult<AuthSession>>;

/**
 * Maps a provider/server error *code* to a translation key.
 *
 * Every key takes a `{provider}` variable so one function serves both Apple and
 * Google. The caller supplies the brand name; previously the component rewrote
 * the rendered English with `replaceAll('Google', provider)`, which only worked
 * while every message happened to mention the brand exactly once.
 */
export function socialAuthErrorKey(error: unknown): string {
  const code = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  switch (code) {
    case 'GOOGLE_NOT_CONFIGURED':
      return 'auth.social.errors.notConfigured';
    case 'GOOGLE_PLAY_SERVICES_UNAVAILABLE':
      return 'auth.social.errors.playServices';
    case 'NETWORK_ERROR':
      return 'auth.social.errors.network';
    case 'EMAIL_IN_USE':
      return 'auth.social.errors.emailInUse';
    case 'INVALID_APPLE_TOKEN':
    case 'INVALID_GOOGLE_TOKEN':
    case 'INVALID_TOKEN':
    case 'GOOGLE_TOKEN_MISSING':
      return 'auth.social.errors.expiredToken';
    case 'RATE_LIMITED':
      return 'auth.social.errors.rateLimited';
    default:
      return 'auth.social.errors.unknown';
  }
}

/** Only the server decides whether consent is needed; token stays in memory. */
export async function exchangeGoogleIdentity<Identity extends { idToken: string; email?: string }>(
  identity: Identity,
  exchange: Exchange,
  consent = false,
): Promise<GoogleAuthOutcome<Identity>> {
  try {
    const result = await exchange(identity.idToken, identity.email, consent);
    if (result.error) {
      if (result.error.code === 'AI_PROCESSING_CONSENT_REQUIRED') return { type: 'consent', identity };
      return { type: 'error', messageKey: socialAuthErrorKey(result.error.code) };
    }
    const { token, userId, email } = result.data;
    if (!token || !userId || !email) return { type: 'error', messageKey: socialAuthErrorKey('INVALID_SESSION') };
    return { type: 'session', session: result.data };
  } catch (error) {
    return { type: 'error', messageKey: socialAuthErrorKey(error) };
  }
}
