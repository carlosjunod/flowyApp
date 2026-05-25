# Flowy Native ↔ Web Parity — What's Left & Recommendations

> Companion to `2026-05-25-flowy-native-parity.md`. Captures the state **after** the Phase-0 safe items were shipped, and recommends what to do next and in what order.
> **Base:** `origin/main` @ `961bbe8` + this branch's 4 commits. **Date:** 2026-05-25.

---

## TL;DR

The diagnostic's four biggest 🔴 items (movie/PDF/file/multi-image share-extension capture) were **already shipped** in PR #5 before the diagnostic was written. This branch fixes the 3 remaining safe gaps (#1 bulk import, #7 item types, #11 Google button). **Five items remain**, none of them blocking day-to-day use. Recommended next sprint: **#5 → #12** (one no-rebuild PR), then **#6** (5-min env check that de-risks all of Sign in with Apple), then defer #8/#10.

---

## ✅ Done (no action)

| # | Item | Where |
|---|------|-------|
| #2 | Share-ext activation rule (movie/file/multi-image) | `plugins/withShareExtension.js:190-194` (PR #5) |
| #3 | PDF + generic-file Swift capture | `plugins/shareExtensionTemplate/ShareViewController.swift:33,46-49,203-298` (PR #5) |
| #4 | Video / screen_recording | same file `:370-372` (PR #5) |
| #9 | Multi-image carousel | same file `:14,234-247` (PR #5) |
| #1 | Bulk URL import (client-side loop) | this branch |
| #7 | `ItemType` + glyphs for 5 types | this branch |
| #11 | Google sign-in entry point | this branch |

## 🗑 Dropped

- **#13** — premise inverted on `origin/main`. `ios/` is now gitignored (`.gitignore:45`) and `plugins/shareExtensionTemplate/ShareViewController.swift` is the single source of truth. The diagnostic's "make the committed file canonical" fix would throw at prebuild. **No action — already effectively resolved.**

---

## ⏭ Remaining work (recommended order)

### 1. #5 — Wire Deep-dive / Explore to the API · **M · no rebuild · DO NEXT**
**Why:** `ExploreCTA.tsx:18-25` renders a full 5-state button that calls nothing; `api.ts` has no explore method. This is the most visible dead stub in the app.
**Recommendation:**
- Add `api.exploreMany(ids, { deep }) → POST /api/items/bulk/explore`. **Verify the exact request/response shape first** against `Flowy/apps/web/app/api/items/bulk/explore/route.ts` + `apps/web/lib/items-actions.ts (exploreItems)` — do not assume the body is `{ids,deep}`.
- Drive `ExploreCTA`'s existing states from a TanStack `useMutation` (`isPending`/`isError`/`isSuccess`); invalidate `['items']` on success.
**Risk:** Low. Pure TS. **Effort:** ~half a day incl. shape verification.

### 2. #12 — `share` + `deep-dive` in the item actions menu · **S · no rebuild · BUNDLE WITH #5**
**Why:** `ItemActionsMenu.tsx:38-42` only has open/reload/delete; web also has share + deep-dive.
**Recommendation:** Add RN `Share.share({ url })` for share, and reuse #5's `exploreMany([id], { deep: true })` for deep-dive. Land in the **same PR as #5** since deep-dive depends on it.
**Risk:** Low. **Effort:** ~1-2 hrs after #5.

### 3. #6 — Bundle-ID vs `APPLE_CLIENT_ID` · **S · `[unverified]` · DO THE 5-MIN CHECK SOON**
**Why:** App bundle is `app.tryflowy.client` (`app.config.ts:3`); web SIWA/AASA default to `app.tryflowy.app`. Apple stamps `aud = bundle id`; web verifies `aud === APPLE_CLIENT_ID`. If they disagree in prod, **Sign in with Apple 401s and Universal Links silently never validate.** This is a latent prod auth bug, not a feature gap.
**Recommendation (do this first if SIWA matters for launch):**
1. Read Railway `APPLE_CLIENT_ID` for the Flowy web service (5 min).
2. If it equals `app.tryflowy.client` → fine, confirm AASA `appID` matches and move on.
3. If it equals `app.tryflowy.app` → set Railway `APPLE_CLIENT_ID=app.tryflowy.client` (cheapest — one env var) **or** change the native bundle (heavier — new provisioning profile + rebuild). They must agree.
4. Verify: `curl -sI https://tryflowy.app/.well-known/apple-app-site-association | grep -i content-type` → `application/json`, and the JSON `appID` is `TEAMID.<chosen-bundle>`.
**Risk of ignoring:** High if you rely on SIWA / Universal Links. **Effort:** 5 min to diagnose, 5 min to fix (env path).

### 4. #8 — Surface the inbound-email alias · **M · DEFER**
**Why:** Web mints a per-user `email_alias` (`Flowy/apps/web/app/api/account/alias/route.ts`, `app/api/inbound/email/route.ts`); native never shows it, so users can't use email-to-inbox on mobile.
**Recommendation:** Add a client method to fetch the alias + a settings row in `app/(app)/settings.tsx` with copy-to-clipboard. No rebuild. Defer behind #5/#12 — it's a convenience, not a broken feature.
**Effort:** ~half a day.

### 5. #10 — Audio ingest · **M · DEFER (lowest priority)**
**Why:** Web accepts `type:'audio'`; native has no path. Least-used source.
**Recommendation:** Needs a Swift audio UTType branch (the activation gate already allows files) + in-app type plumbing + an EAS rebuild. Only do this if audio shows real demand.
**Effort:** ~1 day incl. device testing.

---

## 🧹 Housekeeping (trivial, fold into the #5 PR)

- **Remove dead bulk types.** After #1, `IngestBulkPayload` and `IngestBulkResponse` in `src/types/index.ts` are unused exports. `ImportBatch` is still used by `useBulkImport` — keep it. Delete only the two unused ones.
- **`source_url` not sent from native** (diagnostic §3.4, 🟡 lossy not breaking). Web falls back to `raw_url`. If you want exact web parity on cache-hit attribution, have the Swift extension send `source_url`. Low value.

---

## Recommended next PR (single, no-rebuild)

> **"Native parity: explore + item actions"** — #5 + #12 + the housekeeping cleanup. One reviewable PR, pure TS, no EAS rebuild, knocks out the last *user-visible* gaps. Then handle #6 as a standalone 5-minute env verification.

EAS-rebuild / device-testing work (#10, and any SIWA bundle change under #6) should be batched into a separate "native build" cycle so you only rebuild once.
