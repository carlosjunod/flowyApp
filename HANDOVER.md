# FlowyApp — Parity Red-Priority Handover

> **Date:** 2026-05-28
> **Branch:** `fix/parity-red-priority`
> **Predecessor:** [`PARITY-DIAGNOSTIC.md`](./PARITY-DIAGNOSTIC.md) (2026-05-25)
> **Scope:** All 🔴 items from §5 of the diagnostic — bulk import 404, share-extension OS-level capability gates, video/PDF/file ingest, SIWA + Universal Links bundle-ID mismatch.
> **Out of scope (not touched):** 🟠 / 🟡 items (#5 Explore wiring, #7 ItemType expansion, #8 email alias, #10 audio, #11 Google button, #12 menu actions, #13 template reconciliation). See "Next session" below.

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
