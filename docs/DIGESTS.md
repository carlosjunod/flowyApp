# Digests — native contract and acceptance

Server: sibling Flowy, integration branch `codex/digest-pricing-integration`. Migration 29 and matching web/worker must precede this client rollout. On 2026-09-08 the user approved clearing old report history/settings and starting with explicit new consent. Saved items and billing are preserved; old settings payloads are no longer supported.

## Use

### Complimentary Beta Pro (2026-09-11)

The matching server can grant Pro based on the account creation date. Digest
settings optionally return `betaAccessEndsAt`; `src/types/index.ts` accepts it
and `app/(app)/digest-settings.tsx` shows Beta Pro. The server's effective plan
and daily/weekly permissions remain authoritative. Older servers omit the field.
Default access includes all of October 30, 2026 in Bogotá. Dates and the disable
switch live only on PocketBase (`BETA_PRO_STARTS_AT`, `BETA_PRO_ENDS_AT`,
`BETA_PRO_ENABLED`); no Expo environment change or special signup is needed.
Expiry restores the underlying paid plan or Free and does not start billing.
This covers eligible registrations across clients, without verifying TestFlight.

Open Digests → Settings. Choose weekly (Free, maximum one/ISO week) or optional daily (Starter/Plus/Pro, maximum one/local day total). Paid users may choose both; weekly replaces daily on its publication day. Pick local publication time, weekly day, IANA timezone, English/Spanish and independent push/email channels. The content period ends at local midnight: yesterday or the previous seven complete local days. Device timezone is an explicit suggestion, not a silent travel update. Pause/resume/off preserve report history. Exclusions default to receipts, emails and private notes. Preview reuses a published report or labels a fictional example; test email is explicit and limited to one/hour and three/UTC day.

Reports show TLDR, grounded sections, sources, original HTTP(S) links, a chat draft and replaceable useful/not-useful/not-interested feedback. Chat stays within owned report sources through either server retrieval mode. A report removed after source deletion shows a safe tombstone. Fetching a report does not count as reading: the focused, active screen records the first visible render. History is paginated and keyed by account.

## Native files and boundaries

- `app/(app)/digest/index.tsx`, `app/(app)/digest/[id].tsx`, `app/(app)/digest-settings.tsx`: existing screens evolved in place.
- `src/lib/api.ts`, `src/types/index.ts`: revisioned V2 settings, cursor history, read/feedback/events/test email and optional chat context.
- `src/hooks/useChat.ts`, `src/lib/chatModel.ts`: scoped editable conversation state; no automatic send on CTA.
- `src/hooks/usePushRegistration.ts`: existing-permission registration on login/foreground/token rotation; permission prompt only after explicit settings action. Uses the existing EAS project ID. Replaces the obsolete `Constants.isDevice` gate.
- `src/lib/pushDevice.ts`: server registration, account-safe token reassignment and secure deferred revocation. It holds an unlink-only capability, not another account credential.
- `src/hooks/useNotificationIntent.ts`, `src/lib/notificationIntent.ts`, `app/_layout.tsx`: cold/warm notification response, validated exact digest/item path, pending login intent and consumed-response dedup. Universal links only use known tryflowy.app paths. No arbitrary push URL navigation.
- `src/lib/auth.ts`: account query-cache isolation; logout unlinks the current device and retries a stored revocation after connectivity returns.
- `scripts/test-ui-models.cjs`: model/hook regression scenarios, including cold push → login → exact report and consume-once behavior.

The server owns plan/quota/channel capability. No local boolean or incoming notification can authorize data. POST `/api/push/device` takes the Expo token while authenticated and returns a revocation capability. DELETE accepts only that capability and can only unlink its registration. One current device/account is the deliberate scope; registering another device replaces the first. Device permission and digest subscription remain separate.

## Mandatory device run — not executed in this task

Use a physical iPhone/Android device and an explicitly authorized own test account. Expo Go/simulator or an accepted Expo ticket does not satisfy this gate. Keep server staging user allowlist active. The September 8 delivery work added no native dependency. The September 11 settings redesign adds a date/time picker and requires a new native build (see below); still build the existing development/release target with valid EAS/APNs credentials and native bundle `app.tryflowy.client` (web Apple Services ID remains `app.tryflowy.app`).

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


## Settings redesign — 2026-09-11

The screen now groups rhythm, content, language, delivery and pause controls. Weekly days are named radio choices; publication times use the system time picker. Pausing starts with a week and exposes a native calendar for a different resume date. Checked category/type chips mean **included**; an unchecked minus means excluded. Receipts, email and private notes retain their defaults, and unknown saved exclusions remain editable. Changing a setting never subscribes or sends email until the existing explicit action is taken.

- `src/components/digest/DigestControls.tsx`: accessible chips, section/action primitives and a searchable timezone sheet.
- `src/components/digest/DigestDateField.tsx`, `src/components/digest/DigestDateField.web.tsx`: native system pickers and browser date/time inputs.
- `src/hooks/useDigestCategories.ts`: account-scoped, category-only PocketBase query. Preserve exact stored spelling/case/whitespace because the digest worker uses exact exclusions; search facets intentionally normalize these and are unsuitable here.
- `src/lib/digestSettings.ts`: wall-clock picker conversion, meaningful dirty comparison, exclusion preservation and local-day resume conversion, including DST midnight gaps.
- `src/lib/digestTimezones.ts`: IANA choices for Hermes without `Intl.supportedValuesOf`; unsupported device timezones are filtered and saved/device values are preserved.

Publication times retain the server's `HH:MM` format independently of the device timezone. Resume dates map to the first valid instant of that date in the schedule timezone. New categories remain included automatically. Plan/channel capability checks and revisioned PATCH are unchanged. The sticky save bar reports pending/saved state; an in-flight guard prevents double saves, errors preserve edits, conflicts require an explicit reload, and navigation warns before discarding a dirty form.

### Native dependency and rollout

`@react-native-community/datetimepicker` is pinned to **8.4.4**, the SDK 54 version, and registered in `app.config.ts`. See [Expo SDK 54 date/time picker documentation](https://docs.expo.dev/versions/v54.0.0/sdk/date-time-picker/). Both lockfiles are updated; pnpm also reconciles its previously stale Expo entries with the already-existing package.json versions. Regenerate and rebuild development/release binaries before opening this route in an older custom native client; a JS-only update cannot add a native module.

A clean **isolated** iOS prebuild and CocoaPods installation completed, with `RNDateTimePicker` autolinked and the existing bundle/share-extension configuration preserved. An Xcode simulator build stopped while copying React's framework due to `No space left on device`; no successful custom Xcode build is claimed. The subsequent user-requested cache cleanup and removal of this task’s temporary simulator/build files freed approximately 35 GiB, leaving 37 GiB available. Existing simulators, source and credentials were preserved. The failed build outputs were removed. Expo Go 54 on an iPhone 16 Pro / iOS 26 simulator was used for the actual native UI review with synthetic settings and API adapters. No production account, notification registration or email send was used.

### UI/UX review

Applied `emil-design-eng` and `mobile-touch`. Scores are a design/code assessment, not a user-study result.

| Before | After | Why |
| --- | --- | --- |
| Numeric weekday and free-form HH:MM | Named weekdays and native time picker | Recognizable choices, no malformed schedule entry |
| Comma-separated exclusion strings | Wrapping check/minus chips with explicit inclusion semantics | Reversible selection, visible state and preserved private defaults |
| Editable IANA identifier | Searchable city/region list, current value and device shortcut | Avoid timezone typos; retain schedule during travel |
| Fixed seven-day pause | Native date calendar and local-time resume summary | Choose a return date without mental date arithmetic |
| Save action at the end of a long form | Persistent save bar, dirty state, conflict handling and exit guard | Keep action and feedback visible |
| First implementation lost Pressable callback styles in the native render | Static layout/color styles plus active-state feedback; compact day chips | Restore legible selected tags, hit areas and save-button prominence |

First native review: **8.3/10**, rejected because chip/save styles did not render correctly and weekday spacing needed work. These findings were fixed and reviewed again. Final assessment: **9.2/10** (hierarchy 9.4, clarity 9.4, interaction 9.2, accessibility 9.0, error/state handling 9.0).

Validation: native TypeScript and all **33 UI-model scenarios** pass, including new schedule/DST, exact category query, inclusion state and screen/CAS/double-save/plan-gate regressions. An iOS Hermes export passed. Simulator review confirmed native picker presentation, named-day selection, category toggles and long labels, city search and timezone change without HH:MM drift, calendar selection with past days disabled, saved pause date and save confirmation. Light/dark rendering was inspected. Accessibility roles, checked states and hints are exposed in the native accessibility tree; full physical-device VoiceOver/TalkBack, large Dynamic Type and Android acceptance remain unclaimed. The earlier live push delivery acceptance gate is unchanged.


## Visual alignment with the web app — 2026-09-11

The native Digest screen now follows the actual web sources: `apps/web/app/globals.css`, `apps/web/app/(app)/settings/digest/page.tsx`, `apps/web/app/(app)/settings/digest.tsx`, `apps/web/components/ui/Button.tsx` and the settings index. `src/lib/digestAppearance.ts` mirrors their Warm Paper / Dark Graphite tokens, rounded to RGB, and scopes NativeWind variables to the Digest screen and its timezone modal. The rest of the native theme is unaffected.

| Before | After | Why |
| --- | --- | --- |
| Cream background and the native app's older accent palette | Web background `#FAF8F5` / `#1A1B1E`, matching surfaces, text and borders | Same visual identity in both themes |
| Promotional headline | Settings eyebrow + Instrument Serif “Digests” at 36/40 | Matches the web settings hierarchy |
| Platform-default body font in several controls | Existing Inter regular/medium/semibold assets | Matches web labels, paragraphs and controls |
| White, 16px-radius cards | Web-style surface cards, 12px corners, 20px padding and 24px section spacing | Consistent density and grouping |
| Solid accent tags and save button | Neutral checked chips and the web primary button; accent reserved for icons and native switches | Match the web's action hierarchy while preserving clear toggle state |

The native time/date pickers, category inclusion behavior, plan/channel restrictions, pause semantics, dirty guard and revisioned save remain unchanged. The minimum 48px control height is retained; named weekday controls fit one row at 393px and wrap at smaller widths. No native dependency or app configuration changed in this visual pass.

Review used `emil-design-eng`; the design assessment remains **9.2/10**. Native TypeScript and all **33 UI-model scenarios** pass. A temporary browser harness rendered the actual screen and controls through React Native Web plus the real NativeWind web interop and compiled Tailwind styles. Synthetic API/category/navigation adapters and SVG icon stand-ins isolated it from user accounts. At 320, 393, 768 and 1280px, both themes have the expected web token colors, no horizontal viewport overflow, and a visible persistent save action. At 393px all seven weekday targets fit one row with at least 44×48px bounds; inclusion toggle and save feedback pass in both themes. Screenshots were visually inspected, including wrapped category labels and dark contrast. This pass validates presentation through the browser renderer, not a new physical-device/native build or Android picker behavior. It generated no Xcode build caches; the temporary preview dependencies/server were removed after review.

## Push follow-up — 2026-09-11

`PushNotificationSettings` is shared by general Settings and this screen. It keeps permission, registration and digest consent separate, supports settings/retry recovery, and accepts typed plus already-delivered legacy item payloads. EAS supplies the matching Firebase configuration and FCM V1 credential. iOS and Android owned-device registration, provider receipts and visible arrival passed; exact notification taps and broader accessibility acceptance remain release gates.
