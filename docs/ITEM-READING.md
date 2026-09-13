# Item reading state — delivery for Diego

## Server first

Deploy the matching Flowy migration and API from `codex/owner-usage-reading` before distributing this client. Follow the canonical Flowy `docs/owner-usage-reading.md` rollout instructions for the exact migration number and owner dashboard configuration. No owner identity or dashboard credential belongs in the native app. No native environment variable, dependency or entitlement changed.

The Item contract adds optional `first_opened_at` and `read_at` strings. Empty or absent means no event/mark recorded. Only the server chooses dates. The authenticated native REST boundary calls `POST /api/items/:id/engagement` with `{action:"open"}`, `{action:"mark_read"}` or `{action:"mark_unread"}` and consumes `{data:{id,first_opened_at,read_at},error:null}`. Expected failures use `{data:null,error:CODE}`. `GET /api/items?unread=true` combines with search/category/pagination. The server authorizes ownership; same-URL items belonging to other users are unrelated.

## Behavior

Opening the phone detail or landscape reader records initial opening automatically while foregrounded. It never marks read. The explicit button toggles the read mark, waits for server reconciliation, shows errors and can be retried. A small dot means no read mark; a check means marked read. The filter explains that older saves may lack recorded reading state. Favorites, archive and processing remain independent.

The reader subscribes for its whole lifetime, even once processing settles. Inbox and reader reconcile on foreground and every 30 seconds while foregrounded to cover missed realtime events. Failed opening attempts retry there and on reopening. No offline event queue is promised. REST calls capture account/token and reject late responses after a session change; detail queries include account ID, and account switching already clears the global query cache.

## Validation

Completed in the isolated worktree: TypeScript passes, all four targeted engagement scenario groups pass, and an iOS Metro/Hermes export (1,953 modules) succeeds at `/private/tmp/flowy-native-reading-export`. This verifies bundling, not native device interaction.

The existing full `npm run test:ui-models` suite is blocked by its pre-existing `src/lib/chatSync.ts` transpilation SyntaxError. The same failure was reproduced read-only in the original native checkout. Its updated search/unread scenario executes before this failure; do not claim the full suite passes.

Run `npm run typecheck` and `npm run test:item-engagement`. The latter executes the real REST boundary and engagement hook with synthetic events: separate opening/read/reversal, no invented local timestamps, server action bodies, session guard before/after requests, ready-item realtime/foreground, retryable failure, rapid taps and stale account responses. The existing UI-model search case additionally checks unread query propagation/cache separation.

Before shipping, run phone and landscape device acceptance with two test accounts and both clients:

1. Open an old save: first opening appears on server, read mark remains absent; pending dot remains.
2. Mark read; web reflects the change. In Unread the row disappears. Undo in detail; both clients show it again.
3. Open concurrently from both clients: first opening is unchanged. Same URL saved by the other account remains untouched.
4. Change read state from web while native is foregrounded, then while native is backgrounded. Native catches up via realtime/foreground reconciliation.
5. Disconnect and mark read: show a retryable error, never a false success. Restore the connection and retry.
6. Switch accounts during a delayed request: previous data/errors do not appear in the new account. Test VoiceOver, Dynamic Type, dark/light colors and 44pt targets.

No production data, device build, TestFlight submission or deployment was performed. Native device interaction and accessibility remain release validation.
