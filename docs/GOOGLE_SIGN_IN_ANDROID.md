# Google Sign-In on Android

Android login/signup uses `src/components/auth/GoogleSignIn.tsx`, the same
session and explicit new-account consent flow as iOS. Metro selects
`src/lib/googleSignIn.android.ts`. The adapter checks Google Play services,
opens account selection, obtains an ID token for the existing Web audience,
and clears its SDK session before and after the attempt. Cancellation is silent;
missing services, connection failures and signing/configuration errors have
recoverable messages. Tokens remain in memory until the existing
`/api/auth/google` exchange installs the Flowy session.

## Configuration

- Google Cloud project: `flowy-494202`.
- Android package: `app.tryflowy.client`.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` must equal server `GOOGLE_CLIENT_ID`.
  The existing value is already present in EAS development/preview/production.
- No Android client ID environment variable, client secret, Firebase Auth,
  extra Google API scope or offline Google access is required.
- Google OAuth Android clients identify a package and a signing certificate.
  EAS currently uses SHA-1
  `6D:A8:1E:2C:90:3C:E2:BA:5D:9B:2E:3F:1F:FE:09:34:E9:BD:FD:85`.
  Inspect `eas credentials --platform android` when changing signing credentials.
- Google Play can re-sign uploaded bundles. Before testing a Play-delivered app,
  register its **Play app-signing** SHA-1 from Play Console as a separate Android
  OAuth client if it differs from EAS. An upload-key client alone is insufficient.
- Local debug builds likewise need their own certificate registered. A local
  debug APK is not covered by the EAS certificate.
- `GOOGLE_SERVICES_JSON` is the existing EAS file variable for Android push;
  Google login configures its Web audience explicitly and adds no Firebase Auth.

The installed native Google SDK autolinks on Android. The existing conditional
Google config plugin sets the iOS callback only. A fresh native Android build
is required; Expo Go or an OTA update to a binary without the SDK cannot enable it.
For an installable EAS APK, run `eas build --platform android --profile preview`
from this repository. Production produces the store bundle.

## Validation

`npm run test:google-auth` runs 20 synthetic regression scenarios across both
native adapters and the shared component: existing sessions, explicit consent,
declined consent, provider cancellation, duplicate taps, leaving the screen,
expired-token retries, missing config/token and Android Play Services failures.
`npm run typecheck` passes. These checks do not prove a live Google exchange.

Before release, use an EAS-signed APK on a Google Play-enabled Android device:

1. Existing Google account reaches inbox; restart preserves the session.
2. New Google account can decline consent without creation, then accept and
   reach the empty inbox/chat flow.
3. Cancel account selection, retry after loss of connection, sign out and choose
   a different account. No stale consent or previous SDK session should persist.
4. Verify verified-email linking and conflicting-email recovery via the existing
   server policy, and verify Android sharing after login/restart.
5. Repeat login with a Play-delivered build after registering its signing SHA-1.

References:
- https://react-native-google-signin.github.io/docs/setting-up/android
- https://react-native-google-signin.github.io/docs/setting-up/expo
- https://react-native-google-signin.github.io/docs/original

## Validation checkpoint — 2026-09-11

- TypeScript and all 20 native Google regression scenarios pass.
- Server Google verification/linking suites: 23 tests pass.
- Clean isolated Android prebuild passes. Generated autolinking includes
  `RNGoogleSigninPackage` and `RNGoogleSignInCGen`.
- Android Hermes export passes and includes the Android Play Services adapter
  plus the real shared Web OAuth audience.
- Full clean Android `:app:assembleDebug` (arm64-v8a, JDK 17) passes: 560 tasks.
  This local validation APK uses a debug certificate, not the EAS signing key.
- No connected Android device was available for a live Google account exchange.
- Google Cloud client `Flowy Android EAS` was created and verified after user
  confirmation, with the EAS SHA-1 above. Public client ID:
  `656973880972-iihpgaq5f6jdaammm19bqp182nt9of9p.apps.googleusercontent.com`.
  This ID identifies the Android package/signature in Google Cloud; the SDK
  continues to use the existing Web client ID as its server audience.
