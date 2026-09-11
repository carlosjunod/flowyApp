/** Platform boundary: iOS supplies the native implementation. */
export interface GoogleIdentity {
  idToken: string;
  email: string;
}

export async function requestGoogleIdentity(): Promise<GoogleIdentity | null> {
  throw new Error('GOOGLE_PLATFORM_UNAVAILABLE');
}
