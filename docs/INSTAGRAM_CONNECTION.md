# Instagram connection — 2026-09-16

Settings → Save from Instagram opens the `/instagram` screen. It shares the web
GET/POST/DELETE `/api/integrations/instagram` contract and the server-owned
`INSTAGRAM_SAVING_ENABLED` / `INSTAGRAM_REFERRAL_LINKS_ENABLED` rollout flags.

A user tap requests the private ten-minute code and opens
`https://ig.me/m/tryflowy?ref=FLOWY-...` using React Native Linking. Existing
Instagram threads can connect on opening; new threads may require the welcome
button or a first message. Returning to Flowy refreshes status through AppState;
while waiting, polling runs only in the foreground. A manual code/clipboard
fallback remains available when handoff fails or the referral rollout is off.

REST operations are bound to the initiating PocketBase user and token. Codes
remain only in mounted screen state, never the React Query cache or persistent
storage. Account changes/unmount discard late responses; status confirmation,
disconnect and code expiry remove or hide the code. Regeneration invalidates the
prior code server-side. Disconnect retains saved library items.

Relevant files:
- `app/(app)/instagram.tsx`, settings tab and native stack registration.
- `src/hooks/useInstagramConnection.ts`: account-scoped query/mutations,
  foreground handling, handoff and clipboard fallback.
- `src/lib/api.ts`, `src/types/instagram.ts`, `src/types/index.ts`: server boundary.
- `src/lib/instagramConnection.ts`: validated external URL and friendly errors.
- `scripts/test-instagram-connection.cjs`: actual API and hook scenario harness.

## Verification and release

- `npm run typecheck` passes.
- `node scripts/test-instagram-connection.cjs`: six scenario groups pass,
  including late account changes, private-cache isolation, failed handoff,
  foreground refresh and cleanup/disconnect.
- `npx expo export --platform ios --output-dir /tmp/flowy-instagram-native-export`
  succeeds; the Hermes artifact contains the new route and referral UI.
- No native dependencies, permissions, entitlements, auth IDs or app configuration
  changed, so this change does not require new native capabilities.
- BLOCKER: real iPhone/Android Instagram opening and new/existing-thread referral
  delivery still need device acceptance. Metro export is not a signed binary or
  a TestFlight submission. Shipping to installed clients requires the normal
  app release; no EAS build, OTA publication or App Store submission was made.

The backend's ordinary post-URL DM save is verified with a ready production item.
Native shared reels without a public permalink remain a separate server limitation.
