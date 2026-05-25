# Flowy Native ↔ Web Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the remaining feature-parity gaps between FlowyApp (React Native + Expo) and the Flowy web app, so native ingests everything web `/api/ingest` accepts and exposes the same post-ingest features.

**Architecture:** Web (`~/Documents/Projects/Flowy`) is source of truth for server contracts. Native catches up in dependency order: fix what is *broken* against the live server, then *widen* the share-extension gate, add capture behind it, wire remaining UI. Env-dependent auth risks are *verified*, not blindly changed.

---

## ⚠️ DIAGNOSTIC IS 2 COMMITS STALE — re-audited 2026-05-25 against `origin/main`

`PARITY-DIAGNOSTIC.md` was written against **local `main` (`d63bbe5`)**, which is **2 commits behind `origin/main` (`961bbe8`)**. PR #5 (`e7dd67a feat: support PDFs and multi-select photos/files in share extension`) already landed several of its biggest 🔴 findings. Verified current status:

| Diag # | Finding | Diag said | **Actual on `origin/main`** | Action |
|--------|---------|-----------|------------------------------|--------|
| #2 | Activation rule for movie/file/multi-image | 🔴 missing | ✅ **DONE** — generator has `Movie`/`File`/`Image`MaxCount keys (`plugins/withShareExtension.js:190-194`) | none |
| #3 | PDF/file Swift capture | 🔴 missing | ✅ **DONE** — `ShareFile` + `raw_pdf(s)`/`raw_file(s)` (`plugins/shareExtensionTemplate/ShareViewController.swift:33,46-49,203-298`) | none |
| #4 | Video/screen_recording | 🔴 gate closed | ✅ **DONE** — gate open + `raw_video`/`video_mime` (`…ShareViewController.swift:370-372`) | none |
| #9 | Multi-image carousel | 🔴 capped at 1 | ✅ **DONE** — `MAX_IMAGES=10`, `raw_images` (`…ShareViewController.swift:14,234-247`) | none |
| #13 | "Committed Swift shadows 11-type template" | 🟡 reconcile | ❌ **OBSOLETE/INVERTED** — `ios/` is now gitignored (`.gitignore:45`); `plugins/shareExtensionTemplate/ShareViewController.swift` is the single source of truth. The planned fix would break prebuild. | **dropped** |
| #1 | Bulk import hits 404 routes | 🔴 broken | 🔴 **STILL BROKEN** — `api.ts:136-143` unchanged | **execute** |
| #7 | `ItemType` missing 5 types | 🟠 | 🟠 **STILL VALID** — union still 14 types | **execute** |
| #11 | No Google sign-in button | 🟡 | 🟡 **STILL VALID** — none in `login.tsx` | **execute** |
| #5,#6,#8,#10,#12 | Explore / bundle-ID / email alias / audio / menu actions | various | **not re-verified** (PR #5 was share-ext only; assume still valid) | follow-up |

**Net:** of the original 13, four 🔴 structural items (#2/#3/#4/#9) are already shipped, #13 is obsolete, and the safe-to-auto-execute set shrinks to **#1, #7, #11**.

---

# PHASE 0 — Safe quick-wins (auto-executed this session)

## Task 1 (#1): Fix broken bulk URL import — loop client-side over `/api/ingest`

**Why:** `api.ts:136-143` calls `POST /api/ingest/bulk` + `GET /api/import-batches/:id`; neither exists on web → every bulk import 404s. Web loops single `/api/ingest` calls with bounded concurrency (`Flowy/apps/web/components/inbox/BulkAddBookmarksButton.tsx:66-85,135-182`). Mirror it, preserving `useBulkImport`'s `{phase,batch,error,submit,reset}` contract so `BulkImportSheet` (reads `batch.processed/total/dead_count`) is untouched.

**Files:** `src/lib/api.ts` (remove dead methods), `src/hooks/useBulkImport.ts` (rewrite internals).

- [ ] Remove `ingestBulk` + `getImportBatch` from `api` and drop unused `ImportBatch`/`IngestBulkPayload`/`IngestBulkResponse` imports.
- [ ] Rewrite `useBulkImport` to run a `CONCURRENCY=4` worker pool over `api.ingest({type:'url',raw_url})`, emitting a synthetic `batch` (`{id:'local',status,processed,dead_count,total}`) so the sheet's progress UI keeps working; invalidate `['items']` on completion.
- [ ] `tsc --noEmit` → PASS. Commit: `fix(bulk-import): loop client-side over /api/ingest`.

## Task 2 (#7): Widen `ItemType` + glyphs for `tiktok, facebook, drive, file, email`

**Why:** Web has 19 types; native `ItemType` has 14. `typeGlyph: Record<ItemType,string>` is exhaustive → widening forces glyph additions at compile time.

**Files:** `src/types/index.ts` (`ItemType`), `src/lib/thumbnails.ts` (`typeGlyph`).

- [ ] Add `tiktok, facebook, drive, file, email` to `ItemType`.
- [ ] Add glyphs: `tiktok:'🎵', facebook:'📘', drive:'📁', file:'📎', email:'✉️'`.
- [ ] `tsc --noEmit` → PASS (exhaustiveness check). Commit: `feat(types): add tiktok/facebook/drive/file/email item types + glyphs`.

## Task 3 (#11): Google sign-in entry point on login

**Why:** `api.authGoogle` exists (`api.ts:151-155`); `login.tsx` renders only email + Apple. No native Google lib is installed in this no-rebuild session, so add a layout-parity button that surfaces a clear "being set up" message rather than adding a native dependency.

**Files:** `app/(auth)/login.tsx`.

- [ ] Add a "Continue with Google" `Pressable` below the Apple button; on press set an info message. (Upgrade to a real flow once `@react-native-google-signin/google-signin` or `expo-auth-session` is added — that needs a rebuild.)
- [ ] `tsc --noEmit` → PASS. Commit: `feat(auth): add Google sign-in entry point to login screen`.

---

# FOLLOW-UP (not auto-executed — need rebuild / device / Railway env)

- **#5 Explore wiring** — add `api.exploreMany(ids,{deep})` → `POST /api/items/bulk/explore`; wire `ExploreCTA.tsx` mutation. No rebuild. *Verify route shape first.*
- **#12 Item menu `share`+`deep-dive`** — `ItemActionsMenu.tsx`; depends on #5. No rebuild. Good next quick win.
- **#6 Bundle-ID vs `APPLE_CLIENT_ID`** — `[unverified]`, needs the Railway `APPLE_CLIENT_ID` value. App bundle `app.tryflowy.client` (`app.config.ts:3`) vs documented `app.tryflowy.app`. They must agree or SIWA 401s + Universal Links die. Branch on the env value.
- **#8 Inbound-email alias surface** — settings row fetching per-user alias. May need a client method.
- **#10 Audio ingest** — lowest priority; Swift audio UTType + in-app type.

---

## Self-review

- **Spec coverage:** every diagnostic item accounted for (done / executed / obsolete / follow-up — see status table).
- **Type consistency:** `useBulkImport` keeps return shape + `ImportBatch` field names `BulkImportSheet` reads; `typeGlyph` stays `Record<ItemType,string>`.
- **Correctness guard:** dropped #13 because its premise inverted on `origin/main` (committed `ios/` gitignored; template is source of truth) — executing it would break prebuild.
