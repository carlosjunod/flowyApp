# FlowyApp — Parity Red-Priority Handover

> **Instagram new-thread fallback + linked username — 2026-09-22:** For a
> brand-new Instagram thread Meta drops the `ref` handoff, so `/instagram` now
> forces the manual-code disclosure open (`handoffReturned`, tracked in
> `useInstagramConnection` from foreground return + a still-pending handoff)
> and swaps in copy pointing back to "Connect with a code" instead of leaving
> the user stuck on the ice-breaker DM. The connection screen also shows
> "Connected as @{username}" once the server resolves the linked account's
> `username` (server contract addition, optional and nullable, on `data` and
> each `accounts[]` entry). No native dependency, entitlement or config change.
> `npm run typecheck` and `node scripts/test-instagram-connection.cjs` (10
> scenario groups) pass. Physical-device acceptance of a brand-new-thread
> handoff remains pending; see `docs/INSTAGRAM_CONNECTION.md`.

## Spanish interface — 2026-09-17 (branch `codex/i18n-es`, not merged)

The native client now ships English and Spanish. Operating guide, glossary and
the full "what is and is not translated" policy live in `docs/I18N.md`; this
entry records rollout state and what a reviewer still owes the release.

**Capability.** Every native screen, alert and accessibility label is
translated: auth, tabs, inbox (filters, labels, cards, item actions, bulk
selection, empty/error states), the reader and its semantic/recipe/receipt/
carousel/YouTube/Reel renderers, original files and text previews, chat and its
history drawer, digests and digest settings, personalization, storage, and the
inbox email alias. Dates, numbers, byte sizes and relative times are formatted
through the active locale.

**Not translated, on purpose.** Item titles, notes, tags and categories (the
user's words); summaries, transcripts, digest bullets and chat answers (AI
output, in the language it was generated in); API error *codes*, `item.type`
values and URLs (contracts). `ApiError.message` is the server's code, so alerts
now render it through `src/lib/apiErrors.ts` instead of showing the raw value.

**Two literals stay English because a server compares them byte-for-byte:**
the `delete my account` confirmation phrase, and `DEFAULT_CONVERSATION_TITLE`
(`New conversation`), which is persisted and synced — its *display* is localized
via `chat.history.newConversation`, the stored value is not.

**Locale policy.** Explicit choice (persisted under `flowy.locale` in the
device-local secure store) → device language (any Spanish variant resolves to
one neutral Spanish) → English. Detection is never persisted. Choosing
**Automatic** deletes the stored row, so the next launch detects again. A
keychain that cannot be read degrades to the detected language and never blocks
startup. The selector is reachable from login, signup and Settings — someone
whose phone put them in a language they cannot read needs a way out *before*
signing in.

**D-041 holds:** `DigestPreferences.locale` (the language Flowy *writes reports
in*) remains an independent server-side setting. The interface language never
changes it; `test:i18n-parity` asserts both directions.

**Cross-platform contracts.** `src/types/inbox-presentation.ts`,
`src/types/reader.ts`, the "Localisable variants" block in
`src/types/semantic.ts`, and `chatErrorKey` in `src/hooks/useChatEngine.ts` are
mirrored byte-for-byte with the web client and now return translation *keys*.
Renaming a key on either side breaks the other; `test:i18n-parity` renders every
key those contracts can emit, in both locales, with no English fallback.
`semanticCoverageMessage` / `semanticEvidenceLabel` are untouched — the worker
uses them to write `exploration.notes`, which is stored content.

**No native change.** No dependency, entitlement, capability or native project
configuration was added; `expo-localization` is deliberately absent. Detection
reads the platform's existing locale modules (through `getConstants()` *and* the
legacy own-property, because React Native 0.81 moved both behind TurboModule
getters) and falls back to `Intl`. This ships as a JavaScript change; no new
binary is required for the i18n work itself.

**Validation performed.** `npm run typecheck` (also the EN/ES parity gate),
`npm run test:i18n`, `npm run test:reader-navigation` (10 scenarios),
`npm run test:digest-monthly`, an iOS Metro/Hermes export, and a Spanish/English
switch confirmed in the installed development client on an iPhone 16e.
`npm run test:ui-models` still stops at its **pre-existing** `chatSync.ts`
transpilation failure in the custom loader; that is unrelated to this work and
was deliberately not touched.

**Still owed before release.** Native VoiceOver in Spanish; Dynamic Type at the
largest sizes with the longer Spanish strings (Spanish runs ~15–25% longer than
English and several toolbars are tight); a Spanish-language device cold start
(as opposed to switching in-app); Android verification — every device-detection
path is covered by tests against the real module shapes, but only iOS has been
exercised on hardware. Translation review by a native speaker has not happened.

## Storage publication — 2026-09-15

Native Storage P0–P3 and UI refinements are integrated into main at `6c28839`,
preserving the newer Inbox changes. Server PB migrations 38/39, worker and web
have deployed successfully. Production R2 browser CORS is configured for
`https://tryflowy.app`, PUT and Content-Type. Positive/negative preflight and a
signed PUT with Origin plus byte-matching GET passed; the synthetic probe was
removed. CORS does not govern iOS uploads and requires no new native build.

EAS accepted production **1.0.0 (27)** from `6c28839aa028f3d58db676ff2ad8d0b0b21717e4`,
using production endpoints and existing signing credentials. The build archive
contains Storage and the share template and excludes local env/generated ios.
TypeScript and the paired server's 80 checks pass. The unchanged UI-model harness
still fails during chatSync generic transpilation; see server TESTING.md.

- Build: https://expo.dev/accounts/r3db3ard_85/projects/tryflowy/builds/6c180478-79e0-4361-89fc-b82ef391f6ab
- Automatic submission: https://expo.dev/accounts/r3db3ard_85/projects/tryflowy/submissions/6adcad23-16f1-4b46-b875-a8450125bc6b

EAS reports build FINISHED (2026-09-15 05:17:22 UTC) and automatic submission
FINISHED with no error. Apple processing and TestFlight tester availability have
not been independently confirmed. Unrelated local edits remain uncommitted.


> **Monthly digests — 2026-09-12:** Settings and history support optional paid/Beta monthly reports alongside daily and weekly. Day 1–28, local time/timezone and independent channel opt-ins use the coordinated server contract; monthly covers the previous complete calendar month and takes priority on overlapping schedules. Allowances are unchanged. TypeScript, four monthly settings/API scenario groups, four engagement groups and iOS Metro/Hermes export pass. No report generation, delivery, device changes or deployment occurred. See `docs/DIGESTS.md` for rollout and remaining device checks.

> **Item reading state — 2026-09-12:** Shared phone/landscape ItemReader records first opening automatically, independently of the reversible **Mark as read / Mark as unread** action. Inbox cards/rows show a discreet dot/check; **Unread** filters the full server library. Older saves show no read mark recorded, not a claim that they were never read. Requires the coordinated Flowy engagement migration and API before shipping. Realtime remains active for ready items and foreground/30-second reconciliation covers missed events. Requests, detail caches and late responses are account-bound. See `docs/ITEM-READING.md` for rollout and validation.

> **Google iOS + Android — 2026-09-11:** Login/signup now use the native Google SDK and existing `/api/auth/google` plus shared PocketBase session. New-account consent is explicit, cancellable and server-gated. Public iOS/web OAuth IDs and a new binary are required; Android now shares this flow through its Play Services adapter; see `docs/GOOGLE_SIGN_IN_ANDROID.md` for signing and validation. Details and release checks: `docs/GOOGLE_SIGN_IN_IOS.md`.

> **Android share menu — 2026-09-11:** Android now appears in the system share menu for text/URLs, images, videos, PDFs and files, including multi-select image/file shares. `expo-share-intent` is configured only for Android so it cannot alter the existing custom iOS extension. `src/lib/shareIntent.ts` applies iOS-equivalent priority and classification (video → URL → PDF → images → file), converts Android cache files to the server's base64 ingest contract, and waits for PocketBase session hydration before posting. A clean Android prebuild verified the generated `ACTION_SEND` and `ACTION_SEND_MULTIPLE` filters. TypeScript passes; device-level share, file-provider and large-media validation remain required before release.

> **Third-party AI consent — 2026-09-11:** Email registration and first-time Sign in with Apple now require an explicit, unchecked acceptance before the server creates an account. The disclosure names Anthropic, OpenAI, and Voyage AI; Privacy Policy and Terms are available in Settings. Existing accounts receive a blocking in-app acceptance gate; server `POST /api/ingest` and `POST /api/chat` reject requests until the current consent version is recorded through `GET/POST /api/account/ai-consent`. Deploy server migration `1900000032_ai_processing_consent.js` before this native build. Native TypeScript passes; no device validation or App Store submission was performed.

> **Personalization V1 — 2026-09-10:** Added an optional account profile shared with web: occupation/learning, current focus and preferences. Settings → **What Flowy knows about you** opens `/personalization`; Inbox and Chat display a dismissible orange banner across the full width above their headers, with **Complete interview**. The three-question reminder shares completed/dismissed state across the account and does not send push notifications. Users can save, pause or clear their profile. Concurrent edits retain local drafts and require an explicit reload, with confirmation before discarding edits. The session-bound REST boundary and account-keyed hook reject stale results after account switches. V1 only uses user-saved profile answers; it does not extract automatic memories from conversations.
>
> Matching server migration/API must ship first. Existing chat streaming/citations, auth IDs and native capabilities are unchanged. TypeScript and all 29 UI-model regression scenarios pass. iOS Metro export did not complete because a shared dependency cache required write access outside the worktree. Real-device accessibility, keyboard behavior, cross-device persistence and model-response quality remain release validation; no deployment or native binary submission was performed. Details and acceptance checklist: `docs/PERSONALIZATION.md`.


> **Native sources, icons and bookmark navigation — 2026-09-08:** Chat now renders citations as compact native Text links, with stable numbering and a collapsible source-card list showing thumbnails, titles and domains. Cards use static Pressable styles for NativeWind v4 compatibility; copied answers retain source references. App-authored emoji UI is replaced by Feather icons (saved/user content is preserved), including carousel placeholders with corrected control/thumbnail styles. Tabs live under `app/(app)/(tabs)` inside a native Stack; `/item/:id` pushes above them with the iOS left-edge back gesture enabled, retaining the originating Inbox/Chat tab and state. Public paths stay unchanged; cold item links have Inbox underneath. Reduced motion uses no transition animation.
>
> Validation: Typecheck, 25 UI-model regression scenarios and iOS Metro/Hermes export pass. An isolated Expo Go fixture rendered the real ChatMessage, ItemDetailScreen and AppNavigator on iPhone 16e: checked dark/light sources, inline citation and card navigation, source expansion retained after returning, Inbox/Chat origins, icon fallbacks and carousel controls. Automated simulator dragging did not generate usable touch swipes, so completion/cancellation of the edge gesture still needs a physical iPhone check. The fixture uses synthetic data and is outside the repository; no production data was changed. No new environment variables, server flags, packages or native capabilities are needed. These client changes require a new TestFlight build.

> **Chat navigation — 2026-09-08:** `app/(app)/chat.tsx` now opens a left history drawer (`src/components/chat/ChatHistoryDrawer.tsx`) with sidebar/compose icons, selected conversation styling and a New chat action. Close via backdrop, sidebar control, accessibility escape, Android Back or swipe left. Safe areas and reduced-motion preferences are respected. Drafts, active generation and confirmed conversation deletion are preserved. Typecheck, all 18 UI-model scenarios and the iOS Metro/Hermes export pass. Native gesture/VoiceOver behavior still needs simulator/device verification; the export is not a native binary build.

> **Server retrieval update — 2026-09-08:** Flowy now consumes the existing chat history on its feature-flagged retrieval path, preserves richer extracted evidence, and generates stable `[[itemId]]` citations plus source/time URLs. The client still uses the same `text/plain` stream and `x-items` header; no native implementation or binary change is needed. Client typecheck and all 18 UI-model scenarios pass. No device E2E or production model-quality claim is made. Server deployment/reindex instructions: `../Flowy/docs/retrieval-quality-rollout.md`.


> ## UI/UX implementation update — 2026-09-07
>
> Inbox and chat implementation is recorded in `docs/UI-UX-IMPLEMENTATION.md` and the README's dated update. The client now requires the coordinated authenticated `GET /api/items` endpoint for global library search/facets; native `/api/chat` still uses the existing plain-text stream and `x-items` citations contract.
>
> Current correction to the historical follow-up table below: ExploreCTA is wired through `actions.exploreMany`; its former dead-stub description no longer applies.
>
> Delivered: explicit inbox error/retry states, navigable processing/failed saves, compact cards/list, honest save/import results, removal of fake suggestions, title-first detail and receipt rows, visible selection, wide-screen navigation, account/device chat history and drafts, stop/retry/copy, compact sources and reader-controlled scrolling. In-app navigation preserves active chat work. Suspended-OS background execution and cross-device history are not promised.
>
> Validation: TypeScript clean, 18 Node model regression scenarios pass, whitespace diff check clean. No native simulator/device visual or E2E validation was performed for this change; use the current acceptance checklist before shipping native builds. No native capabilities, auth audiences, schema or production data were changed.


> **Date:** 2026-05-28
> **Branch:** `fix/parity-red-priority`
> **Predecessor:** [`PARITY-DIAGNOSTIC.md`](./PARITY-DIAGNOSTIC.md) (2026-05-25)
> **Scope:** All 🔴 items from §5 of the diagnostic — bulk import 404, share-extension OS-level capability gates, video/PDF/file ingest, SIWA + Universal Links bundle-ID mismatch.
> **Out of scope (not touched):** 🟠 / 🟡 items (#5 Explore wiring, #7 ItemType expansion, #8 email alias, #10 audio, #11 Google button, #12 menu actions, #13 template reconciliation). See "Next session" below.

> ## ⚠️ CORRECTION — 2026-09-03
>
> **Items 6 and the entire §2 "Apple Developer Portal" plan below are wrong. Do not follow them.**
>
> Verified directly in the Apple Developer Portal: **`app.tryflowy.app` is a Services ID**, not an
> App ID. It sits under Identifiers → Services IDs, described "tryflowy login", with Sign In with
> Apple enabled. Apple keeps App IDs and Services IDs in one namespace, so an App ID named
> `app.tryflowy.app` **can never be registered** while that Services ID exists — and no provisioning
> profile for it can ever be issued. The May 28 EAS failure to generate a profile for that bundle was
> this collision, not a missing registration.
>
> The App IDs that exist are the ones needed, and both were already registered:
> `app.tryflowy.client` ("flowy app id") and `app.tryflowy.client.ShareExtension`
> ("Flowy Share Extension"). The "No credentials set up yet" line in the May 28 audit was EAS looking
> for `app.tryflowy.app.ShareExtension`, which does not exist.
>
> **The bundle stays `app.tryflowy.client`. The server moves instead:** set Railway
> `APPLE_CLIENT_ID=app.tryflowy.client` and leave `APPLE_WEB_CLIENT_ID=app.tryflowy.app` (the Services
> ID). `getAudience()` in `apps/web/lib/apple-auth.ts` already returns `[native, web]` when they
> differ, so native and web both verify with no code change, and the AASA serves
> `8C72ST495F.app.tryflowy.client` — matching the installed app.
>
> Consequently: **no new App ID, no new App Store Connect record, no EAS credential reset, and no
> testers forced to reinstall.** Ship from the existing ASC record on bundle `.client`, which already
> has the builds and holds the "Flowy" name. The other ASC record (bundle `app.tryflowy.app`) has no
> builds and no backing App ID — do not ship it.
>
> Also: **"Keychain Sharing" is not a Developer Portal capability** — it is an entitlement the app
> already declares, so ignore that line in §2. What does need checking on the `app.tryflowy.client`
> App ID is Associated Domains, App Groups (`group.app.tryflowy`), Sign in with Apple, and
> **Push Notifications** (the app uses `expo-notifications`; easy to miss).
>
> Separately, **web Sign in with Apple is broken for one narrow reason**: the `app.tryflowy.app`
> Services ID has its Primary App ID set correctly to `app.tryflowy.client`, but its **Website URLs
> list is empty**. Add domain `tryflowy.app` and return URL `https://tryflowy.app/login`.
>
> Note that *Associated Domains* (App ID capability, drives Universal Links via the AASA) and
> *Website URLs* (Services ID, drives web SIWA only) are different screens for different things.



---

## 1. What changed

### File-by-file

| File | Change | Why |
|---|---|---|
| `app.config.ts:3` | `BUNDLE_ID = 'app.tryflowy.client'` → `'app.tryflowy.app'` | Match Railway prod's `APPLE_CLIENT_ID` so SIWA token `aud` verifies and AASA `appID` aligns with the installed app. |
| `plugins/withShareExtension.js:241` | Same fallback string flipped | Plugin fallback used when `cfg.ios.bundleIdentifier` is unset — keep consistent. |
| `plugins/withShareExtension.js` (renderInfoPlist) | Activation rule opened: `Image` max 1 → 10, added `MovieWithMaxCount=1`, added `FileWithMaxCount=10` | Lets the iOS share sheet surface Flowy for videos, PDFs, generic files, and multi-image carousels. Source of truth — `ios/ShareExtension/Info.plist` is regenerated from this on every prebuild. |
| `ios/ShareExtension/Info.plist` | Same activation-rule changes | Working-tree mirror so the current build doesn't need a prebuild to pick up the change. **Gitignored** — only the plugin render is durable. |
| `plugins/shareExtensionTemplate/ShareViewController.swift` | Added `IngestType.pdf` / `.file`, `ShareFile` struct, `raw_pdf/raw_pdfs/raw_file/raw_files` on `IngestPayload`, new `loadShareFile()` loader, new pass-4 in `extractPayload()` that classifies PDFs separately from generic files (`UTType.pdf` vs `UTType.data`). Updated all 5 `IngestPayload(...)` call sites for the new optional fields. | Implements PDF + generic-file ingest on the native side. Mirrors web's `ShareFile` body shape (`Flowy/apps/web/app/api/ingest/route.ts:48-58,363-376`). Cap of 10 matches web. |
| `ios/ShareExtension/ShareViewController.swift` | Same — kept in sync with the template (`cp` from template) | Gitignored, but the live build reads from here until next prebuild. |
| `src/hooks/useBulkImport.ts` | Rewrote to use bounded-concurrency (4) loop over `POST /api/ingest` instead of the non-existent `/api/ingest/bulk` + `/api/import-batches/:id` endpoints. Synthesizes the existing `ImportBatch` shape locally so `BulkImportSheet.tsx` is untouched. Caps at 100 URLs (matches web). | The 🔴 in §5 item 1 — every bulk import was returning 404. Mirrors `Flowy/apps/web/components/inbox/BulkAddBookmarksButton.tsx`. |
| `src/lib/api.ts` | Removed `ingestBulk` + `getImportBatch` methods and their type imports | Dead code — the endpoints they called don't exist. |
| `src/types/index.ts` | Removed `IngestBulkPayload` + `IngestBulkResponse`; kept `ImportBatch` (still used by the local synthetic batch state). Added comment explaining the client-side approach. | Type cleanup. |

### Sanity checks run

- `plutil -lint ios/ShareExtension/Info.plist` → **OK**
- `node -c plugins/withShareExtension.js` → **OK**
- `npx tsc --noEmit` → **clean** (no errors)
- `rg ingestBulk|getImportBatch|IngestBulkPayload|IngestBulkResponse` → **0 hits**
- Manual grep: all 7 `IngestPayload(` call sites in Swift have the new optional fields.

### What this maps to in the diagnostic

| §5 # | Status | Notes |
|---|---|---|
| 1 — Bulk URL import 404 | ✅ Fixed (client-side loop) | Public surface of `useBulkImport` preserved → no UI change. |
| 2 — Open share-ext activation rule | ✅ Fixed | Both committed `renderInfoPlist` and live `ios/` Info.plist updated. |
| 3 — Add PDF + generic-file capture in Swift | ✅ Fixed | New `loadShareFile()` + pass-4. PDFs go to `type:'pdf'`, others to `type:'file'`. |
| 4 — Restore video/screen_recording | ✅ Fixed (zero new code) | Swift loader already existed (`loadVideoPayload`); #2 unlocks the share-sheet gate. |
| 6 — Bundle-ID ↔ APPLE_CLIENT_ID mismatch | ✅ Fixed in code | **Apple Developer Portal + EAS provisioning steps still required — see §2 below.** Railway env confirmed by user (2026-05-28): `APPLE_CLIENT_ID=app.tryflowy.app`. |

---

## 2. ⚠️ Manual steps before the next build

Code-only changes are insufficient for #6 — Apple identifies apps by App ID at the certificate/provisioning level, not just the Info.plist bundle string. The following must be done in order before EAS can produce a working build with the new bundle ID:

1. **Apple Developer Portal** ([developer.apple.com/account/resources/identifiers/list](https://developer.apple.com/account/resources/identifiers/list))
   - Register a new App ID: `app.tryflowy.app` (or "Edit" if it already exists from prior planning).
   - Capabilities to enable: **Sign in with Apple**, **Associated Domains**, **App Groups** (select `group.app.tryflowy`), **Keychain Sharing**.
   - Register the extension App ID: `app.tryflowy.app.ShareExtension`. Same App Groups + Keychain Sharing.
   - Optionally retire `app.tryflowy.client` and `.client.ShareExtension` if they were ever registered.

2. **App Store Connect**
   - The existing TestFlight app (if any) under `app.tryflowy.client` will *not* update — it's effectively a different app to Apple's systems. Create a fresh app record with bundle ID `app.tryflowy.app` (App Store Connect → My Apps → +).
   - Internal/external testers will need to install the new TestFlight build fresh; their existing install of `.client` will not auto-migrate (and the shared keychain item will not transfer because the App Group is scoped per-team, but the Keychain entry has a different access group when bundle ID changes — they'll need to sign in again on first launch).

3. **EAS provisioning**
   - `pnpm dlx eas-cli credentials` → reset iOS credentials for the new bundle ID; let EAS auto-create.
   - **OR** delete `ios/` and let prebuild + EAS regenerate from scratch:
     ```bash
     rm -rf ios
     pnpm dlx expo prebuild --platform ios --clean
     pnpm dlx eas build --platform ios --profile preview   # or production
     ```
   - Verify the AASA file is reachable post-deploy:
     ```bash
     curl -sI https://tryflowy.app/.well-known/apple-app-site-association | grep -i content-type
     # Expected: content-type: application/json
     curl -s https://tryflowy.app/.well-known/apple-app-site-association | jq '.applinks.details[0].appID'
     # Expected: "8C72ST495F.app.tryflowy.app"  (NOT ...client)
     ```
   - If `APPLE_TEAM_ID` is unset on Railway, the AASA serves `TEAMIDMISSING.app.tryflowy.app` and Universal Links silently fail. Verify Railway env has both `APPLE_CLIENT_ID=app.tryflowy.app` (confirmed) and `APPLE_TEAM_ID=8C72ST495F` (`[unverified]` from this session — confirm via `mcp__Railway__list_variables` next session).

---

## 3. Smoke-test plan for the new build

Run on a physical device, freshly installed from TestFlight (simulator will not exercise SIWA properly).

| # | Test | Pass criteria |
|---|---|---|
| 1 | Open app, tap "Sign in with Apple" | Returns to inbox signed in, no 401 in network log. Server response should be `{data: {token, userId, email}}`. |
| 2 | From a browser, share a webpage to Flowy | Single-URL ingest succeeds (pre-existing path, regression check). |
| 3 | From Photos, share a screen recording or video (.mp4/.mov) | **Flowy appears in the share sheet** (this was broken). Ingest succeeds with `type:'screen_recording'`. |
| 4 | From Photos, multi-select 3 images and share | **Flowy appears in the share sheet** (was capped at 1). Ingest succeeds with `type:'screenshot'`, `raw_images` array length 3. |
| 5 | From Files app, share a PDF | **Flowy appears in the share sheet**. Ingest succeeds with `type:'pdf'`, `raw_pdf:{name,mime,data}`. |
| 6 | From Files app, share a `.docx` or `.zip` | Flowy appears, ingest succeeds with `type:'file'`, `raw_file:{...}`. |
| 7 | In-app bulk add: paste 5 URLs | UI shows progress (`processed / total`), all 5 land in the inbox, no 404 in network log. |
| 8 | In-app bulk add: paste 1 known-dead URL + 2 good | Progress shows 1 in `dead_count`, others land. UI does not lock up. |
| 9 | Tap an item from a Universal Link (`https://tryflowy.app/item/...`) in Safari/Mail | App opens to the item drawer (was silently broken — Safari would just open the web page). Requires Apple to have re-validated the AASA post-bundle-ID swap; allow ~15 min after first install. |

---

## 4. Known follow-ups (out of scope, recommend next cycle)

Severity tags from the original diagnostic; effort tags re-estimated.

| # | Sev | Effort | Item |
|---|---|---|---|
| 5 | 🟠 | M | Wire Deep-dive/Explore to `POST /api/items/bulk/explore` — currently a dead UI stub (`src/components/inbox/ExploreCTA.tsx:18-25`). |
| 7 | 🟠 | S | Extend `ItemType` union to `facebook, tiktok, drive, file, email` (`src/types/index.ts:1-15`). Web ingest already accepts these; without this the native UI renders them through the generic fallback. |
| 8 | 🟠 | M | Surface the inbound-email alias in settings (web mints one at `/api/account/alias`). |
| 10 | 🟠 | M | Audio ingest path (web accepts `type:'audio'`; native has no loader). |
| 11 | 🟡 | S | Add the Google sign-in button to `app/(auth)/login.tsx` — `api.authGoogle` already exists. |
| 12 | 🟡 | S | Add `share` + `deep-dive` to `ItemActionsMenu.tsx`. |
| 13 | 🟡 | S | Decide: drop the 11-type `plugins/shareExtensionTemplate/ShareViewController.swift` template or the 7-type committed `ios/` copy as the canonical version. Plugin currently prefers `ios/` if present, which is gitignored → causes worktree drift. |
| — | — | M | Audit pass: confirm every web `/api/ingest` field the native client *should* be able to send (`source_url`, `tags` pre-send, `dedupeAgainst`) is actually wired. |

---

## 5. Quick reference

- **Branch:** `fix/parity-red-priority` (off `main`)
- **Diff stat (run `git diff --stat`):** 6 files, ~83 insertions / 76 deletions before the Swift template copy; after copy, +~150 lines of Swift in `shareExtensionTemplate/`.
- **No commits made** — leaving review to the human. Recommended commit split:
  1. `feat(ios): flip bundle id to app.tryflowy.app for SIWA + Universal Links parity` (app.config.ts + plugin fallback)
  2. `feat(ios/share): open activation rule for video, PDF, file, multi-image` (Info.plist + plugin render)
  3. `feat(ios/share): capture PDF + generic file shares end-to-end` (ShareViewController.swift in both locations)
  4. `fix(bulk-import): loop /api/ingest client-side, drop dead bulk endpoints` (hook + api.ts + types)

- **Apple/EAS work outside this repo:** §2 above. Block on this before the next TestFlight.

---

## 6. Cross-references

- Web ingest contract: `Flowy/apps/web/app/api/ingest/route.ts` (types whitelist at `:10-30`, body shape at `:223-235`, ShareFile coercion at `:363-376`).
- Web AASA: `Flowy/apps/web/app/.well-known/apple-app-site-association/route.ts` (reads `APPLE_TEAM_ID` + `APPLE_CLIENT_ID`).
- Web SIWA verifier: `Flowy/apps/web/lib/apple-auth.ts:38-47`.
- Web bulk-add mirror: `Flowy/apps/web/components/inbox/BulkAddBookmarksButton.tsx` (concurrency 4, max 100, exact failure-handling pattern).

## 2026-09-08 — Daily/weekly digests

Server integration is in sibling Flowy branch `codex/digest-pricing-integration` after pricing merge `03c75ce`. The user explicitly approved a fresh start: server migration 29 clears historical digests/old settings but preserves items and billing. Ship the matching server and native client together; no V1 settings compatibility/backfill is required.

Native now renders TLDR first, full cited report/source actions, feedback, paginated history and weekly/daily settings. Free is weekly only; paid shares one report/day, enforced on the server. Optional digest chat context persists per conversation and opens an editable draft without sending. Push registration uses the authenticated `/api/push/device` boundary, exact typed report/item intents wait through session restoration/login, persisted response dedup prevents reopening on foreground, and account changes clear query caches. One current device per account is supported. A scoped revocation capability permits retrying unlink after offline logout without keeping the account's full token.

See `docs/DIGESTS.md` for settings, API contracts and mandatory physical-device acceptance. No new native dependency or config capability was added. Type/model tests do not establish receipt on a physical device or correct APNs/EAS credentials; those remain explicit release gates. No production messages or migrations were performed.

Digest follow-up validation: native typecheck and 21 UI model/hook scenarios pass. The inbox invitation, cadence/read history filters and serialized push registration are documented in `docs/DIGESTS.md`; physical push and real email remain release gates.

## Semantic content templates V1 — 2026-09-08

Implemented in the isolated `codex/content-templates` worktree alongside the server worktree `Flowy-content-templates`. `src/types/semantic.ts` mirrors the server/web validated envelope. Inbox cards, rows and detail rows preview list counts and resource names. `src/components/inbox/content/SemanticContent.tsx` renders list/entity/narrative content with 12-entry pagination, literal evidence, safe source/lookup links and YouTube timestamp actions, composed with existing medium/receipt renderers. Generic source text now renders Markdown. The detail research action is labelled “Find resource links” for semantic lists/entities.

No native configuration, entitlement, API route or chat stream shape changed. Deploy the matching server/worker before enabling `CONTENT_TEMPLATES_ENABLED=1` for new ingestion. Clients safely ignore missing/invalid/unknown envelopes, so old records remain readable. Movie/GitHub lookups use the existing Explore action; other resource domains show source links only. The worker flag defaults off until real-corpus evaluation. Saved templates render even when the ingest flag is off. No production data or original checkout was changed.

Validation: TypeScript and the existing 18 UI-model scenarios pass; iOS Metro/Hermes export passes. Web component fixture checks cover matching behaviors at 1440/768/390/320px. Native VoiceOver, Dynamic Type and real device interaction remain unvalidated; export is not device E2E.


## Semantic content V1.1 — 2026-09-08

The mirrored contract accepts optional extraction quality/progress and evidence origins while preserving old V1 records. Detail renders quality notices even for generic content, distinguishes incomplete reading from insufficient source text, labels caption/OCR/transcript evidence and offers “Continue extraction” through the existing Explore action. The worker checkpoints work and skips link lookup when continuing; no request shape or native capability changed. Original media and receipts remain in place. Source counts are classifier-reported with literal evidence, not keyword heuristics. The provider has not been evaluated against production content and no feature was deployed or enabled by this task.

Validation for V1.1: TypeScript and all 18 existing UI model scenarios pass; iOS Metro/Hermes export succeeds. No native-device interaction was tested. Server regression suite: 133 tests across 14 files.

## Source identity and content parity — 2026-09-12

Optional source metadata/author key match server migration 35 and D-032. New
`src/types/source.ts` mirrors web/worker, `SourceIdentity.tsx` composes profile,
repository and author navigation with original media; `SourceText.tsx` renders
safe linkified Markdown. Carousel/reel text is now actionable. Inbox author URL
params feed the account-scoped API and query key, independently of categories.
Legacy original author headers remain clickable. Author grouping requires a
persisted key; future processing/cache hits populate it without a bulk backfill.
No native capability/configuration change. Existing deployed builds have no
runtime/channel for OTA; ship updated iOS production and Android preview builds.

## Unified reader — 2026-09-14

The paired `codex/unified-reader-ui` branch starts from `9719b96` and retains the
pending Google iOS/Android changes from the original checkout. The shared
`src/types/reader.ts` presentation contract is byte-identical to web. Native
Takeaways colors/card are now used by both apps; author profile and saved-author
navigation are separate, continuation is visible beside coverage, and full
research/text/notes remain accessible. Native notes use the existing PATCH
field. Explicit read/unread is available in the reader and inbox menus; opening
remains independent. Stored JPEG posters never enter video decoders. Actual OG
images supplement thumbnails, while favicons remain small source icons.

Validated in the local iPhone 16e iOS 26 simulator with synthetic fixtures,
including light/dark, long authors, author filtering, reading and continuation.
This is not a TestFlight release. See `docs/reader-ui-parity.md` for the paired
source audit, evaluation loop, verification and local launch configuration.

### Reader return navigation — 2026-09-14

The corrected return direction is left to right. Right-to-left does not close.
iOS delegates to native-stack interactive back in `app/(app)/_layout.tsx`;
`ReaderSwipe.tsx` disables its custom recognizer on iOS to avoid competition.
Other platforms recognize rightward movement from the leftmost 28px, coordinate
with the ScrollView, respect reduced motion and cancel short/reversed gestures.
Editing/expanded/embedded modes disable the custom gesture.

`app/(app)/item/[id].tsx` replaces its route when opening a related save so one
Back returns to the inbox/context. A missing previous screen falls back to inbox.
Ten logic/delegation scenarios pass in `npm run test:reader-navigation`.
Actual iOS Simulator navigation confirms related-save → Back → Inbox. Automated
physical drag delivery cannot be asserted: the tool sends down/up without
movement. No debug instrumentation remains. See `docs/reader-ui-parity.md`.

## Native signup consent — 2026-09-11

`app/(auth)/login.tsx` pushes `/(auth)/signup` explicitly from Create one. `app/(auth)/signup.tsx` shows email/password/confirmation followed by two unchecked, required acceptances: Terms of Service/Privacy Policy and third-party AI processing (Anthropic, OpenAI, Voyage AI, matching the web disclosure). Policy links are separate from the checkbox hit targets. Email and Google signup remain disabled until both are accepted. `src/components/auth/GoogleSignIn.tsx` forwards signup consent to the existing API without repeating the modal; new Google accounts initiated from login must accept both in the modal. The existing server version/timestamp records AI consent; terms acceptance is a client gate, with no new server field.

Validation: native typecheck and 26 simulated auth regression scenarios pass, including explicit signup navigation, both acceptance gates, mismatched passwords, policy URLs, network recovery and Google consent/session outcomes. The previously installed simulator build opens signup from Create one; the reported return to login was not reproduced there. The revised UI still needs device/build acceptance; no TestFlight update was published.


## Repository discovery and reading parity — 2026-09-13 (local)

Reels/YouTube and generic audio/video/TikTok transcripts now start collapsed,
using the existing accessible `CollapsibleSection`. Found sources start expanded;
candidates show “Possible match” and their reason. `ItemExploration.deep` mirrors
the optional existing server field so the CTA distinguishes research/exploration.
The shared server now researches named repositories without an owner and deepens
resolved semantic resource links. A sole resolved resource populates the existing
primary link; multiple resources remain independent semantic entries.

`npm run typecheck` passes. The server suite
`tests/unit/native-inbox-reading.test.tsx` renders the real native components with
platform adapters: three transcript expand/collapse scenarios and exact primary
URL opening/candidate uncertainty pass. This is not device validation.
`npm run test:ui-models` fails in its existing loader at `src/lib/chatSync.ts` with
`SyntaxError: Unexpected token ';'`; no chat implementation was changed here.
No deployment or binary/OTA distribution was performed. Server audit and limits:
`../Flowy/docs/repository-discovery.md`.


## 2026-09-14 — Deep Dive, enumeraciones generales y fondo de imágenes

Cambios locales coordinados con `../Flowy`: `src/types/reader.ts` unifica el CTA en
Deep Dive y muestra finalización/reintento/sin coincidencias; `src/types/semantic.ts`
incorpora `entries[].linkable` opcional y validado. Las enumeraciones generales del
extractor servidor v3 conservan pasos/ideas/ingredientes además de recursos. Las
entradas sin destino externo no muestran una promesa de enlace ni disparan búsquedas.
`ItemReader` también deja consultar resultados/notas cuando la investigación falla.

`src/components/inbox/ReaderImage.tsx` usa dos capas de la misma URL: cover desenfocado
como fondo y contain centrado para la imagen completa. Se aplica al hero de ItemReader,
MediaCarousel y los renderizadores de reels/carruseles. El frame del reel tiene altura
explícita para evitar que Yoga reduzca su ancho por la combinación aspectRatio/maxHeight.
No cambia la reproducción de vídeo ni requiere dependencias o prebuild nuevos.

Validación y límites finales se registran en `../Flowy/TESTING.md`; cambios preparados
localmente, sin distribución OTA/TestFlight ni re-procesamiento de datos existentes.

Validación de esta entrega: TypeScript nativo y once escenarios de componentes
nativos adaptados a DOM pasan (incluyen CTA de Deep Dive, reintento/finalización
de listas y entradas sin enlace). Metro compiló iOS. La comprobación visual del
lector en el simulador queda pendiente: el cliente volvió al servidor 8081 en
vez de mantener la sesión sintética aislada de 8082 y no completó el login.
La web sí fue inspeccionada a 390 y 1440px; no se afirma paridad visual probada en
dispositivo físico ni una publicación.


## 2026-09-14 — Resultados relacionados de Deep Dive (OpenMAIC)

El contrato semántico incorpora `entries[].searchResults` opcional (máximo cuatro
pares URL/título provenientes del buscador), separado de los enlaces canónicos.
`src/components/inbox/content/SemanticContent.tsx` muestra los títulos, dominios
y «Related search results» con incertidumbre explícita; `ExternalLink` mantiene
apertura y error accesibles. Los resultados pueden llegar mientras Deep Dive
continúa: el worker guarda checkpoints antes del análisis profundo. Tipos y
copy de lector permanecen idénticos a web/worker. Typecheck nativo y pruebas de
los componentes reales con primitivas adaptadas pasan. Cambios locales; no se
ha distribuido un build/OTA móvil por este cambio.

## 2026-09-14 — README contenido y enlaces con Impeccable

`src/components/inbox/content/SourceText.tsx` conserva el código y las tablas en
ScrollViews horizontales propios, limitados al ancho del lector. Los wrappers
de `CollapsibleSection.tsx` y `EnrichedSections.tsx` mantienen ese límite.
El nuevo `src/components/inbox/ResourceLink.tsx` comparte la presentación de
recursos semánticos y extractos: dominio, título de dos líneas con nombre
accesible completo, flecha externa y una fila pulsable de al menos 64px.
`content/SemanticContent.tsx` prioriza el enlace confirmado antes de la descripción;
los resultados relacionados son filas neutrales con incertidumbre explícita.
Se mantienen los colores y tipografías existentes en ambos temas.

TypeScript y exportación Expo iOS/Hermes pasan. Trece pruebas del componente
nativo real con adaptadores en `../Flowy/tests/unit/native-inbox-reading.test.tsx`
incluyen apertura de URLs, nombres accesibles completos y recuperación ante error.
Los adaptadores no comprueban el layout nativo del Markdown. La comprobación
visual nueva es de la web; este cambio móvil requiere un próximo build/OTA y
validación visual en dispositivo. No cambia el contrato API ni las capacidades.

Fuente publicada en `main`: `01807b72f5af0e898805b839758bb77b88fee673`.
Incluye estos ajustes de lectura y los cambios previos de Deep Dive e imágenes.
Esta publicación de código no distribuye un nuevo binario ni OTA.


## Original files and storage — 2026-09-14, paired worktrees

Branch `codex/document-storage-p0-p2` pairs with the server worktree
`Flowy-document-storage`. New binary saves reserve storage, PUT to signed R2
staging URLs and complete through the server. Expo, canonical iOS share template
and macOS uploader use the same contract; PDF/Office/video originals in the iOS
share extension are copied to temporary files and uploaded with URLSession
`fromFile`, avoiding base64 expansion and retaining native format hints; URL/text capture retains its existing
endpoints. Retries of a retained selection preserve upload request IDs. iOS
preserves mixed PDF/Office batches and explicitly rejects document/photo mixtures
and multiple videos. macOS validates all selected file sizes and the 100 MiB
combined limit before saving.

Readers list original files, sizes, analysis coverage, download links and retry
for incomplete extraction. Settings includes used/reserved/pending-deletion
storage. Defaults: images 5 MiB, PDFs 25 MiB, other files 50 MiB, 10 files / 100 MiB
per batch; quota derives from the server plan. See server `docs/file-storage.md`
for quotas, actual retention, public-bucket limits and deployment configuration.

Deploy server migration 38/hooks, worker binaries and web API before shipping
these client builds. The old server does not support the new direct-upload
protocol. This branch has not been released or merged.

Validation: native TypeScript; clean iOS prebuild; typecheck of the generated
Swift source; **Xcode simulator build of the ShareExtension target succeeded**
with code signing disabled; macOS shared uploader/loader Swift typecheck.
Generated bundle IDs/App Group remain `app.tryflowy.client.ShareExtension` /
`group.app.tryflowy`. No signing/provisioning/portal changes. Server-hosted tests
exercise the actual native originals component and binary API protocol with
synthetic transport. This does not claim a full app/device or TestFlight run.


## P3 retention and Storage UI — 2026-09-14

Continues the paired document-storage worktrees before merge. New native route
`app/(app)/storage.tsx` is linked from Settings and registered in the app stack.
`StorageUsage`, `StorageManager`, `StorageFileRow`, `StorageAction` and the inline
`FileRetentionPicker` implement capacity, search/sort/duplicates, text preview,
explicit retention saves and original-only removal with contextual confirmation.
Refresh preserves current rows and filters. OriginalFiles retains removed-source
metadata and text previews, and retries only when a source remains available.

API parity: GET storage/files, PATCH storage/preferences, PATCH/DELETE files/:id,
and GET files/:id/preview. Portable file types include availability, removal,
retention and preview metadata. Deploy server migration 39/hooks plus worker/web
first; preferences apply only to future documents unless edited per file.
Automatic removal requires complete extraction. Partial/error sources remain.

Local validation: clean prebuild and full iPhone 16e iOS 26.0 app + ShareExtension
Xcode build succeeded; native TypeScript and iOS Metro/Hermes export pass. The
actual native app was signed into the disposable local account and Storage's
Word body/table preview, options, removal cancellation and unsaved-policy close
were exercised, together with the duplicate empty state and light/dark themes. A NativeWind action-layout issue found visually was corrected.
This is focused simulator verification, not a full Share Sheet, VoiceOver, Dynamic
Type or physical-device acceptance run; use the server's manual checklist.

The generated extension points to loopback API/PB for QA; the canonical plugin
adds local-network permission only when both hosts are loopback, and Swift allows
HTTP upload URLs only in DEBUG on loopback. Production URLs still require HTTPS.
No signing/provisioning/Apple portal changes. No merge or deployment performed.

## Storage design loop — 2026-09-14

Three Impeccable iterations completed in the paired worktrees, reaching a weighted
self-assessment of 9.26/10 (target 9.2; maximum four iterations). Native file actions
now show Options, filename targets include accessible size/date, and the layout
uses less space before the file list. Extracted text has a clear heading, layout
notice, partial-analysis coverage and inline retry; retry results are announced.
Failed retention saves preserve the selection and offer another attempt without
claiming an unconfirmed server result. Header wrapping and secondary text were
checked with extra-extra-large preferred text size on iPhone 16e, iOS 26.0;
the simulator was restored to large afterward.

Native TypeScript and final iOS Metro/Hermes export pass. Actual Word body/table
preview and native accessibility tree were inspected. Full VoiceOver and physical
device acceptance remain manual. No server contract or native configuration change
in this refinement; no merge/deployment. See the paired server's
`docs/storage-design-review.md` and `docs/file-storage-manual-checklist.md`.


## Apple/Google consent parity — 2026-09-15

Login and signup share `src/components/auth/SocialSignIn.tsx`: existing accounts enter immediately; new accounts receive separate unchecked terms/privacy and AI-processing acceptances, then explicitly create the account. Apple is now present on iOS signup too. `src/components/auth/GoogleSignIn.tsx` remains a compatibility wrapper. Pending provider credentials remain in memory and clear on cancellation, failure, success or unmount. `src/lib/googleAuth.ts` also supports Apple's optional email and expired-token response. `scripts/test-google-auth.cjs` covers both providers, cancellation, one-time-code preservation, absent Apple email and duplicate/late requests.

The paired server `/api/auth/apple` now defers one-time-code exchange until the new-account consent check passes. Deploy that change before native distribution. No API shape, audience, entitlement, environment variable or dependency changed. Native TypeScript and iOS export pass; local component adapters cover 27 regression groups. No fresh physical-device Apple/Google authorization or TestFlight publication is claimed.

## Recipe reader — 2026-09-15

`src/components/inbox/content/RecipeContent.tsx` and the existing semantic reader
show ingredients and ordered preparation, original ingredient evidence and
half/double/triple quantities; +/- servings is available with a source yield.
`src/types/semantic.ts` mirrors server V1 optional recipe metadata and deterministic
fraction/range arithmetic. Quantities are view state; preparation is unchanged.
Requires server extractor revision 4 with `CONTENT_TEMPLATES_ENABLED=1` and new or
explicitly reprocessed content. No new native permission/API/migration. Local
TypeScript and component checks are separate from an iPhone run or TestFlight;
neither distribution nor a physical-device recipe check has been performed.

### Recipe design refinement with Impeccable — 2026-09-15

The recipe reader now separates a 48px serving stepper from its batch presets,
right-aligns ingredient quantities, and provides one Original quantities
expander. Preparation uses 16px/26px text, 20px section headings and a quiet
number column. Explicit `useResolvedColors` styles retain the native palette
and implement pressed, disabled, selected and expanded states. Unknown yields
retain the same control height. TypeScript and real-component tests with DOM
platform adapters pass; actual iPhone layout/VoiceOver remain unverified.


## 2026-09-16 — Instagram and approved iOS icon release

The user authorized a combined production iOS build and TestFlight submission. This release includes the native Instagram connection flow from `5a2f3ae` and the approved orange icon with the charcoal italic f and white dot. `icons/icon-1024.png` is the opaque 1024px iOS master; `assets/icon.png` mirrors it. Unrelated local changes are excluded. Typecheck, all six Instagram scenario groups, and clean iOS prebuild passed. Build, submission, and Apple availability must be recorded separately.

EAS accepted production iOS build **1.0.0 (29)** from commit `f07e2aa` on 2026-09-16: https://expo.dev/accounts/r3db3ard_85/projects/tryflowy/builds/6c4720ae-ab5b-4808-b6a2-2a69bef094d7 . Automatic submission is scheduled: https://expo.dev/accounts/r3db3ard_85/projects/tryflowy/submissions/66b8d765-f8b3-4447-80c0-8017f513d15a . This records the launch only; build completion, Apple processing and tester availability are not yet confirmed.
