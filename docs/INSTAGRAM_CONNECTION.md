# Instagram connection — 2026-09-16

Settings → Save from Instagram opens the `/instagram` screen. It shares the web
GET/POST/DELETE `/api/integrations/instagram` contract and the server-owned
`INSTAGRAM_SAVING_ENABLED` / `INSTAGRAM_REFERRAL_LINKS_ENABLED` rollout flags.

A user tap requests the private ten-minute code and opens
`https://ig.me/m/<configured-handle>?ref=FLOWY-...` using React Native Linking. Existing
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


## Bilingual recipient preparation (2026-09-16)

Branch `codex/instagram-bilingual-accounts` matches the server branch of the same
name. Connection API responses now optionally include `account`, `handle`,
`language` and `accounts` (public id/handle/language/connected/linkedAt). The
server configures which accounts are available; the native client does not ship
future accounts as active. No new Expo environment variable is required.

With two configured accounts, the screen selects English/Spanish destinations.
GET/POST/DELETE send `?account=<recipient ID>`; disconnect affects only that
recipient. Each connects separately to the same library. Links and instructions
use the server handle. Legacy server responses fall back to `tryflowy` until
rollout; malformed handles cannot turn a link into an arbitrary URL. Private
codes and query keys are scoped to both Flowy session and destination, and
in-flight responses cannot open the old destination after switching.

The intended account names are `save.to.flowy` and `guardalo.en.flowy`; operators
may change either in server configuration. DM reply language is selected by the
server's destination configuration. This does not translate the entire settings
screen or change the rest of the app language.

Validation: `npm run typecheck` and `node scripts/test-instagram-connection.cjs`
(7 scenario groups) passed. The change adds no native dependencies/capabilities.
The preparation checks did not include a signed binary or physical Instagram
handoff. Existing beta builds contain the old hardcoded handle and must be
updated to build 30 or later for the renamed receiver. Full activation runbook is in the server's
`docs/instagram-account-rollout.md`; deploy its migration 44 before the API/worker.


## Rename release (2026-09-17 UTC)

Native commit `ce60a65` is merged to `main`. Server metadata is configured for
`@save.to.flowy`, verified against the original Instagram account ID. The Spanish
account remains hidden until its Meta connection and credentials are ready.

iOS 1.0.0 build 30: `5cbfda16-7881-419a-a710-82555a5f28ed`.
Automatic App Store Connect submission: `097c2743-3b17-4d2b-a5f0-a687088e2904`.
Build 30 completed successfully at 2026-09-17 02:41:21 UTC; automatic submission
is in progress. TestFlight availability and physical Instagram handoff remain
separate acceptance steps.
