# FlowyApp — Parity Red-Priority Handover

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
