# Inbox layout · 2026-09-14

Cards and List are the only visible views. Summary's toggle entry, import and render branch remain commented out, and ItemDetailRow is preserved. Old Summary preferences fall back to Cards; old card-size storage has no effect on the inbox.

Phones always use two columns. Wider panes add columns from a 240px minimum plus the gap; larger accessibility text increases that minimum on tablets. The actual pane width drives the layout, including beside chat. List stays one column and uses a 64px top-left thumbnail with a failed-image fallback.

All/Unread/Read is inside the Categories/Tags disclosure. Folding retains an active reading chip with a clear action; Clear filters resets all three. The optional `reading` API parameter and account-scoped query key preserve global search, tags, author filtering and server pagination. Deploy the paired Flowy `GET /api/items` implementation first. Opening remains independent from explicit reading.

Static Pressable surfaces preserve Deep Dive and selection colors with NativeWind. Cards without an image reserve room for the 44px action menu and use a 16px title. List/cards omit entrance fades.

Implementation: `app/(app)/(tabs)/inbox.tsx`, `src/components/inbox/{ViewModeToggle,FilterBar,LabelSection,LabelPicker,ItemCard,ItemRow}.tsx`, `src/lib/{viewMode,adaptiveLayout,api}.ts`, `src/hooks/useItems.ts`, `src/types/inbox-presentation.ts`.

Design was reviewed after the web reached 9.2/10: native first pass 8.8, final 9.2 (four total design passes across both clients). Scores are a scoped heuristic assessment. TypeScript and paired server native-adapter tests cover the behavior; an isolated Expo Go iPhone 16e harness renders the actual components with synthetic data in both themes. Full signed-app navigation and physical-device accessibility are not claimed. The general `test:ui-models` command remains blocked by its existing chatSync TypeScript loader error; the inbox expectations were updated, and dedicated paired tests exercise the changed native behavior. See Flowy `docs/inbox-layout-review.md` and `TESTING.md` for evidence and exact final results.

No native capability, auth identifier, dependency, binary or OTA release changed.
