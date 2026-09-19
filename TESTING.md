# Testing — FlowyApp (native)

Every script here runs in plain Node against the real TypeScript sources,
transpiled on the fly and loaded with mocked platform modules. None of them
touches a device, a keychain, a simulator or a network — and none of them may
ever write to production. Anything that needs a real device is called out as a
manual gate rather than pretended in a script.

## Commands

| Command | Covers | State |
| --- | --- | --- |
| `npm run typecheck` | `tsc --noEmit`. Also the EN/ES dictionary parity gate | ✅ passes |
| `npm run test:i18n-core` | Locale negotiation, device detection, persistence, translator, formatters | ✅ passes |
| `npm run test:i18n-parity` | Dictionary parity, contract key coverage, D-041 | ✅ passes |
| `npm run test:i18n-screens` | `LocaleProvider` startup/race/persistence, auth screens in Spanish | ✅ passes |
| `npm run test:i18n` | The three above, in order | ✅ passes |
| `npm run test:reader-navigation` | 10 reader swipe/delegation scenarios | ✅ passes |
| `npm run test:digest-monthly` | Monthly digest settings and API scenarios | ✅ passes |
| `npm run test:item-engagement` | Read/unread engagement scenarios | — |
| `npm run test:google-auth` | 26 Google/Apple auth scenarios | — |
| `npm run test:push-contract` | Push device contract | — |
| `node scripts/test-labels.cjs` | Label filters, ordering, pagination | — |
| `node scripts/test-source-identity.cjs` | Source identity rendering | — |
| `npm run test:ui-models` | UI model regressions | ❌ **known failure**, see below |

## Known failure: `test:ui-models`

`npm run test:ui-models` stops with a `SyntaxError` while the script's custom
loader transpiles a TypeScript generic in `src/lib/chatSync.ts`. This is a
limitation of that harness's transpile step, not of the app — `tsc --noEmit`
compiles the same file cleanly and the iOS Metro/Hermes export bundles it.

It predates the Spanish interface work and was deliberately left alone: fixing
an unrelated harness inside a translation change would mix two concerns in one
review. **This suite is not passing; do not report it as such.**

## The i18n suites in detail

### `test-i18n-core.cjs`

Negotiation, detection, storage, the translator and the formatters.

The detection cases matter most. React Native 0.81 moved `Settings` and
`I18nManager` constants behind TurboModule *getters*; reading the legacy
own-property returns `undefined` there, which silently dropped the ordered iOS
language list and left only the single-locale `Intl` fallback — turning a
Spanish-then-English phone into an English app. Each case drives a different
module shape (getter-only, `getConstants()`, legacy property, module absent) and
asserts the ordered list survives and still precedes the fallback.

The rest: regional Spanish collapsing onto `es`, `esperanto` *not* matching as a
prefix, explicit choice beating detection in both directions, a corrupt stored
value being ignored rather than forcing the default, storage failures resolving
quietly, plural selection with and without `Intl.PluralRules`, locale-aware
number interpolation, the English fallback chain, and the relative-time
thresholds staying exactly where they were.

### `test-i18n-parity.cjs`

`typecheck` already proves the two dictionaries have the same *shape*. This
proves the things the compiler cannot see:

- identical key sets, with a floor on the total so a dictionary module dropping
  out of the barrel is caught (both locales would still "match" at zero);
- no empty strings and no bare-placeholder values;
- identical `{placeholders}` and plural categories per key;
- **every key the shared presentation contracts can emit resolves in both
  locales, with no English fallback configured.** `itemPresentation`,
  `readerAction`, `readerSummary`, `readerResearch`, `semanticLabelParts`,
  `semanticCoverageKey`, `semanticEvidenceKey`, `chatErrorKey`, `apiErrorKey`,
  `personalizationErrorKey`, `socialAuthErrorKey`, `sourceChip`,
  `itemTypeLabelKey`, `analysisLabelKey`, `RETENTION_OPTIONS` and the digest
  schedule label maps are each driven across their full input space;
- D-041: the digest settings screen never calls the interface-language setter,
  and the provider never touches digest preferences.

### `test-i18n-screens.cjs`

Drives `LocaleProvider` through a small hook runtime and asserts the startup
order the acceptance criteria call for:

- the first frame is already in the detected language, before any I/O;
- device preference *order* decides, not mere presence;
- a persisted choice is applied after hydration;
- a choice made *while* the keychain read is in flight is not reverted by it —
  and the same holds for choosing **Automatic**, which is why the guard is a
  counter rather than a boolean;
- `setLocale` re-renders immediately and persists; **Automatic** deletes the
  row, and a simulated relaunch then follows the device again;
- rapid switches persist in request order (write/delete cannot race).

It then renders the login and signup screens with a real translator over the
real dictionaries, in both locales, and asserts that they differ, contain the
agreed vocabulary, leak no raw key paths, and keep brand names intact.

## Manual gates still owed for the Spanish release

These are not scripted and are not claimed:

- [ ] VoiceOver in Spanish on a physical device
- [ ] Dynamic Type at the largest sizes — Spanish runs ~15–25% longer than
      English and several toolbars are tight
- [ ] Cold start on a device whose *system* language is Spanish, as opposed to
      switching inside the app
- [ ] Android: every detection path is covered against the real module shapes in
      `test-i18n-core.cjs`, but only iOS has been exercised on hardware
- [ ] Translation review by a native Spanish speaker

## Conventions for new scripts

Copy the loader from `scripts/test-i18n-core.cjs`. One detail is easy to get
wrong: module resolution must `statSync` each candidate and accept only a
regular file, falling back to `index.ts`/`index.tsx` for a directory import.
`src/lib/i18n/dictionaries/en` exists as a *directory*, so a bare `existsSync`
check picks it and `readFileSync` fails with `EISDIR`.
