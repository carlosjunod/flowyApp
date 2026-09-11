# Google Sign-In on iOS

The iOS login and signup screens use `src/components/auth/GoogleSignIn.tsx`.
The native boundary is `src/lib/googleSignIn.ios.ts`; the default
`src/lib/googleSignIn.ts` does not import native Google code on other platforms.
`src/lib/googleAuth.ts` exchanges the selected identity through the existing
`api.authGoogle` method and `/api/auth/google` server route. Server verification,
account linking, PocketBase session format and shared Keychain storage remain
unchanged. Android implementation is deferred.

## Google and Expo configuration

Use two **public OAuth client IDs from the same Google Cloud project**:

- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: client type iOS, bundle
  `app.tryflowy.client`, Apple Team ID `8C72ST495F`.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: the existing Web application client;
  it must match the server's `GOOGLE_CLIENT_ID`.

Store both in the local ignored `.env` and the relevant EAS environments
(development/preview/production). No Google client secret belongs in this app.
`src/lib/env.ts` accesses these variables literally for Expo build-time inlining.
`app.config.ts` derives the reversed iOS URL scheme from the iOS client ID and
passes it to the Google Sign-In config plugin, without Firebase Authentication.
Use the same values for prebuild and JS bundling. Changing the iOS ID requires
regenerating the native callback scheme and shipping another binary.

The Google SDK requests basic sign-in only. `webClientId` supplies the server
audience; offline access and extra Google API scopes are not requested. Before
a new interactive login, SDK `signOut` clears the prior Google selection. The SDK cache is also cleared best-effort after obtaining the ID token or cancelling. This
does not revoke access or sign the person out of their Google apps.

This native dependency needs a new iOS build; Expo Go and an OTA update to an
older binary are insufficient. Run a clean iOS prebuild in an isolated checkout
when an existing generated iOS directory contains local work.

## User flows

- Existing account: Google sheet → server verifies/links → existing shared
  `signInWithSession` → inbox.
- New account: first server call sends no consent; the server responds
  `AI_PROCESSING_CONSENT_REQUIRED` before creating the account. An unchecked
  disclosure names Anthropic, OpenAI and Voyage AI and links Privacy/Terms.
  Only explicit acceptance + Create account retries with consent `true`.
- Cancel Google: return to the form silently, without contacting the server.
- Cancel consent: drop the in-memory identity; no creation retry or session save.
- Failed/expired exchange: show friendly recovery text and drop the temporary
  identity so retry chooses Google again.
- Double taps do not start concurrent Google operations. Leaving the screen
  prevents late results from installing a session. Google identity tokens are
  never written to storage or logged by this flow.

Account deletion remains the existing Flowy deletion path. This integration
does not persist Google refresh/access tokens in Flowy storage and requests no background Google access.

## Validation

`npm run typecheck` and `npm run test:google-auth` cover the native SDK adapter,
server-audience configuration, cancellation, consent retry, malformed sessions,
errors, navigation, repeated taps and unmounted results using synthetic tokens.
The tests run the actual TypeScript adapter and component event handlers with
mocked native/HTTP boundaries. They do not prove a live Google OAuth exchange.

Before release, validate a fresh build with real OAuth IDs:

1. Existing Google account → inbox, chat, sign-out/relogin and app restart.
2. Previously unused Google account → decline consent (no account), then accept
   and confirm an empty inbox and usable chat.
3. Google email matching an existing verified email account → server linking;
   unverified/conflicting email → friendly error.
4. Cancel the Google sheet, cancel consent, retry after losing connectivity,
   and choose another Google account after signing out.
5. Share from Safari after Google login and after relaunch, confirming shared
   Keychain session access. Delete only a disposable account with explicit approval.

SDK setup references:
- https://react-native-google-signin.github.io/docs/setting-up/expo
- https://react-native-google-signin.github.io/docs/original

## Configured project — 2026-09-11

Google Cloud project `flowy-494202` now has `Flowy iOS` for the verified bundle
and team above, alongside the existing `flowywebapp` client. Both public IDs
are configured locally and in the project's EAS development, preview and
production environments. No existing OAuth client was replaced.

The Cloud console shows Testing with no test users. Google exempts basic
Sign in with Google (`openid`, email, profile) from the trusted-user-list
restriction; this implementation requests only that basic identity. See
https://support.google.com/cloud/answer/15549945?hl=en . Additional Google API
scopes would need a separate review of audience/consent requirements.

## Validation results — 2026-09-11

- Native TypeScript passes; all 11 `test:google-auth` scenarios pass.
- Server `google-auth.test.ts` and `auth-social-linking-routes.test.ts`: 23 pass.
- Clean isolated iOS prebuild and full unsigned simulator build pass with the
  new Google native dependency. A subsequent full simulator build with the real
  callback also passes; the built app uses `app.tryflowy.client` and the actual
  Google callback, without fixture schemes. Hermes output embeds both real IDs.
- The existing `test:ui-models` harness fails in unchanged chat code when its
  transpiler treats a generic in `src/lib/chatSync.ts` as JSX. This is separate
  from Google; the dedicated Google harness specifies TypeScript filenames.
- Live Google sign-in, account creation, share-extension session use and
  signed-device/TestFlight acceptance have not been executed. No TestFlight
  build was submitted by this work.

To make a fresh TestFlight binary, build from the reviewed workspace with
`eas build --platform ios --profile production`; EAS already has the Google IDs.
Installing an older TestFlight binary or publishing only JavaScript will not
include the new native module/callback configuration.
