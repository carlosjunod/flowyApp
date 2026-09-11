# Adaptive inbox and chat

Implemented in the `codex/adaptive-inbox-chat` worktree, based on native main commit `54757a9`.

## Behavior

- Login stays centered horizontally and vertically, with a 440-point maximum form width in both iPad orientations. The form scrolls when the keyboard or a short window reduces the available height.
- iPhone supports portrait only through native configuration.
- Portrait iPad keeps the same Inbox / Chat / Digests / Settings navigation. The inbox fits two compact rows or visual cards across when readable space permits, up to three on wider windows.
- Card mode uses its own density: two columns on standard iPad windows and up to three in larger iPad/Pro windows, including the inbox beside chat. Minimum card width is 250 points in a single pane and 180 beside chat; both increase with text scale. Compact-list density is unchanged.
- Landscape windows with at least 801 points of usable width use two equal panels. The Inbox tab shows the list/grid on the left and the selected saved item on the right; without a selection, the reader displays “Select a saved item to start reading”. The Chat tab keeps Inbox left and Chat right. Narrow multitasking windows fall back to tabs. Larger accessibility text increases the minimum panel and item widths.
- Tapping a saved item in either landscape workspace activates Inbox and loads its reader inline. Cards and rows highlight the active item, independently of bulk selection. Close clears the reader; related items open in the same panel, and deleting from the reader clears it. Portrait keeps the existing full-screen detail route. The landscape selection is retained while switching tabs or rotating; returning to landscape restores that item, but its reader scroll position is reset on remount.
- Digests and Settings occupy the full window. The paired workspace remembers the last touched pane and activates that tab when returning to portrait, without changing navigation focus during a press.
- Safe-area left/right insets are subtracted before deciding whether both panes fit. The keyboard does not select a different layout; resizing the window does.
- Inbox and Chat use stable route instances across resizing. Search, category, selection, view preference, chat draft and active stream stay in their existing owners. The inbox's virtual list can be rebuilt when its column count changes.

## Implementation

| File | Responsibility |
| --- | --- |
| `src/lib/adaptiveLayout.ts` | Pure window-based panel/density policy and paired-tab visibility; no model checks or new Apple APIs |
| `src/components/navigation/AdaptiveTabs.tsx` | Expo Router headless tabs, stable route instances, pane widths/visibility, safe areas and bottom navigation |
| `app/(auth)/login.tsx` | Centered, width-limited login with keyboard-safe scrolling |
| `app/(app)/(tabs)/_layout.tsx` | Inbox as initial route; adaptive navigator |
| `app/(app)/(tabs)/inbox.tsx` | Inbox measures its own pane; both compact rows and cards increase density |
| `src/components/inbox/ItemRow.tsx`, `src/components/inbox/ItemCard.tsx` | Pane-aware open callbacks, active-reader highlight, existing bulk-selection gestures |
| `src/components/inbox/ItemReader.tsx` | Shared item detail, related-item navigation and close/delete callbacks; media fits the reading pane |
| `app/(app)/item/[id].tsx` | Compact/deep-link detail route wrapping the shared reader |
| `src/components/inbox/content/CarouselContent.tsx` | Video slides measure their container instead of the full window |
| `app/(app)/(tabs)/chat.tsx` | Chat visibility follows its visible pane; hidden while the Inbox reader is active |
| `src/components/chat/ChatWindow.tsx` | Scrollable welcome content for short windows and the onscreen keyboard |
| `plugins/withAdaptiveOrientation.js` | iPhone portrait, all iPad orientations, no fullscreen requirement; reproduced by clean prebuild |
| `scripts/test-ui-models.cjs` | Phone/tablet/multitasking/large-text/visibility regressions plus existing chat/data tests |
| `scripts/adaptive-fixture-server.cjs` | Loopback-only fake login, 48 saved items and streamed chat for simulator acceptance |

The server request/response contracts, auth identifiers and share extension behavior are unchanged.

## iPhone Duo preparation

Apple's [Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) guidance emphasizes continuous resizing and safe areas. This implementation establishes that foundation using the installed Expo SDK 54 and React Native 0.81. It does **not** implement hinge occlusion, device poses, system vertical controls or guarantee Duo compatibility. Revisit the iPhone orientation restriction and integrate the platform's new APIs once the supported Expo/Xcode toolchain exposes them. Do not infer Duo support from tablet behavior alone.

## Local validation

```sh
npm run typecheck
npm run test:ui-models
npx expo prebuild --platform ios --clean --no-install
cd ios && pod install
```

A native rebuild is required for orientation changes; an OTA update cannot change Info.plist.

For isolated visual acceptance, point the existing three `EXPO_PUBLIC_*` URLs in an untracked `.env` at `http://localhost:4199`, then run `node scripts/adaptive-fixture-server.cjs` and start Expo. Use a fresh simulator with any test email/password. This fixture server binds only to loopback and makes no upstream requests; it is not a backend for real accounts. Set your normal environment before using real services.

Acceptance matrix: phone portrait/rotation lock; iPad portrait and both landscape directions; search/filter and selection through rotation; draft and streaming continuation; chat citation → detail → back; keyboard visibility; large accessibility text; narrow iPad multitasking; light/dark appearance. Final validation evidence and limits are recorded below.

## Validation — 2026-09-10

- TypeScript and all 28 UI model scenarios pass.
- Clean iOS prebuild, CocoaPods installation and Xcode simulator builds pass (Xcode 26.3). The built app's Info.plist confirms iPhone portrait, four iPad orientations and `UIRequiresFullScreen=false`.
- Visual/interaction checks passed on a fresh iPad Pro 11-inch (M5), iOS 26.0, using the loopback fixture server: portrait density; both landscape directions; search and selection through rotation; draft persistence; an in-flight response surviving rotation; citation opening on the first tap; detail/back; full-window Settings; last-touched pane restored in portrait.
- The simulator build uses local ad-hoc signing so SecureStore works. The first unsigned build could not access Keychain; that was a test-build entitlement issue, not an app auth change.
- Physical iPhone/iPad acceptance, onscreen keyboard interaction, live Split View/Stage Manager resizing and Duo-specific behavior remain unverified. Narrow windows and larger text are covered by the pure layout tests. Column-count changes rebuild the inbox virtual list and can reset its scroll position.
- This worktree's untracked `.env` currently points to the local fixture server on port 4199. Configure your actual development endpoints before using real accounts.

Card density refinement: model checks cover standard iPad two-column cards and Pro-sized three-column cards in portrait and beside chat, plus iPhone and larger-text fallbacks. This refinement passed TypeScript and the 28-scenario runner. Visually verified three cards per row beside chat on iPad Pro 12.9-inch (6th generation), iOS 26.0, in dark mode. The simulator initially retained the previous one-column version; restarting Metro with a clean cache and reopening the app loaded the current density. Use `npx expo start --dev-client --port 8097 --clear --max-workers 2` if the preview stops reflecting edits.

Inbox reader refinement: TypeScript and the 28 UI model scenarios pass. On the iPad Pro 12.9-inch simulator with local fixtures, verified the empty reading panel, card-to-card selection/highlight, compact-row selection, switching to Chat, opening an inbox item from Chat, portrait full-screen detail/back, and restoration of the landscape selection after rotation. Closing the reader returns to its empty state. Related-item routing, delete completion and media sizing share the existing detail behavior with pane callbacks/container measurement; real media playback and server mutations were not exercised with these fixtures.
