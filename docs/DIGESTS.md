# Digests — native contract and acceptance

Server: sibling Flowy, integration branch `codex/digest-pricing-integration`. Migration 29 and matching web/worker must precede this client rollout. On 2026-09-08 the user approved clearing old report history/settings and starting with explicit new consent. Saved items and billing are preserved; old settings payloads are no longer supported.

## Use

Open Digests → Settings. Choose weekly (Free, maximum one/ISO week) or optional daily (Starter/Plus/Pro, maximum one/local day total). Paid users may choose both; weekly replaces daily on its publication day. Pick local publication time, weekly day, IANA timezone, English/Spanish and independent push/email channels. The content period ends at local midnight: yesterday or the previous seven complete local days. Device timezone is an explicit suggestion, not a silent travel update. Pause/resume/off preserve report history. Exclusions default to receipts, emails and private notes. Preview reuses a published report or labels a fictional example; test email is explicit and limited to one/hour and three/UTC day.

Reports show TLDR, grounded sections, sources, original HTTP(S) links, a chat draft and replaceable useful/not-useful/not-interested feedback. Chat stays within owned report sources through either server retrieval mode. A report removed after source deletion shows a safe tombstone. Fetching a report does not count as reading: the focused, active screen records the first visible render. History is paginated and keyed by account.

## Native files and boundaries

- `app/(app)/digest/index.tsx`, `app/(app)/digest/[id].tsx`, `app/(app)/digest-settings.tsx`: existing screens evolved in place.
- `src/lib/api.ts`, `src/types/index.ts`: revisioned V2 settings, cursor history, read/feedback/events/test email and optional chat context.
- `src/hooks/useChat.ts`, `src/lib/chatModel.ts`: scoped editable conversation state; no automatic send on CTA.
- `src/hooks/usePushRegistration.ts`: existing-permission registration on login/foreground/token rotation; permission prompt only after explicit settings action; Android creates its channel first and registration returns a typed, user-visible result. Uses the existing EAS project ID. Replaces the obsolete `Constants.isDevice` gate.
- `src/lib/pushDevice.ts`: server registration, account-safe token reassignment and secure deferred revocation. It holds an unlink-only capability, not another account credential.
- `src/hooks/useNotificationIntent.ts`, `src/lib/notificationIntent.ts`, `app/_layout.tsx`: cold/warm notification response, validated exact digest/item path, pending login intent and consumed-response dedup. Universal links only use known tryflowy.app paths. No arbitrary push URL navigation.
- `src/lib/auth.ts`: account query-cache isolation; logout unlinks the current device and retries a stored revocation after connectivity returns.
- `scripts/test-ui-models.cjs`: model/hook regression scenarios, including cold push → login → exact report and consume-once behavior.

The server owns plan/quota/channel capability. No local boolean or incoming notification can authorize data. POST `/api/push/device` takes the Expo token while authenticated and returns a revocation capability. DELETE accepts only that capability and can only unlink its registration. One current device/account is the deliberate scope; registering another device replaces the first. Device permission and digest subscription remain separate.

## Mandatory device run — not executed in this task

Use a physical iPhone/Android device and an explicitly authorized own test account. Expo Go/simulator or an accepted Expo ticket does not satisfy this gate. Keep server staging user allowlist active. The September 10 push follow-up configures a default Android channel; EAS now supplies the matching Firebase file and FCM V1 credential. A clean prebuild was performed and a new native build is required. Build the existing development/release target with valid EAS/APNs credentials and native bundle `app.tryflowy.client` (web Apple Services ID remains `app.tryflowy.app`).

1. Point app API/PB configuration to the authorized staging environment. Sign in, enable weekly and save; enable device notifications explicitly, then choose push. Confirm server has the current token and a valid subscription choice.
2. Generate a synthetic owned report through the durable staging workflow. Record run/report/delivery IDs in the private acceptance log. Distinguish provider accepted/receipt delivered from physical arrival.
3. Verify actual arrival and tap to **that exact report** with visible TLDR and body while app is foreground, background and terminated. Do not accept landing on the inbox/history/latest-report shortcut.
4. Expire the session, tap again, sign in and verify the pending exact report is consumed once. Repeated foreground events must not reopen it. A wrong account must see safe unavailable state; no automatic account switching.
5. Try offline, reconnect, deleted source/report, push token rotation, logout (including offline deferred unlink) and account switching. No prior account query content may appear. Reusing an old revocation capability must not clear a newer account's registration.
6. Verify simultaneous daily/weekly schedules still publish one report on a paid weekly day. Free PATCH and client UI must reject daily even if settings are edited outside this app.
7. Open a source and original link, prepare a chat draft without sending, then explicitly send and inspect citations. Test feedback undo, pagination, error retry and display without images.
8. Check VoiceOver/TalkBack, Dynamic Type, safe areas, dark mode and keyboard at actual device sizes. Record build/device/OS, timestamp, screenshots and server/provider outcomes; do not copy tokens, private content or credentials into the log.

Local commands: `npm run typecheck`, `npm run test:ui-models`. Server `docs/digest-rollout.md` covers configuration, model/email costs, service-stack tests, screenshots, recovery and rollback. The native model tests and web phone-width screenshots are supporting evidence, not physical push acceptance.

The inbox shows a dismissible weekly invitation only after a saved item and before any explicit settings revision. `src/components/digest/DigestInvitation.tsx` never changes consent. History filters use the same server cadence/read filters as web. Push device writes and deferred logout unlinks are serialized; foreground registration refreshes the server association even when the OS token is unchanged.


## Push follow-up — 2026-09-10

- `src/components/settings/PushNotificationSettings.tsx` is shared by general Settings and this screen. It exposes existing permission, explicit enable, OS settings for permanently denied permission, registration failures and retry. Foreground refresh follows returning from OS settings. Registering a device never changes digest consent.
- `src/lib/notificationIntent.ts` accepts both `{type:"item",itemId}` and already-delivered legacy `{itemId}` messages with valid internal IDs. Unknown explicit types and arbitrary navigation remain rejected.
- `src/lib/pushDevice.ts` validates the server's revocation capability before saving it, preserving the last usable registration on malformed responses.
- `app.config.ts` uses the `default` notification channel and build-time `GOOGLE_SERVICES_JSON` file path. EAS stores the matching Firebase file for development, preview and production and assigns the `flowy-494202` service account to `app.tryflowy.client` for FCM V1.
- Validation: 35 model/hook scenarios, typecheck, real server/native item-payload contract checks, clean prebuild on iOS/Android and both Metro/Hermes exports passed. Physical notification receipt, signed native builds and visual/accessibility acceptance are pending.
- Paired server branch: `codex/push-notifications-fix`; deployment/rollback checklist: `Flowy/docs/push-notifications-rollout.md`. Both branches remain isolated for later merge. Railway web/worker now have `DIGEST_PUSH_ENABLED=1`; worker delivery remains limited to staging plus its explicit recipient allowlist pending physical acceptance.
