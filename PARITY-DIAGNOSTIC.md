# Flowy Web ↔ FlowyApp (native) — Feature Parity Diagnostic

> **Scope:** Analysis only. No source changed except this file.
> **Date:** 2026-05-25
> **Web (source of truth):** `~/Documents/Projects/Flowy` (Next.js 15 + worker + PocketBase)
> **Native (lagging):** `~/Documents/Projects/FlowyApp` (React Native + Expo + iOS share extension)
> **Method:** Read `Flowy/CODEBASE_MAP.md` as the index, enumerated the web `/api/ingest` + auth/AASA contracts, then read the native ingest client, Swift share extension, auth, env, types, and iOS config. Every claim cites `file:line` in both repos. Unverifiable items are tagged `[unverified]`.

---

## 1. Executive summary

- **Native is ~2 release-cycles behind.** The web shipped CYCLE-13/14/15 (RAG v2 index, drive/pdf/file ingest, multi-photo, per-user dedup + cross-user URL cache, deep-research, Instagram deepening) after FlowyApp's last *capability* commit. FlowyApp's recent commits (`d63bbe5`, `4dfbb22`) are UI redesign, not contract catch-up — native drifted on **what it can ingest** while polishing **how it looks**.
- **The share extension cannot ingest 3 of the web's headline new sources at all.** The iOS activation rule (`FlowyApp/ios/ShareExtension/Info.plist:31-39`) only fires for **web URL, text, and a single image** — so **video / screen recording, multi-image, PDF, and generic-file** shares never even surface Flowy in the share sheet, regardless of what the Swift code supports. This is the single biggest functional gap.
- **In-app bulk URL import is broken against current web.** Native calls `POST /api/ingest/bulk` and `GET /api/import-batches/:id` (`FlowyApp/src/lib/api.ts:136-143`), but **neither route exists** in the web app today (web route tree under `Flowy/apps/web/app/api/` has only `ingest/route.ts`; web does bulk-add by looping single `/api/ingest` calls client-side). Every bulk import → 404.
- **Critical latent auth/Universal-Links risk: bundle-ID mismatch.** The native app ships bundle `app.tryflowy.client` (`FlowyApp/app.config.ts:3`), but the web SIWA verifier and AASA generator default to `app.tryflowy.app` (`Flowy/apps/web/lib/apple-auth.ts:39`, `.../apple-app-site-association/route.ts:8`, and `Flowy/CODEBASE_MAP.md:475`). If the server's `APPLE_CLIENT_ID` is the documented `app.tryflowy.app`, **Sign in with Apple 401s and Universal Links never validate.** `[unverified]` — depends on the actual Railway env value, which is not in either repo.
- **Several web features are present in the native UI as dead stubs.** "Deep dive / Explore & Enrich" renders a full 5-state button but is explicitly a visual stub with no API call (`FlowyApp/src/components/inbox/ExploreCTA.tsx:18-25`), because `FlowyApp/src/lib/api.ts` has **no explore method** (web exposes `POST /api/items/bulk/explore`).
- **Good news — what IS at parity:** core single-URL/image ingest, **chat (streaming + `x-items` citations)**, item read/patch/delete/retry, digests, push-token registration, and SIWA *initiation* all line up with the web contracts. Social-URL classification gaps in the extension are largely masked by the web's server-side auto-coercion (`Flowy/apps/web/app/api/ingest/route.ts:389-421`).

---

## 2. Capability parity matrix

Severity: 🔴 broken · 🟠 missing · 🟡 partial · 🟢 parity

### 2.1 Ingest sources / item types

| Capability | Web status | Native status | Gap | Evidence (web ‖ native) |
|---|---|---|---|---|
| `url` (web links) | Accepted | Share-sheet sends `url` | 🟢 | ingest `route.ts:11` ‖ `ShareViewController.swift:17,129` |
| `youtube` | Accepted | Classified + sent | 🟢 | `route.ts:13` ‖ `ShareViewController.swift:18,123` |
| `reddit` | Accepted | Classified + sent | 🟢 | `route.ts:16` ‖ `ShareViewController.swift:22,124` |
| `instagram` (`/p/`,`/tv/`,`/reel/`) | Accepted; also `/reels/`,`/stories/` | Classifies `/p/ /reel/ /tv/` only | 🟡 | `route.ts:76-88` ‖ `ShareViewController.swift:125-127` |
| `tiktok` | Accepted (coerced from url/video) | Sent as `video`; web coerces → tiktok | 🟢 (via coercion) | `route.ts:128-133,415-416` ‖ `ShareViewController.swift:128` |
| `pinterest`/`dribbble`/`linkedin`/`twitter` | Accepted (coerced from url) | LIVE ext sends `url`; web coerces | 🟢 (via coercion) | `route.ts:407-414` ‖ LIVE `ShareViewController.swift:16-24` (no cases) |
| `facebook` | Accepted (coerced from url/video) | LIVE ext sends `url`; web coerces | 🟢 (via coercion) | `route.ts:134-141,417-418` ‖ LIVE ext has no facebook detection |
| `drive` (Google Drive/Docs) | Accepted; coerced from url | Sent as `url`; web coerces → drive | 🟢 (via coercion) | `route.ts:148-151,419-420` ‖ `ShareViewController.swift:129` (falls to `.url`) |
| **single image / screenshot** | `raw_image` accepted | Sent (`raw_image`) | 🟢 | `route.ts:423-436` ‖ `ShareViewController.swift:261-270` |
| **multi-image** (`raw_images[]`, cap 10) | Accepted | Swift builds it, **but iOS rule caps image at 1** | 🔴 | `route.ts:44,425-430` ‖ Swift `:251-259` vs activation `Info.plist:33-34` |
| **receipt** (auto-promoted from screenshot) | Worker auto-promotes screenshot→receipt | Works (sends screenshot) | 🟢 | MAP `§4.2 image.processor` ‖ `ShareViewController.swift:253` |
| **video / screen_recording** | `raw_video`+`video_mime` accepted | Swift handles it, **but iOS rule blocks movies** | 🔴 | `route.ts:437-441` ‖ Swift `:301-324` vs activation `Info.plist:31-39` (no movie key) |
| **PDF** (`raw_pdf`/`raw_pdfs` ShareFile) | Accepted, cap 10 | **Not sent; not activatable** | 🔴 | `route.ts:48-58,363-371` ‖ no PDF code in Swift; `Info.plist` no file key |
| **generic file** (`raw_file`/`raw_files`) | Accepted, cap 10 | **Not sent; not activatable** | 🔴 | `route.ts:372-376` ‖ no file code in Swift; `Info.plist` no file key |
| **audio** | `audio` type accepted | **Not handled** | 🟠 | `route.ts:27` ‖ no audio path in Swift or `api.ts` |
| **email** (inbound alias) | `/api/inbound/email` + per-user alias | **Alias never surfaced in app** | 🟠 | `route.ts:29`, `account/alias/route.ts` ‖ no alias UI/field in native |
| in-app single ingest (JS `api.ingest`) | 19 types | TS type restricts to 5 | 🟡 | `route.ts:10-30` ‖ `src/types/index.ts:162` |
| **bulk URL import** | **No server endpoint** (client loops `/api/ingest`) | Calls non-existent `/api/ingest/bulk` + `/api/import-batches/:id` | 🔴 | web route tree (only `ingest/route.ts`) ‖ `api.ts:136-143`, `useBulkImport.ts:73` |

### 2.2 Ingest behavior

| Capability | Web | Native | Gap | Evidence |
|---|---|---|---|---|
| Per-user dedup (bump `save_count`, return `duplicate:true`) | Yes | Transparent to client (server-side) | 🟢 | `route.ts:570-595` ‖ n/a (server) |
| Cross-user URL cache (`cached:true`, `fromCache` job) | Yes | Transparent to client | 🟢 | `route.ts:605-672` ‖ n/a (server) |
| Social-URL auto-coercion | Yes | Relied upon to cover classify gaps | 🟢 | `route.ts:389-421` ‖ leveraged by `ShareViewController.swift:120-130` |
| Ingest response shape `{data:{id,status}}` | Yes | Parsed (`body.data ?? body`) | 🟢 | `route.ts:507` ‖ `api.ts:80-81` |

### 2.3 Auth / Universal Links

| Capability | Web | Native | Gap | Evidence |
|---|---|---|---|---|
| Email + password | `/api/auth/register` + PB authWithPassword | PB SDK authWithPassword + register | 🟢 | `auth/register/route.ts` ‖ `auth.ts:59-74`, `api.ts:145-149` |
| Sign in with Apple (request) | `/api/auth/apple` `{identity_token,email?}` → `{data:{token,userId,email}}` | Sends exactly that shape | 🟢 | `auth/apple/route.ts:9-12,114-118` ‖ `api.ts:157-161`, `login.tsx:57-85` |
| SIWA audience (`aud`) match | `aud` must equal `APPLE_CLIENT_ID` | App bundle `app.tryflowy.client` ≠ documented `app.tryflowy.app` | 🔴 `[unverified]` | `apple-auth.ts:38-47` ‖ `app.config.ts:3` |
| Google Sign-In | `/api/auth/google` | `api.authGoogle` exists, **no UI button** | 🟡 | `auth/google/route.ts` ‖ `api.ts:151-155`; `login.tsx` (no Google button) |
| AASA / Universal Links | appID = `TEAM.APPLE_CLIENT_ID`, paths `/item/* /chat /inbox /settings` | `applinks:tryflowy.app` set; bundle mismatch risk | 🟡 `[unverified]` | `apple-app-site-association/route.ts:6-31` ‖ `Flowy.entitlements`, `app.config.ts:5,28` |
| Shared Keychain token (app→extension) | n/a (native concern) | App group `group.app.tryflowy`, key `pb_auth` | 🟢 (internally consistent) | n/a ‖ `env.ts:19-20`, `ShareViewController.swift:11,43-54`, `Flowy.entitlements` |

### 2.4 Post-ingest features (inbox / chat / enrichment / digest)

| Capability | Web | Native | Gap | Evidence |
|---|---|---|---|---|
| Inbox grid/list + item detail | Yes | Yes (redesigned) | 🟢 | MAP `§3.3` ‖ `app/(app)/inbox.tsx`, `item/[id].tsx` |
| Chat (stream + `[[id]]` citations via `x-items`) | `{message,history}` → text stream + header | Sends + parses identically | 🟢 | `chat/route.ts:27-30` ‖ `api.ts:181-216` |
| Item delete / retry / patch | `/api/items/[id]`, `/retry` | `deleteItem`/`reloadItem`/`patchItem` | 🟢 | MAP `§3.2` ‖ `api.ts:105-122` |
| Bulk delete / reload | `/api/items/bulk/{delete,reload}` | `bulkDeleteItems`/`bulkReloadItems` | 🟢 | MAP `§3.2` ‖ `api.ts:124-134` |
| **Deep dive / Explore** | `/api/items/bulk/explore` (deep flag) | **UI stub, no API call** | 🟠 | `items/bulk/explore/route.ts` ‖ `ExploreCTA.tsx:18-25`, no method in `api.ts` |
| Auto-enrichment display (`exploration`) | Yes | Types + sections present (read-only) | 🟢 | MAP `§2.4` ‖ `types/index.ts:69-78`, `EnrichedSections.tsx` |
| Receipt detail rendering | `ReceiptContent` | `content/ReceiptContent.tsx` present | 🟢 | MAP `§3.3` ‖ `src/components/inbox/content/ReceiptContent.tsx` |
| Item-type coverage in UI | 19 ingest types | TS `ItemType` missing `facebook,tiktok,drive,file,email` | 🟠 | `route.ts:10-30` ‖ `types/index.ts:1-15` |
| Item actions available | delete, retry, share, deep-dive | open, reload, delete only | 🟡 | MAP `§3.3 ItemActionsMenu` ‖ `ItemActionsMenu.tsx:25,38-42` |
| Daily digest list / detail / settings | Yes | `listDigests`/`getDigest`/settings | 🟢 | MAP `§3.2` ‖ `api.ts:163-173`, `app/(app)/digest/*` |
| Push token registration | Worker reads `users.push_token` | Writes Expo token via PB | 🟢 | MAP `§2.1 step 9b` ‖ `usePushRegistration.ts:31-37` |

---

## 3. Ingest contract drift (web accepts ‖ native sends)

**Web `type` whitelist (19):** `url, screenshot, youtube, video, instagram, reddit, pinterest, dribbble, linkedin, twitter, tiktok, facebook, receipt, pdf, drive, file, audio, screen_recording, email` — `Flowy/apps/web/app/api/ingest/route.ts:10-30`.

**Web body fields accepted** (`IngestBody`, `route.ts:223-235`):
`raw_url, raw_image, raw_images[], raw_pdf{name,mime,data}, raw_pdfs[], raw_file{...}, raw_files[], raw_video, video_mime, source_url`.

**Native Swift share-extension `type` values emitted (LIVE):** `url, screenshot, youtube, video, screen_recording, reddit, instagram` — `FlowyApp/ios/ShareViewController.swift:16-24`.
**Native Swift payload fields sent:** `type, raw_url, raw_image, raw_images, raw_video, video_mime` — `ShareViewController.swift:26-33`. **Never sends `raw_pdf(s)`, `raw_file(s)`, `source_url`.**

**Native TS `IngestPayload` (in-app JS path):** `type ∈ {url,screenshot,youtube,video,screen_recording}`, fields `raw_url, raw_image, raw_images, raw_video, video_mime` — `FlowyApp/src/types/index.ts:162-170`.

### Concrete mismatches that change routing/behavior

1. **PDF & generic file: structurally impossible from native.** Web routes `type:'pdf'` via `raw_pdf(s)` and `type:'file'` via `raw_file(s)` (`route.ts:363-376`). Native has no `ShareFile` encoder anywhere, and the iOS activation rule (`Info.plist:31-39`) lacks a file UTType, so a shared PDF/doc never reaches the extension. **Result: web feature CYCLE-15 (drive/pdf/file) is unreachable from the share sheet.** 🔴

2. **Video / screen_recording: code exists, gate closed.** Swift builds a `screen_recording` payload with base64 `raw_video` (`ShareViewController.swift:301-324`) and web accepts it (`route.ts:437-441`), but `NSExtensionActivationRule` has **no `NSExtensionActivationSupportsMovieWithMaxCount`** (`Info.plist:31-39`) → Flowy doesn't appear when sharing a video. 🔴

3. **Multi-image: capped at 1 by the OS.** Swift collects up to `MAX_IMAGES=10` (`ShareViewController.swift:14,251-259`) and web caps at 10 (`route.ts:44`), but `NSExtensionActivationSupportsImageWithMaxCount=1` (`Info.plist:33-34`) prevents selecting >1 image for Flowy → Instagram-carousel-style multi-shot capture is effectively single-only. 🔴/🟠

4. **`source_url` never sent.** Web stores `source_url` distinct from `raw_url` and the cache-hit path prefers it (`route.ts:488-489,624-627`). Native omits it entirely; web falls back to `raw_url`, so this is **lossy but not breaking** (🟡).

5. **Instagram `/reels/` (plural) & `/stories/` not classified natively**, but web's `isInstagramReelUrl`/story coercion (`route.ts:81-100,389-394`) re-routes a `type:'url'` IG link → instagram. **Masked by coercion** (🟢), except a video-typed `/reel/` from native stays `video` by web's own rule (`route.ts:383`) — intended.

6. **Bulk import endpoints don't exist.** `api.ingestBulk` → `POST /api/ingest/bulk`, `api.getImportBatch` → `GET /api/import-batches/:id` (`api.ts:136-143`); web exposes neither (no such route files). Every native bulk import returns 404 → `useBulkImport` lands in `phase:'error'`. 🔴

---

## 4. Auth / Universal Links drift

- **Bundle ID mismatch (highest auth risk).**
  - Native main app: `app.tryflowy.client` (`FlowyApp/app.config.ts:3`); share-ext: `app.tryflowy.client.ShareExtension` (`withShareExtension.js:113`).
  - Web AASA + SIWA default/doc: `app.tryflowy.app` (`Flowy/apps/web/lib/apple-auth.ts:39`; `.../apple-app-site-association/route.ts:8`; `Flowy/CODEBASE_MAP.md:475,586`).
  - Apple stamps `aud = app bundle id` on the SIWA identity token. Web verifies `aud === APPLE_CLIENT_ID` (`apple-auth.ts:38-47`). If the server runs the documented `APPLE_CLIENT_ID=app.tryflowy.app`, the token's `aud=app.tryflowy.client` fails → `401 INVALID_APPLE_TOKEN`, and AASA `appID=TEAM.app.tryflowy.app` won't match the installed app's `TEAM.app.tryflowy.client` → Universal Links silently dead. **`[unverified]`** (true server env unknown from code). Either set `APPLE_CLIENT_ID=app.tryflowy.client` on the server **or** change the app bundle to `app.tryflowy.app` — they must agree.

- **AASA host matches.** Native associated domain `applinks:tryflowy.app` (`Flowy.entitlements`, `app.config.ts:5`) matches the web AASA host. AASA paths (`/item/* /chat /inbox /settings`, `apple-app-site-association/route.ts:18`) are reasonable; no native deep-link route map verified `[unverified]`.

- **App Group / Keychain — internally consistent, but docs stale.** App uses `group.app.tryflowy` end-to-end (`env.ts:19`, `Flowy.entitlements`, `ShareExtension.entitlements`, `ShareViewController.swift:11`). `CODEBASE_MAP.md:475` lists `group.tryflowy` — stale doc, **not** a functional break (the group is native-internal; web never reads it).

- **`APPLE_TEAM_ID` present natively** (`8C72ST495F`, `app.config.ts:6`); web AASA falls back to `TEAMIDMISSING` if its env is unset (`apple-app-site-association/route.ts:7`). Whether the **server** has the matching team id is `[unverified]`.

- **Prod env baked correctly, but committed share-ext Info.plist shows localhost.** `FlowyApp/.env` sets `EXPO_PUBLIC_API_BASE_URL=https://tryflowy.app` (`env.ts:6-7`), but the committed `ios/ShareExtension/Info.plist:5-6` still reads `http://localhost:4000`. The plugin regenerates it from the env var at prebuild (`withShareExtension.js:14,47,178-179`), so EAS prod builds are fine **iff** prebuild runs with the env set — a footgun if a build skips prebuild. 🟡

- **Google button missing.** `api.authGoogle` is implemented (`api.ts:151-155`) but `login.tsx` renders only email + Apple — no Google entry point. 🟡

---

## 5. Missing features — prioritized backlog

1. **Fix bulk URL import (or remove it).** 🔴 · **S** · Native's `useBulkImport`/`BulkImportSheet` target endpoints that don't exist. Either drop to client-side looping over `POST /api/ingest` (mirror `Flowy/apps/web/components/inbox/BulkAddBookmarksButton.tsx`) or add the server endpoints to web. Mirrors: `BulkAddBookmarksButton.tsx`, `SubmitBookmarkButton.tsx`. Files: `FlowyApp/src/lib/api.ts:136-143`, `src/hooks/useBulkImport.ts`.
2. **Open the share-extension activation rule for movies + files + multi-image.** 🔴 · **M** · Add `NSExtensionActivationSupportsMovieWithMaxCount`, a file/PDF UTType rule, and raise `…ImageWithMaxCount`. Edit the generator `FlowyApp/plugins/withShareExtension.js:182-195` (renderInfoPlist) so prebuild emits it. Without this, items 3-4 below can't be reached.
3. **Add PDF + generic-file capture to the Swift extension.** 🔴 · **M** · Build `raw_pdf(s)`/`raw_file(s)` `ShareFile{name,mime,data}` payloads. Web contract: `Flowy/apps/web/app/api/ingest/route.ts:48-58,363-376`. File: `FlowyApp/ios/ShareExtension/ShareViewController.swift`.
4. **Restore video/screen_recording sharing end-to-end.** 🔴 · **S** (after #2) · Swift path already exists (`ShareViewController.swift:301-324`); just needs the activation gate from #2.
5. **Wire Deep-dive/Explore to the API.** 🟠 · **M** · Add an `exploreMany(ids,{deep:true})` client + mutation; web: `Flowy/apps/web/app/api/items/bulk/explore/route.ts`, `apps/web/lib/items-actions.ts (exploreItems)`. File: `FlowyApp/src/components/inbox/ExploreCTA.tsx:18-25`, `src/lib/api.ts`.
6. **Resolve the bundle-ID/`APPLE_CLIENT_ID` mismatch.** 🔴 `[unverified]` · **S** · Align `app.config.ts:3` with the server `APPLE_CLIENT_ID` (verify Railway). Until confirmed, SIWA + Universal Links are at risk.
7. **Extend native `ItemType` + renderers for `facebook, tiktok, drive, file, email`.** 🟠 · **S-M** · `FlowyApp/src/types/index.ts:1-15`; add icons/labels so those items don't fall to a generic renderer. Web reference: `apps/web/lib/contentType.ts`, `components/inbox/content/*`.
8. **Surface the inbound-email alias.** 🟠 · **M** · Web mints a per-user `email_alias` (`apps/web/app/api/account/alias/route.ts`, `app/api/inbound/email/route.ts`); native never shows it. Add a settings row. File: `FlowyApp/app/(app)/settings.tsx`.
9. **Multi-image carousel ingest UX.** 🟠 · **S** (after #2) · Swift already collects arrays (`ShareViewController.swift:251-259`).
10. **Audio ingest.** 🟠 · **M** · Web accepts `type:'audio'` (`route.ts:27`); native has no path. Lowest priority — least-used source.
11. **Add Google sign-in button.** 🟡 · **S** · Client method exists (`api.ts:151-155`); add the button to `app/(auth)/login.tsx`.
12. **Add `share` + `deep-dive` to the item actions menu.** 🟡 · **S** · `FlowyApp/src/components/inbox/ItemActionsMenu.tsx:38-42` vs web `ItemActionsMenu` (delete/retry/share/explore).
13. **Reconcile the shadowed Swift template.** 🟡 · **S** · `withShareExtension.js:74-76` overrides the 11-type template with the committed 7-type `ios/ShareExtension/ShareViewController.swift`. Pick one source of truth (coercion currently masks the difference) to avoid future confusion.

---

## 6. Quick wins vs structural work

**Quick wins (S, low risk):**
- Fix/remove bulk import endpoints (#1).
- Confirm + align `APPLE_CLIENT_ID` ↔ bundle id (#6).
- Extend `ItemType` union + renderers (#7).
- Add Google button (#11) and `share`/deep-dive menu actions (#12).
- Pick one Swift share-extension source of truth (#13).

**Structural work (M+, needs native iOS build/test):**
- Re-open the share-extension activation rule and add PDF/file/movie/multi-image capture (#2-4) — the core of regaining CYCLE-15 ingest parity; requires Swift + `withShareExtension.js` changes and an EAS rebuild.
- Wire Deep-dive/Explore mutation + states (#5).
- Inbound-email alias surface (#8) and audio ingest (#10).

---

### Verification notes / unverified items
- `[unverified]` Server env values (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_WEB_CLIENT_ID`) are not in either repo — the SIWA/AASA breakage is conditional on the deployed values. Code-level mismatch (app bundle vs documented default) is confirmed; runtime impact is inferred.
- `[unverified]` Whether `expo prebuild` runs on every EAS profile (which regenerates the share-ext Info.plist + main entitlements) — the committed `ios/ShareExtension/Info.plist` localhost value would otherwise ship.
- `[unverified]` Native deep-link/route handling for AASA paths (`/item/*` etc.) — not traced in `app/` router.
- The 4 stale copies under `FlowyApp/.claude/worktrees/*` were **excluded**; only the live repo root was audited.
