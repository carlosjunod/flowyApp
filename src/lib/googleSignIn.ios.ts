import { ENV } from './env';
import type { GoogleIdentity } from './googleSignIn';

let configured = false;

export async function requestGoogleIdentity(): Promise<GoogleIdentity | null> {
  if (!ENV.GOOGLE_IOS_CLIENT_ID || !ENV.GOOGLE_WEB_CLIENT_ID) {
    throw new Error('GOOGLE_NOT_CONFIGURED');
  }
  // Load on interaction so older development clients still open the login screen.
  const { GoogleSignin, statusCodes, isErrorWithCode } = await import('@react-native-google-signin/google-signin');
  if (!configured) {
    GoogleSignin.configure({
      iosClientId: ENV.GOOGLE_IOS_CLIENT_ID,
      webClientId: ENV.GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
    configured = true;
  }
  try {
    // Do not silently reuse the last Google account after Flowy signs out.
    // This only clears the SDK session; it does not revoke the Google grant.
    await GoogleSignin.signOut();
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;
    if (!response.data.idToken) throw new Error('GOOGLE_TOKEN_MISSING');
    return { idToken: response.data.idToken, email: response.data.user.email };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw error;
  } finally {
    // Flowy only needs the ID token for its own session; release SDK credentials.
    await GoogleSignin.signOut().catch(() => {});
  }
}
