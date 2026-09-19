# Tryflowy — React Native client

Universal AI-powered inbox client for iOS, Android and macOS (Mac Catalyst). Built with Expo bare workflow + TypeScript strict + nativewind.

Users save URLs, screenshots, short videos, PDFs and files from the iOS/macOS share sheet or Android's system share menu; a separate backend processes them with Claude; this app presents the inbox and a natural-language chat over it.

## Features

- **Categories and tags** — shared two-row counted-chip picker below search and in Manage labels, with compact sort/settings/expand icons, expandable list, A–Z / Most saved order, exact combined filters, and global rename/delete with affected-publication confirmation. Requires the server `GET/POST /api/labels` route and PB label transaction hooks deployed first. No native dependency or entitlement change. Validate with `node scripts/test-labels.cjs` and `npm run typecheck`.

- **Inbox** — compact list by default, optional visual grid, global debounced search/category facets through `GET /api/items`, newest-first pagination, separate network/empty/processing/error states, accessible selection, and PocketBase realtime invalidation
- **Personalization** — optional profile shared with the web app: work, current focus and preferences; edit, pause or clear from Settings, with an orange full-width interview reminder above Inbox and Chat. The server uses enabled answers in future chats. See [docs/PERSONALIZATION.md](docs/PERSONALIZATION.md).
- **Chat** — streaming responses with inline `[[itemId]]` citations and expandable sources, account-scoped on-device conversation history and drafts, new/open/delete conversation, stop/retry/copy, and reader-controlled scrolling. A provider above the tabs retains work while navigating inside the app.
- **Item detail** — title-first hierarchy, compact expandable media, original-source access, readable receipt rows/totals, secondary analysis/tags disclosure, contextual actions and keyboard-safe editing
- **Native sharing** — iOS + Mac Catalyst uses a native share extension; Android receives `ACTION_SEND` / `ACTION_SEND_MULTIPLE`. Both accept links, images, videos, PDFs and files and send authenticated payloads to `/api/ingest`.
- **English and Spanish** — the whole interface, including alerts and accessibility labels. The language follows the device by default (any Spanish variant resolves to one neutral Spanish) and can be set explicitly from the login/signup screens or Settings. Saved content, notes and AI answers keep the language they were written in, and the digest report language stays a separate setting. See [docs/I18N.md](docs/I18N.md).
- Auth via PocketBase email/password, token persisted to shared Keychain so the extension can read it

## Responsive layout

iPhone remains portrait-only. iPad portrait keeps the same navigation with a denser inbox; sufficiently wide landscape windows show the Inbox list/grid beside its item reader, or Inbox beside Chat when the Chat tab is active. Window size, safe areas and text scale drive the layout. Orientation changes require a native rebuild. See [adaptive layout and local acceptance](docs/RESPONSIVE-LAYOUT.md), including the remaining iPhone Duo integration boundaries.

## Requirements

- Node 20+
- Xcode 16+ (for iOS / Mac Catalyst builds)
- CocoaPods (`sudo gem install cocoapods` or via Homebrew)
- A real Apple Developer team with the App Group `group.app.tryflowy` registered, for signing + share-extension Keychain sharing on a device

## Environment variables

Copy `.env.example` to `.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000   # Next.js API host
EXPO_PUBLIC_PB_URL=http://localhost:8090         # PocketBase host
EXPO_PUBLIC_R2_PUBLIC_URL=https://files.tryflowy.app
```

All three are read at runtime via `process.env.EXPO_PUBLIC_*`. `EXPO_PUBLIC_API_BASE_URL` is also baked into the Share Extension's `Info.plist` (`API_BASE_URL` key) at `expo prebuild` time.

## Install & run

```bash
npm install
cp .env.example .env
# Edit .env so the three URLs point to your dev (or production) backend
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
npx expo run:ios
```

### Android sharing

Android sharing requires a development or release build; Expo Go cannot load the
native intent receiver. After installing dependencies, generate and run the
native project with `npx expo prebuild --platform android --clean` followed by
`npm run android`. Share a link, image, video, PDF or file from another app and
select **Flowy**. The app opens and queues the item once the signed-in session
has hydrated.

For Mac Catalyst: open `ios/Tryflowy.xcworkspace`, select the Tryflowy target, and run on **My Mac (Mac Catalyst)**. `SUPPORTS_MACCATALYST=YES` is already set by the `withShareExtension` config plugin.

### Physical iPhone development

This project uses Expo SDK 54. Expo Go for SDK 57 cannot open it on a physical
iPhone; use the included `expo-dev-client` development build. Connect and trust
the iPhone, enable Developer Mode, then run `npm run ios -- --device` to build
and install. For later JavaScript changes, run
`npm run start -- --dev-client --lan` and open the server in the installed Flowy
development app. Keep the phone and Mac on the same network.

Give each worktree its own `node_modules` directory. Linking the entire directory
to another checkout makes Expo resolve `expo-router/entry` outside the project,
which can produce an invalid development bundle URL. After replacing such a
link, restart Metro with `--clear` and reopen the development app.

Signing requires development profiles for both `app.tryflowy.client` and
`app.tryflowy.client.ShareExtension`, including their existing App Group. If
profiles are missing, Xcode can provision the generated workspace with automatic
signing and `-allowProvisioningUpdates`; an unregistered device also requires
`-allowProvisioningDeviceRegistration`. Keep generated `ios/` files uncommitted.
For a local API, use the Mac's LAN address in `.env`; `localhost` on the phone
refers to the phone itself. Testing synchronized history also requires the paired
server's chat-history routes and PocketBase migration.

## Project layout

```
/
├── app/                              # expo-router screens
│   ├── _layout.tsx                   # root providers
│   ├── index.tsx                     # auth gate
│   ├── (auth)/_layout.tsx
│   ├── (auth)/login.tsx
│   ├── (app)/_layout.tsx             # tab bar / sidebar
│   ├── (app)/(tabs)/inbox.tsx
│   ├── (app)/(tabs)/chat.tsx
│   └── (app)/item/[id].tsx
├── src/
│   ├── components/
│   │   ├── inbox/  ItemCard  ItemRow  ItemDetailRow  FilterBar
│   │   ├── chat/   ChatWindow  ChatMessage  ChatInput  Citation
│   │   └── ui/     Button  Spinner  Badge  Thumbnail
│   ├── lib/        pb.ts  api.ts  auth.ts  env.ts  secureStore.ts  thumbnails.ts  relativeDate.ts  viewMode.ts
│   │   └── i18n/   locale  dictionary  translate  format  device  storage  LocaleProvider  dictionaries/{en,es}
│   ├── hooks/      useItems.ts  useItemStatus.ts  useChat.ts
│   └── types/      index.ts
├── plugins/
│   ├── withShareExtension.js                 # Expo config plugin
│   └── shareExtensionTemplate/
│       └── ShareViewController.swift         # copied into ios/ShareExtension/ on prebuild
├── app.json
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
├── tsconfig.json
└── BLOCKERS.md                        # environment notes & decisions
```

## Data contracts

This client talks to an existing backend — endpoints are hit as documented in `starthere.md`:

- `GET /api/items?q=&category=&sort=date&direction=desc&page=1&perPage=20` for the inbox. It returns `{data:{items,page,perPage,totalItems,totalPages,categories},error:null}`. Categories are normalized (`tech` → `technology`); search/facets cover the complete account library.
- `pb.collection('items').subscribe(id, cb)` for realtime status updates
- `POST /api/ingest` for share-extension uploads (`{type, raw_url, raw_image}`)
- `GET/PUT/DELETE /api/profile/personalization` for the explicit account profile, with revision-checked writes and clear. See `docs/PERSONALIZATION.md`.
- `POST /api/chat` streams plain text; `x-items` response header carries JSON citations
- `PATCH /api/items/:id` and `DELETE /api/items/:id`

All REST calls go through `src/lib/api.ts`, which returns `{ data, error }` with typed error codes and never throws.

## Share extension

- Target: `ios/ShareExtension/` — auto-generated by `plugins/withShareExtension.js` on `expo prebuild`
- Entitlements: App Group `group.app.tryflowy`, keychain access group `$(AppIdentifierPrefix)group.app.tryflowy`
- Activation rule: 1 URL, up to 10 images/files, one video, or text
- Classifier: `youtube.com` / `youtu.be` → `youtube`, `tiktok.com` / `instagram.com` → `video`, any other URL → `url`, images → `screenshot` with base64-encoded JPEG (`compressionQuality 0.85`)
- Auth: reads `pb_auth` from shared Keychain written by the main app
- Presentation: warm paper / dark graphite follows **the system appearance**, independently of the main app’s theme override. Instrument Serif is bundled in the extension. The check fades in over 320ms from 105% scale and −8° rotation, with a 280ms content entrance, 220ms stage transitions, and a 180ms dismissal. The bare check sits inside fine rings with an 18-second orbiting dot; the background glow drifts through a 24-second breathing cycle. Reduce Motion holds both still and removes spatial transitions.
- Each share selects one of ten short success phrases at random, excluding the last selection; it stays fixed throughout that share. The selection is local and independent of the shared content.
- Signed-out and expired-session shares (HTTP 401) show a dedicated **Sign in to keep this** screen, explain how to sign in and share again, and explicitly say the item is not saved. It stays open until dismissed. Annotation-session failures keep the draft and distinguish the already-saved item from unsaved edits. Raw HTTP response bodies are never displayed.
- A successful ingest starts a five-second progress bar. Any touch (even during upload), editing, VoiceOver, or app interruption permanently cancels auto-close for that share. Upload and error screens never auto-close.
- After saving, pull the confirmation screen down to close manually, even after the timer has been cancelled. A small grabber hints at the gesture; the sheet follows the finger and springs back after a short or cancelled pull. Swiping is disabled during upload and annotation editing, and yields to content scrolled away from the top. The close button remains available, with the existing unsaved-draft confirmation.
- **Add tags or a note** opens tags, then **Next** opens the note editor. Both steps can save and close. Existing annotations are loaded from the configured `EXPO_PUBLIC_PB_URL`; changes use `PATCH /api/items/:id`. Save failures retain the draft, and closing a modified draft asks before discarding it. Notes are also visible in the mobile item detail.
- Native tag limits match the PATCH API (20 tags, 64 characters each); notes use the existing dedicated `notes` field (100,000 characters), never the AI summary.
- Server companion: `worker/src/lib/finalize.ts` in Flowy preserves existing tags during processing and sends only processor-generated tags to the cross-user extract cache. Deploy that worker change alongside the native release.
- The Swift template is always authoritative, including incremental prebuilds; an old generated `ios/ShareExtension` copy no longer overrides it.

### Swipe dismissal validation (2026-09-10)

The native fixture checks pass, including gesture thresholds and editing protection. A clean Expo prebuild reproduces the template exactly, and the generated ShareExtension target builds for the iOS simulator without signing. Physical swipe feel and cancellation still need an iPhone check; simulator automation did not reliably inject dragging. This change requires a new native build.

### Share-sheet validation (2026-09-08)

Run `scripts/test-share-extension.sh --test` with a booted iOS simulator. It compiles the actual Swift template into a separate preview app, intercepts every HTTP request with fixtures, and checks swipe eligibility, distance/velocity thresholds and cancelled pulls, countdown/cancellation, tag limits, ingest receipt parsing, annotation merging, note persistence, failed-save draft retention, retry, and unchanged saves. `--countdown`, `--notes`, `--signed-out`, and `--error` open corresponding visual states. This harness never sends data to production.

Verified: clean and incremental Expo prebuild, generated-template equality, unsigned iOS simulator extension build, native fixture checks, mobile TypeScript check, and visual interaction in an iPhone 16e simulator (light/dark live switching, tags → notes, and software keyboard). Signed device sharing/authentication and live backend persistence still require a release/device check. This is native code: an OTA JavaScript update alone does not install the new share extension.

## Scripts

```
npm run start        # expo start (dev server)
npm run ios          # expo run:ios
npm run typecheck    # tsc --noEmit — also the EN/ES dictionary parity gate
npm run test:ui-models # Node regression scenarios using the real TS models
npm run test:i18n    # locale core + dictionary parity + provider/screen scenarios
npm run prebuild     # re-apply config plugins to ios/
```

`test:i18n` is the aggregate; the three parts can be run on their own as
`test:i18n-core`, `test:i18n-parity` and `test:i18n-screens`.

## Test plan

- [ ] `npm run typecheck` → exits 0
- [ ] `npx expo run:ios` → app launches in Simulator
- [ ] Login with valid PocketBase credentials → lands on inbox
- [ ] Inbox: grid / list / detail toggles, search debounces, category pills filter, sort controls work, "Load more" appends, pull-to-refresh refetches
- [ ] Tap item → detail shows, edit modal saves, delete confirms and removes
- [ ] Chat: send a question → tokens stream in, citations render as cards + numbered chips that navigate to item detail
- [ ] Share extension: enable for Safari & Photos, share a URL → inbox shows a new pending item within ~3 s that transitions to `ready`

## Notes

- See `BLOCKERS.md` for environment limitations encountered during scaffolding and all autonomous design decisions.
- The generated `ios/` folder is git-ignored (managed workflow convention). Run `expo prebuild` after cloning.


## Inbox/chat update (2026-09-07)

- Saving a single link and a batch share the **Save links** sheet. Closing it keeps an active batch running while the screen remains mounted; reopening shows results and failed URLs can be retried. Successful submissions mean saved/queued, not finished AI processing.
- Chat is scoped to the signed-in PocketBase account and this device. `src/hooks/useChat.ts` owns the provider; `src/lib/chatModel.ts` validates stored conversations and marks restored streams interrupted; `src/lib/chatStorage.ts` writes small Unicode-safe Keychain chunks with a manifest published last and serialized writes. Storage failures are visible; loading failure does not overwrite existing history. Account deletion also removes local chat history.
- New chat retains the old conversation. Stop/retry uses a run identity so late tokens or finalizers cannot overwrite a newer response. Citation metadata is surfaced before the first text token without changing the server stream contract.
- Tab navigation remains available at tablet/desktop widths. The Chat tab indicates active work/new replies while navigating within Flowy. There is no cross-device chat sync or guarantee of continued execution while iOS/Android suspends the app. Reopening restores an interrupted response for retry.
- Removed the nonfunctional AI suggestion hero from Inbox and removed the fixed-tag suggestion renderer (`src/components/inbox/TagSuggestions.tsx`). No artificial takeaways are supplied when analysis data is missing.
- `scripts/test-ui-models.cjs` runs 18 regression scenarios for search parameters/cache isolation, history restoration, draft/retry behavior, early citations, stale stream protection, and atomic/account-scoped local storage. This is model validation, not a simulator or device UI test.
- Verified locally: `npm run typecheck`, `npm run test:ui-models`, and `git diff --check`. Native visual checks (keyboard, VoiceOver, Dynamic Type, real network suspension, 390pt and tablet layouts) remain device validation; no native E2E success is claimed.


## TestFlight — integrated September 7–8 build

Run from this repository after pulling `main`:

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

`production` uses remote build numbering with `autoIncrement`, the production Flowy endpoints and App Store Connect app `6762985360` (native bundle `app.tryflowy.client`). EAS builds the current source and submits the result to TestFlight. Apple/EAS credentials must be available to the signed-in Expo account. This command does not submit an App Store release for review.

This integration includes the September 7–8 inbox/chat/history and retrieval compatibility work, daily/weekly digest readers and settings, semantic content templates V1/V1.1, and the animated share extension with system appearance, tags, notes and sign-in recovery. Generated `ios/` and `android/` remain excluded; EAS regenerates native code using the committed plugins and Swift template.

Matching server code is integrated into sibling `Flowy/main`. Server migrations, digest configuration and `CONTENT_TEMPLATES_ENABLED` are separate rollout steps described in its `docs/digest-rollout.md` and `docs/content-templates-proposal.md`; bundling this client does not activate those services. Physical-device push, real email and AI quality evaluation remain pending.

Integration validation: Expo TypeScript, all 21 UI model scenarios, iOS Metro/Hermes export, and the compiled simulator share-extension harness pass. The native share-extension target also passed a clean prebuild/build before integration; this merge retains the same native template/plugin implementation.


### Chat presentation (2026-09-10)

New responses reveal in short word groups with at most one second of presentation
catch-up after receipt completes. `src/hooks/useChatReveal.ts` mirrors the web
hook; storage and subsequent requests always use the original received text.
Restored conversations show immediately. Stop/error, leaving the screen,
backgrounding, Reduce Motion and screen readers flush the presentation queue.
`src/hooks/useChatMotion.ts` observes native accessibility and app state.
Flowy uses a small branded avatar and unboxed answers; questions retain a soft
bubble. The 44pt latest-message arrow overlays the list without reserving a row,
and follows the composer when the keyboard changes the available height.
The integrated send/stop control is orange when enabled and neutral when empty.
`themeColors.chatSend` / `onChatSend` preserve contrast without changing the
light theme's existing text/link accent. No preview-only replay control ships.

## Cross-device chat history

Conversations and messages now sync through the account's PocketBase history API;
drafts and active selection stay on each device. Deploy the paired server's
migration 31/history endpoint before this client. See [docs/CHAT-HISTORY.md](docs/CHAT-HISTORY.md)
for import, offline recovery, cancellation, pagination and release validation.

Chat rollout compatibility: when the configured server has not deployed the
history route, new unsynced chats still send through the existing chat endpoint
and remain local, with a visible notice. They sync after the route is available.
Previously synced chats never fall back to partial local context. Missing routes
are distinct from confirmed deletions; connecting is cancellable and bounded to
15 seconds per history request, and generation has a labeled Stop button.

## Device notifications

Settings and Digest Settings share explicit device-notification registration. iOS and Android registration, provider receipts and visible arrival passed on owned devices; notification tap routing remains a release gate. Firebase configuration is supplied by EAS and is never committed to the app.

## Google Sign-In on iOS and Android — 2026-09-11

Native Google login/signup now uses the existing Flowy server and shared session. New accounts require explicit AI-processing consent before creation. See [iOS Google setup and validation](docs/GOOGLE_SIGN_IN_IOS.md) for the two public OAuth IDs, EAS environments, rebuild requirement and device checks. Run `npm run test:google-auth` and `npm run typecheck`. Android Google implementation uses the same server contract; see [Android configuration](docs/GOOGLE_SIGN_IN_ANDROID.md).

## Reader parity — 2026-09-14

Web and native use the same Takeaways card and reader content hierarchy. Source
authors have separate profile and saved-author actions. Continue extraction sits
beside incomplete content; read/unread is explicit in detail and inbox menus.
Personal notes can be edited. Full transcripts, research findings and source
excerpts remain available. See [review and local preview](docs/reader-ui-parity.md).

The fullscreen reader returns with a left-to-right swipe from the left edge.
iOS uses the system interactive back gesture; other native targets use the
reader gesture. Right-to-left does not close. Related saves replace the reader,
so one Back returns to the inbox/context. Run `npm run test:reader-navigation`
for ten logic/delegation scenarios. See `docs/reader-ui-parity.md` for validation.


### Tags and saved-item reader integration — 2026-09-14

`codex/tag-manager` now combines the recovered labels implementation with current `origin/main` and `codex/unified-reader-ui`. The reusable category/tag picker retains A–Z / Most saved ordering, counts, expansion and global rename/delete confirmation. Tag, category, search, author and unread filters compose in the API request and account-specific query cache; the new saved-item reader, takeaways, visible actions, notes and return navigation remain intact.

Validated with TypeScript, `node scripts/test-labels.cjs`, `npm run test:item-engagement`, `node scripts/test-source-identity.cjs`, `npm run test:reader-navigation` and an iOS Metro/Hermes export. The labels harness covers combined filters, pagination and distinct query keys. Server UI tests target this paired worktree through `FLOWY_TEST_NATIVE_ROOT`. Physical-device label interactions have not been tested, and this branch has not been merged to main or distributed. Deploy the matching server's PocketBase label hooks, then web/API, before releasing the native changes.


### Local main and simulator — 2026-09-14

The tags/categories and shared reader are now merged into local `main` (`0929149`), paired with the server integration `46db015`. Existing local changes were reconciled and their original snapshots retained in Git stashes. The installed development build launches in the iPhone 16e iOS 26.0 simulator using this checkout's Metro server at `http://127.0.0.1:8081`; the current launch reached login without authentication. Restart with `npx expo start --dev-client --localhost --port 8081`, then press `i`. No new native binary, main push or backend deployment was performed.

### Inbox states and card sizes — 2026-09-14

The native inbox now exposes Cards, List and Summary, plus persistent Small,
Medium and Large card sizes. All variants use `src/components/inbox/ItemStatus.tsx`
and the portable `src/types/inbox-presentation.ts` rules mirrored in the web app.
Completed Deep Dives have a warm orange surface; unread saves use a green dot
and read saves a muted check. Processing retains the saved title with a loader.
A failed processing run displays Link saved (when a usable link exists), Open
link and Retry processing; a failed Deep Dive keeps existing content and retries
research independently. The reader uses the same neutral failure wording.

Validation: `npm run typecheck`, plus 52 paired web/native tests and the web
acceptance runner documented in the sibling server's `TESTING.md`. Native type
parity includes the existing optional exploration `deep` flag. No dependencies,
entitlements, API shapes or native project configuration changed.


### Original files and storage

Saved PDF, Word and PowerPoint originals can be downloaded from the item reader.
The reader displays full/partial/failed analysis separately from whether the
original was saved. Settings shows storage usage and quota; deleting a saved item
frees its files after server cleanup confirms removal.

Binary capture requires the paired server file API (migration 38 and P0/P1/P2
worker/web changes). Protocol, per-format limits and release checks are recorded
in `HANDOVER.md` and the server's `docs/file-storage.md`.


### Storage management and Impeccable UI (P3)

Settings → Storage opens a dedicated native screen, matching the web's hierarchy:
capacity, future-document retention, then searchable files. File rows show size,
date and analysis/removal state; Preview and Options expand inline. Policies
require an explicit save. Removing an original requires contextual confirmation
and keeps the saved item, extracted text and notes. Space remains charged until
server cleanup succeeds. Duplicates match actual content within the account.

Requires paired server migration 39/hooks, worker and web routes from
`Flowy-document-storage`, in addition to migration 38. The detailed Spanish QA
checklist lives at `../Flowy-document-storage/docs/file-storage-manual-checklist.md`.
Local development uses web 4003, PB 8093, Redis 6383, S3 9193 and Metro 8083; the
ShareExtension allows HTTP uploads only to loopback in DEBUG. Release stays HTTPS.

Storage's three-round Impeccable refinement adds visible Options, 44px filename
controls with grouped metadata, a clearer extracted-text preview with retry and
accessible retry announcements, and inline save errors that retain the selection.
The local iPhone 16e review included extra-extra-large text. Native TypeScript and
iOS Metro/Hermes export pass. The fixed-rubric self-assessment and remaining manual
checks are in `../Flowy-document-storage/docs/storage-design-review.md`.


Floating inbox chat: [behavior, validation and distribution](docs/FLOATING-CHAT.md).

### Spanish interface — 2026-09-17

The whole native interface is now available in Spanish alongside English:
auth, tabs, inbox (filters, labels, cards, bulk actions, states), the reader and
its semantic/receipt/media renderers, chat and its history, digests and digest
settings, personalization, storage, the inbox email alias, and every alert and
accessibility label.

What is *not* translated is as deliberate as what is: item titles, notes, tags
and categories stay in the user's own words; summaries, transcripts, digest
bullets and chat answers stay in the language the AI wrote them in; API error
codes, `item.type` values and URLs are contracts. Two literals stay English
because a server compares them byte-for-byte — the `delete my account`
confirmation phrase and the `New conversation` sentinel title, whose *display*
is localized while the stored value is not.

The language follows the device (any Spanish variant → one neutral Spanish,
otherwise English) until it is set explicitly, from the login/signup screens or
Settings → Language. Choosing **Automatic** deletes the stored choice, so the
next launch detects again. The digest *report* language remains a separate
server-side preference and is never changed by the interface language (D-041).

No dependency, entitlement or native configuration changed: detection reads the
platform's existing locale modules and `Intl` rather than adding
`expo-localization`.

Validated with `npm run typecheck`, `npm run test:i18n`,
`npm run test:reader-navigation`, `npm run test:digest-monthly`, an iOS
Metro/Hermes export, and a Spanish/English switch in the installed development
client on an iPhone 16e. `npm run test:ui-models` still stops at its
pre-existing `chatSync.ts` transpilation failure — unrelated to this work and
not addressed here. Full details in [docs/I18N.md](docs/I18N.md).

### Tags release validation — 2026-09-14

The UI-model request regression now exercises normalized tags with global search,
category pagination and separate query-cache keys, including clearing a tag.
Native TypeScript, label API/order tests, ten reader navigation scenarios and
26 Google authentication scenarios pass on the integrated main source. The
broader UI-model harness reaches its previously documented TypeScript generic
transpilation failure in `chatSync.ts`; this is not a passing full UI-model suite.

## Instagram connection — 2026-09-16

Settings now includes Instagram connection through a private app link, status
refresh when returning from Instagram, and a manual-code fallback. Requires the
paired server referral rollout. Validation and native release limits:
[docs/INSTAGRAM_CONNECTION.md](docs/INSTAGRAM_CONNECTION.md).
