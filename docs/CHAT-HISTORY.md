# Shared chat history — 2026-09-10

Implemented on `codex/chat-history-sync`, alongside the server worktree. Deployment is pending.

Chat history now belongs to the account in PocketBase. `src/hooks/useChatEngine.ts` is the exact portable engine from server `apps/web/lib/chat/useChatEngine.ts` (only its contract import differs). `src/lib/chatContract.ts` mirrors the wire types. `src/lib/chatSync.ts` converts native message/source/storage shapes and connects the engine to `src/lib/api.ts` and the existing account-scoped, atomic SecureStore chunks.

The server must deploy PB migration 31/hooks and `/api/chat/history` before this client ships. No native capabilities, dependencies, Apple identifiers or environment variables changed.

- Foreground/chat focus and 15-second active-app polling refresh history. New-device selection and drafts remain local.
- Old local messages import by conversation/message ID; repeated imports preserve server messages and append only unseen IDs. Oversized/invalid local chats remain available with an import error, while other chats can sync.
- Selecting a chat fetches the latest 50 messages. “Load earlier messages” pages backward. Persisted caches keep recent messages per synced conversation; pending imports and local operations are not discarded.
- Sending includes an optional persisted `turn` with conversation/revision/request/message IDs. The server uses owned server history, claims one request, and keeps the original streamed text/citation contract. Native source parsing accepts nullable server metadata and normalizes it for the renderers.
- Busy/stale conversations show a recoverable message; an unsent question remains in the draft. Retry appends a new attempt without deleting the old answer.
- Stop preserves received partial text. Pending stop/recovery/delete operations survive reconnect. Deletion removes the conversation across devices, and retained server tombstone IDs prevent offline resurrection.
- Account switches abort previous requests and isolate caches. Account deletion cascades server chat collections and removes the local account history through the existing settings flow.

This version does not guarantee generation after OS suspension/app termination. Server leases expire after 90 seconds without progress and expose an interrupted answer on next access; retry is explicit. Reading cached chats and drafting work offline; generation requires connectivity.

Verification: run `npm run typecheck`, `npm run test:ui-models`, and `expo export --platform ios`. The server's `tests/validation/chat-history.py --native=PATH --web` checks portable source parity, real PB transactions and actual history API behavior in two browser contexts. The native model suite exercises real adapters with simulated HTTP/stream events. These checks do not replace physical-device keyboard, suspension/relaunch, VoiceOver and network-transition validation.

Canonical server contract/rollout: `docs/chat-history.md` in the paired server worktree.

Recorded verification: native TypeScript passes; all 26 UI model/hook scenarios pass; iOS Metro/Hermes export passes. The server's 54 targeted tests, real PocketBase transaction harness, exact mirror checks and two-browser history workflow pass. The global server suite retains five pre-existing LinkedIn failures and its root TypeScript gate retains 82 baseline diagnostics; no new diagnostics remain. No device E2E or production deployment was performed.

Physical iPhone setup (2026-09-10): Expo Go for SDK 57 rejected this SDK 54
project. A clean generated iOS project built successfully in Debug with the
existing Apple team and App Group, after automatic provisioning and registration
of the connected iPhone. The development app was installed and launched on the
iPhone 16 Pro Max using `devicectl`; Metro runs in `--dev-client --lan` mode.
Installation/launch alone does not verify JavaScript loading or the chat UI.
The initial dependency-directory symlink caused Expo to request an entry outside
the worktree. Replacing it with independent dependencies and restarting Metro
with `--clear` fixed entry resolution: the iOS development bundle returned HTTP
200 (2,024 modules), and the relaunched phone requested the corrected bundle.
Metro's inspector then confirmed the iPhone's React Native runtime connection,
and device logs showed the app requesting inbox, chat history and digest data.
The production `/api/chat/history` endpoint returned 404, confirming that the
server rollout remains pending. No physical chat-interaction E2E is claimed.
The paired server routes and migration still need to be available at the client's
configured API endpoint for cross-device history validation.

## Client before server rollout

An unstructured 404 from the history route means sync is unavailable, not that a
conversation was deleted. Native conversations that have never synced and have
no pending recovery can use the existing `/api/chat` endpoint with local history
and digest context. A neutral notice explains that new chats stay on this device.
They import after the history service becomes available. Previously synced chats
never use the fallback; auth, network, conflict and confirmed-deletion errors do
not enable it. Active local streams are not imported until completion or stop.

The composer shows a cancellable connecting indicator during preflight, then a
labeled Stop control during generation. History requests have a 15s timeout.
Cancelling before generation preserves the draft and creates no remote recovery.

Correction verification: 28 native model/HTTP scenarios pass, including an empty
local history against an undeployed history endpoint, local response persistence
and a follow-up carrying prior messages. Shared lifecycle/API suites pass 64
cases, plus 24 chat-adapter cases. Native/web TypeScript pass. Corrected JavaScript
was reloaded on the phone; live AI-answer interaction still requires a device check.

Main integration (2026-09-10): preserves personalization and progressive chat
presentation. The history migration is 31 (30 already belongs to personalization).
All 32 combined native scenarios, native TypeScript and iOS Hermes export pass;
paired server validation passes 100 targeted cases and real PB/two-browser checks.

Production failure correction (2026-09-10): ordinary persisted chats were rejected with `INVALID_DIGEST_CONTEXT` because PocketBase serialized an absent digest context as null. The paired server omits optional fields and accepts stored null as absence while preserving valid digest ownership checks. Native failed-answer text now asks to retry without incorrectly blaming connectivity.
