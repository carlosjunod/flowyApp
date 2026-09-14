# Reader UI parity — 2026-09-14

## Scope and source audit

Implemented in paired `codex/unified-reader-ui` worktrees, starting from web
`d1aca40` and native `9719b96` (origin/main). Original working trees and the
separate tag worktrees remain intact. The two-week branch/worktree audit found
that source identity/author grouping and explicit reading already existed.
They were delivery/presentation gaps, not missing database features.

Native source identity is present in `541c083` and current main. EAS metadata
for build 23 points to older `60436ac`; build 22 points to `541c083`. This is
build metadata, not proof of the exact code installed on a user's phone.
No historic author backfill or invented author inference was added.

## Result

Both readers use the native Takeaways card, colors and title, compact author
identity with separate external profile and owner-scoped library navigation,
explicit read/unread controls, original media, full saved text, research
summary/findings/candidates/excerpts/notes, personal notes and tags/related saves.
Native now edits notes through the existing PATCH contract. Research sections
start folded in both clients and preserve all source evidence.

`apps/web/types/reader.ts` and native `src/types/reader.ts` are byte-identical
presentation contracts. A regression fails if they drift. Source data contracts
and PocketBase migrations remain unchanged. Opening is independent of reading
(D-033). Existing `source_metadata.author` and `author_key` retain D-032's
owner-scoped grouping and verified source identity rules.

The invisible native continuation button used a function-valued style through
NativeWind interop; it now has a static 48px layout and explicit foreground and
background colors. It appears directly after the incomplete-content notice.
Rapid taps are locked and busy/failure/retry states remain usable.

A stored Reel poster can have source kind `video` while its actual R2 key is a
JPEG. Both renderers now inspect the stored format. Failed previews have a
compact Instagram fallback. Actual video remains playable. Carousel selection
uses the same distinction. Site favicons no longer become large cover images;
native also uses saved OG images, matching web.

## Visual review loop

Used the **impeccable** product/polish workflow and actual browser/simulator
renders. Scores are a manual design assessment, not an external certification.
Rubric: hierarchy, legibility/touch targets, content parity, state feedback and
visual consistency; equal weight. A pass requires both scores strictly >9.5,
working interactions and no unresolved critical defect in the reviewed scope.

| Iteration | Web | Native | Finding and correction |
| --- | ---: | ---: | --- |
| 1 | 8.6 | 8.5 | Core author/card/continuation layout works. Align section labels, notes editing, metadata, related cards and author navigation. |
| 2 | 9.3 | 9.2 | Light/dark and small widths work. Replace failed/oversized favicon covers, expose inbox reading menus and finish source fallback parity. |
| 3 | 9.6 | 9.6 | Reviewed updated mobile/desktop web renders and native light/dark/long-author screens; functional checks pass. Both scores exceed 9.5 for the original presentation scope; navigation was requested afterwards. |

## Added return navigation

The **mobile-touch** skill guides a left swipe from the rightmost 28px on both
readers. Center swipes remain available to media; vertical scrolling and short
or cancelled drags do not close the reader. Native uses Gesture Handler and
Reanimated on the UI thread, with reduced motion and an explicit relationship
to the content scroll gesture. Editing, expanded images and embedded readers
disable this gesture. The native route dismisses related reader screens back
to the inbox instead of walking through each related save.

Web mobile (<768px) uses one same-URL history entry. Back closes the fullscreen
reader; Forward restores it; related saves replace the entry. A cancelled draft
discard restores that entry. Manual close consumes it before author navigation,
allowing Next to restore its state first. Desktop history is unchanged.

Navigation review: web **9.6/10**, with real browser touch and Back/Forward
checks passing. Native presentation retains its reviewed 9.6/10 appearance;
physical swipe acceptance is pending. The simulator automation emitted touch
down/up but no movement, confirmed by temporary event instrumentation (removed).
Eight real native-worklet logic scenarios pass; these do not substitute for
physical iOS touch delivery. The expanded iteration stays open until that check.

## Verification and reproducible local review

`tests/fixtures/reader-server.cjs` provides **synthetic local data only**, with
no outbound calls or production writes. It simulates extraction completion; it
does not measure AI accuracy. `/fixture` exposes the synthetic session and
records; `/fixture/reset` resets this disposable state. Listen only on localhost.
The Playwright acceptance script is `tests/validation/reader-ui.py`.

Run the fixture server on 4199. Build/start the web app on 3091 with `PB_URL`,
`NEXT_PUBLIC_PB_URL` pointing to `http://127.0.0.1:4199`,
`NEXT_PUBLIC_R2_PUBLIC_URL=http://127.0.0.1:4199/media`,
`NEXT_PUBLIC_APP_URL=http://127.0.0.1:3091`, and synthetic admin credentials
`preview@example.test` / `local-fixture-only`. Start Metro on 8091 with the
matching `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_PB_URL`, and
`EXPO_PUBLIC_R2_PUBLIC_URL`. Sign in with the synthetic account. Do not run Next
build and dev against the same `.next` directory simultaneously.

Browser checks cover dark/light at 390px, dark at 360px and 1440px, long names,
read/unread, opening without reading, owner-filter navigation, full saved text,
no horizontal overflow and no page exceptions. Actual iOS Simulator checks cover
both themes, author results, explicit reading in detail and inbox menus, busy
and completed extraction, compact missing media and long names. This is a local
iOS development client, not a TestFlight submission.

Targeted web/native-component tests cover state selection, byte parity,
continuation placement, full findings/excerpts, safe profiles, missing authors,
poster-as-video regression, reading reconciliation, action menus, editing and
transcript collapse. The backend continuation tests confirm no link lookup when
continuing. Native reading tests verify account isolation and rapid taps.

The global root TypeScript command still reports the previously documented 59
errors in existing test infrastructure. Scoped app typechecks and production
web build are separate gates; do not interpret that baseline as a new UI error.

## Delivery

Deploy the web service from the isolated reviewed source. No worker/PocketBase
rollout or migration is required. Retain the existing web consent/auth boundary
fixes and native Google authentication work copied from the original working
trees; native auth has its separate 26-scenario regression suite.

Review images and machine results are under `/tmp/flowy-ui-review/` on the local
machine. The running simulator uses those disposable fixtures. TestFlight
requires a later native build from this updated source; the old installed build
will not acquire these JavaScript changes by itself.

## Final validation

- 77 targeted web, server-continuation and native-component tests pass, including
  8 reader history/gesture scenarios.
- Native: 4 engagement groups, 26 Google iOS/Android scenarios and 8 reader
  navigation worklet scenarios pass (`npm run test:reader-navigation`).
- Web and native scoped TypeScript pass; production Next build passes.
- Playwright production-build acceptance: 4 viewport/theme combinations pass
  reading/reversal, full text, author filtering and overflow/page-error checks;
  mobile touch gestures, browser Back/Forward, cancelled draft discard and
  desktop history isolation also pass against the local server.
- Actual simulator: both themes, long names, author filtering, read/reversal,
  inbox read menu and extraction busy/completion verified. Extraction work uses
  a simulated local worker; provider accuracy and TestFlight are not claimed.
- Both repositories pass `git diff --check`. Root TypeScript retains 59
  previously documented test-infrastructure diagnostics.

Final review snapshots: `web-iteration3-dark-390.png`,
`web-iteration3-light-390.png`, `web-iteration3-dark-1440.png`,
`web-iteration3-long-dark-360.png` and `native-iteration3-inbox.png` in
`/tmp/flowy-ui-review/`. Native reader observations are also recorded in the
local task's simulator tool outputs.

## Deployed web revision

Railway production deployment `242e0308-cefc-4d0b-a8df-7e24f89d7ee5`
completed with `SUCCESS` from web commit `b2fa7c7` on 2026-09-14.
`https://tryflowy.app/` and `/login` return HTTP 200 after deployment.
The deployed source was a clean git archive, without local fixture environment
files. Native source `b1b9eb2` is running in the local development client.
Both source branches are pushed as `codex/unified-reader-ui`; origin/main and
the original dirty checkouts were not rewritten. No TestFlight release occurred.
The only open acceptance check is the physical native return swipe described
above; its logic tests and all web browser navigation checks pass.
