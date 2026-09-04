# Detailed prompt — finish the FlowyApp parity rollout

> Copy-paste the section between the `---` markers to the next Claude session. Everything above the markers is human-facing context for you.

**When to use:** when you're ready to take the `fix/parity-red-priority` branch from "code merged" to "shipped TestFlight build verified end-to-end." This prompt assumes branch is already merged or about to be — code changes are done, only the Apple/EAS dance and physical-device verification remain.

**Prerequisite knowledge before pasting:**
1. Railway prod `APPLE_CLIENT_ID` is `app.tryflowy.app` (confirmed 2026-05-28).
2. The branch flipped the native bundle from `app.tryflowy.client` → `app.tryflowy.app`. That's a **new Apple App ID**, not just a rename — existing TestFlight installs won't auto-update.
3. Apple Developer Portal access is required (only you have it; Claude can't log in).
4. `~/Documents/Projects/FlowyApp` is the native repo; `~/Documents/Projects/Flowy` is the web/worker/PocketBase monorepo.

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

# Begin paste

I just merged `fix/parity-red-priority` on `~/Documents/Projects/FlowyApp` which:
- Flipped the native iOS bundle ID from `app.tryflowy.client` → `app.tryflowy.app` so Sign in with Apple and Universal Links work against the Railway prod `APPLE_CLIENT_ID=app.tryflowy.app` (confirmed).
- Opened the share-extension `NSExtensionActivationRule` to also handle movies, PDFs, generic files, and multi-image carousels (up to 10).
- Added Swift loaders for PDF (`UTType.pdf`) and generic-file (`UTType.data`) shares with the web's `ShareFile{name,mime,data}` body shape.
- Replaced the dead bulk-import path (was calling non-existent `/api/ingest/bulk` + `/api/import-batches/:id`) with a client-side concurrent loop over `POST /api/ingest`, mirroring the web's `BulkAddBookmarksButton`.

Read `~/Documents/Projects/FlowyApp/HANDOVER.md` for the full file-by-file changelog. Read `~/Documents/Projects/FlowyApp/PARITY-DIAGNOSTIC.md` for the audit those changes resolve (specifically §5 items 1, 2, 3, 4, 6 — all 🔴).

I need help finishing the rollout. Specifically:

## Phase A — Verify the server side hasn't drifted

1. Use `mcp__Railway__list_variables` to confirm both `APPLE_CLIENT_ID` and `APPLE_TEAM_ID` are set on the Flowy web service. Expected: `APPLE_CLIENT_ID=app.tryflowy.app`, `APPLE_TEAM_ID=8C72ST495F`. If `APPLE_TEAM_ID` is missing, AASA will serve `TEAMIDMISSING.app.tryflowy.app` and Universal Links will silently fail — call this out.
2. Verify the live AASA endpoint:
   ```bash
   curl -sI https://tryflowy.app/.well-known/apple-app-site-association | grep -i content-type
   curl -s https://tryflowy.app/.well-known/apple-app-site-association | jq '.applinks.details[0].appID, .webcredentials.apps'
   ```
   Expect `appID = "8C72ST495F.app.tryflowy.app"` (NOT `...client`). If it's still `.client`, the env var hasn't deployed — check Railway deployment status.

## Phase B — Walk me through Apple Developer Portal

I have admin access to the team. Generate a step-by-step ordered checklist (with the specific URLs and capability names to enable) for:
1. Registering App ID `app.tryflowy.app` — capabilities: Sign in with Apple, Associated Domains, App Groups (`group.app.tryflowy`), Keychain Sharing.
2. Registering extension App ID `app.tryflowy.app.ShareExtension` — capabilities: App Groups (`group.app.tryflowy`), Keychain Sharing.
3. Creating a new App Store Connect app record under `app.tryflowy.app` (the old `.client` one, if any, cannot be renamed).
4. Optional cleanup: retiring `.client` App IDs.

Use the actual Apple developer portal URL paths (developer.apple.com/account/resources/identifiers/list etc.) and name the exact checkbox labels — I want to click through it without second-guessing.

## Phase C — Rebuild via EAS

1. From `~/Documents/Projects/FlowyApp`, regenerate `ios/`:
   ```bash
   rm -rf ios
   pnpm dlx expo prebuild --platform ios --clean
   ```
2. Verify the prebuild's `ios/ShareExtension/Info.plist` contains:
   - `NSExtensionActivationSupportsImageWithMaxCount = 10`
   - `NSExtensionActivationSupportsMovieWithMaxCount = 1`
   - `NSExtensionActivationSupportsFileWithMaxCount = 10`
   - `API_BASE_URL = https://tryflowy.app` (NOT localhost)
   - `CFBundleDisplayName = Tryflowy`
3. Verify `ios/ShareExtension/ShareViewController.swift` matches the template (`diff -q` the two files — should be in sync).
4. Reset credentials and trigger an EAS preview build:
   ```bash
   pnpm dlx eas credentials --platform ios   # reset, let EAS regenerate for app.tryflowy.app
   pnpm dlx eas build --platform ios --profile preview
   ```
5. Watch the build log for: (a) bundle id `app.tryflowy.app` everywhere (no leftover `.client`), (b) the extension target signing with `app.tryflowy.app.ShareExtension`, (c) no provisioning errors.

## Phase D — Physical-device smoke test

Run through §3 of HANDOVER.md (9 tests). I'll do the tapping; you tell me what to verify in each step (which UI elements, which logs to check). For Universal Links specifically: after fresh install, wait ~15 min then test `https://tryflowy.app/item/<some-real-item-id>` from Notes — confirm the app opens, not Safari.

If any test fails, debug systematically: check the network log first (Charles or `xcrun simctl spawn booted log stream --predicate 'subsystem contains "flowy"'`), then PocketBase logs via `mcp__Railway__get_logs`, then the worker, then the share-extension Swift logs (filter: `[flowy.share]`).

## Phase E — Commit & PR

When green:
1. Commit on `fix/parity-red-priority` in the suggested 4-commit split from HANDOVER.md §5.
2. Open a PR with a body that references PARITY-DIAGNOSTIC.md, summarizes the 5 fixed items, and includes the AASA `curl` output + screenshots of the 9 smoke tests.

## What I want from you

- Drive each phase explicitly. Ask before destructive commands (`rm -rf ios`, `eas credentials --rm`).
- Use Railway MCP, not guessed configs.
- If anything contradicts HANDOVER.md, flag the contradiction — don't paper over it.
- Don't touch the 🟠/🟡 items in HANDOVER §4 — they're a separate cycle.

# End paste

---

## Operator notes (don't paste)

- The Railway MCP tools you'll need: `mcp__Railway__list_variables`, `mcp__Railway__get_logs`, `mcp__Railway__list_deployments`. Authenticate first via the standard flow.
- If the next-session Claude says "I'll skip Apple Developer Portal steps" — push back. The portal work is the actual unblock; the code is already done.
- Tag the work `[CYCLE-16-parity]` if you're tracking against CYCLES.md conventions (web side uses these, FlowyApp does not yet).
- Estimated total wall-clock: 90 min if no provisioning surprises. 3-4 hrs with surprises.
