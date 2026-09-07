# Inbox and chat implementation plan

Date: 2026-09-07. Status: implemented; local type/model checks pass, native device validation remains.

Coordinated plan: `../Flowy/docs/superpowers/plans/2026-09-07-ui-ux-implementation.md` (relative to this repository root).

## Work sequence

1. Global library search and facets through authenticated `GET /api/items`, including pagination, safe sorting and category aliases. Distinct loading/error/empty states; recognizable and openable pending/failed items.
2. Account-scoped on-device chat history and drafts; new/open conversation, stop/retry/copy, honest activity indication and reader-controlled scrolling. Preserve the server stream and citation contract. No claim of cross-device sync or guaranteed execution while suspended.
3. Simplify capture and inbox controls; remove nonfunctional hero and fixed AI suggestions. Compact no-image cards. Content-specific detail hierarchy, readable receipt rows, secondary metadata folded, contextual actions and accessible selection/touch targets.
4. Compact per-response sources; tablet navigation; keyboard-safe editing/composer; purposeful motion and reduced-motion handling.
5. Typecheck and regression validation, then update HANDOVER/README and this execution record with concrete outcomes and limits.

## Acceptance

Find older saves without manually loading unrelated pages; recover from network/processing failure; save a single link and a batch; recognize a save from its title/summary; read receipt totals and line items; revisit a conversation; stop/retry generation; read without scroll interruption; open sources and navigate on wide screens.

No production data edits, native entitlement changes or deployment are required.


## Execution record

- **Global retrieval:** `src/lib/api.ts` and `src/hooks/useItems.ts` consume authenticated `GET /api/items`. Search/category/page are server query inputs; cache keys include account and filters. Inbox shows skeletons, network retry, first-save guidance and filtered-empty recovery separately.
- **Inbox and capture:** compact default list, optional grid, meaningful titles/summary previews, no duplicate title panels or nonfunctional AI hero; pending/error items remain openable; explicit selection and accessible states. The Save links sheet accepts a single link or batch, retains active work when closed, distinguishes saved/queued from processed, and offers failed-URL retry.
- **Detail:** title before a compact expandable preview, original access and contextual share/actions; readable receipt item rows and prominent totals; secondary payment/analysis/tags folded; keyboard-safe edit labels; processing retry available in the item error state. Fixed mock tags and fallback AI takeaways removed. `src/components/inbox/TagSuggestions.tsx` removed.
- **Chat:** provider above tabs keyed by account; validated account/device history with drafts in Unicode-safe SecureStore chunks; serialized manifest publication preserves previous data if a save fails. New/open/delete conversation, stop/retry/copy, early citation metadata and expandable per-response sources. Native account deletion clears this new local history and prevents stale writes from recreating it.
- **Feedback/accessibility:** status stays local to response and Chat tab; visible preparation indicator uses reduced-motion/focus-aware behavior; auto-scroll only follows an already-near-bottom reader; no idle AI pulse. Wider screens keep navigation. Touch targets and labels improved on filters, source chips, selection, composer and actions. Light accent contrast and explicit on-accent colors added.
- **New files:** `src/lib/chatModel.ts`, `src/lib/chatStorage.ts`, `scripts/test-ui-models.cjs`. `package.json` adds `test:ui-models`. README/HANDOVER describe the current behavior and server dependency.

## Verification and limits

`npm run typecheck` passed. `npm run test:ui-models` passed 18 regression scenarios using the real TypeScript models/hooks with isolated native/API adapters, covering search/page/category contracts, restoration/interruption, drafts, retry context, double-send/stale-stream races, early sources, account isolation, Unicode chunking, atomic/serial writes, deletion and persistence. `git diff --check` passed.

No native simulator/device visual or E2E run is claimed. Verify small-phone and tablet rendering, VoiceOver/Dynamic Type, keyboard interaction, actual streaming support and interruption/reopening on-device before release. History is local to an account/device; navigation inside the mounted app preserves ongoing work, while OS-suspended background execution is not guaranteed. Upload/processing and chat server contracts are unchanged except for the coordinated global listing endpoint; no production mutations or native entitlement changes were performed.
