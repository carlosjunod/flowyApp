import type { ApiResult, AuthSession } from '@/types';
import type { GoogleIdentity } from './googleSignIn';

export type GoogleAuthOutcome =
  | { type: 'cancelled' }
  | { type: 'consent'; identity: GoogleIdentity }
  | { type: 'session'; session: AuthSession }
  | { type: 'error'; message: string };

type Exchange = (idToken: string, email?: string, consent?: boolean) => Promise<ApiResult<AuthSession>>;

export function googleAuthMessage(error: unknown): string {
  const code = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  switch (code) {
    case 'GOOGLE_NOT_CONFIGURED':
      return 'Google sign-in is unavailable in this build. Please use email or Apple.';
    case 'NETWORK_ERROR':
      return 'Couldn’t connect. Check your connection and try Google again.';
    case 'EMAIL_IN_USE':
      return 'This email already has an account. Sign in with your password or reset it first.';
    case 'INVALID_GOOGLE_TOKEN':
    case 'INVALID_TOKEN':
    case 'GOOGLE_TOKEN_MISSING':
      return 'Google sign-in expired. Please choose your Google account again.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a moment and try again.';
    default:
      return 'Couldn’t sign in with Google. Please try again or use email or Apple.';
  }
}

/** Only the server decides whether consent is needed; token stays in memory. */
export async function exchangeGoogleIdentity(
  identity: GoogleIdentity,
  exchange: Exchange,
  consent = false,
): Promise<GoogleAuthOutcome> {
  try {
    const result = await exchange(identity.idToken, identity.email, consent);
    if (result.error) {
      if (result.error.code === 'AI_PROCESSING_CONSENT_REQUIRED') return { type: 'consent', identity };
      return { type: 'error', message: googleAuthMessage(result.error.code) };
    }
    const { token, userId, email } = result.data;
    if (!token || !userId || !email) return { type: 'error', message: googleAuthMessage('INVALID_SESSION') };
    return { type: 'session', session: result.data };
  } catch (error) {
    return { type: 'error', message: googleAuthMessage(error) };
  }
}
