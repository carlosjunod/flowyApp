# AGENTS.md — FlowyApp

## Purpose and scope

FlowyApp is Flowy's Expo React Native client for iOS, Android, and web, with
native iOS sharing support. It is a client of the sibling server repository:

`/Users/carlosjunod/Documents/Projects/Flowy`

Treat this file as the operating guide for coding agents. The server repository
is the authority for API behavior, PocketBase schema/migrations, worker
processing, and production service configuration.

## Architecture at a glance

| Area | Path | Responsibility |
| --- | --- | --- |
| Expo Router screens | `app/` | Auth, inbox, chat, item detail, digests, settings |
| Components | `src/components/` | Inbox, chat, settings, and shared UI |
| Data and platform boundaries | `src/lib/` | PocketBase, REST API, auth, env, secure store, themes |
| Server state / behavior | `src/hooks/` | Queries, item actions, chat, bulk import, push registration |
| Domain types | `src/types/` | Item, API, ingest, receipt, and chat contracts |
| Native project generation | `plugins/` | Expo config plugins and share-extension Swift template |
| Reference / rollout docs | `HANDOVER.md`, `PARITY-DIAGNOSTIC.md`, `docs/` | Current rollout constraints and UI references |

The app uses Expo SDK 54, Expo Router, React Native, NativeWind, React Query,
PocketBase, and TypeScript strict mode. Generated `ios/` and `android/`
directories are intentionally ignored; reproduce them via Expo prebuild.

## Start here

1. For a feature or API change, inspect the matching server implementation in
   `/Users/carlosjunod/Documents/Projects/Flowy` and its `CODEBASE_MAP.md`.
2. Read `src/types/index.ts`, `src/lib/api.ts`, and `src/lib/pb.ts` before
   changing a data contract.
3. Read `app.config.ts` and the relevant `plugins/` code before changing native
   capabilities, entitlements, bundle IDs, or the share extension.
4. Use `HANDOVER.md` as the current parity/rollout history. Its correction dated
   2026-09-03 overrides older instructions in `PROMPT.md` and `starthere.md`.
5. Treat nested `CLAUDE.md` files as generated historical notes, not active
   implementation rules.

## Commands

```bash
npm install
npm run start
npm run ios
npm run android
npm run web
npm run typecheck
npm run prebuild
```

Run `npm run typecheck` for every TypeScript change. For UI work, verify on the
appropriate Expo target where possible. For native/share-extension work, use a
fresh prebuild and verify the generated native output; a typecheck alone does
not validate entitlements, Xcode targets, or Info.plist output.

## Code conventions

- TypeScript is strict; do not introduce `any`. Add or widen shared data types
  in `src/types/` rather than locally casting server responses.
- Use functional components and Expo Router file-based routes.
- All PocketBase access belongs behind `src/lib/pb.ts` / existing hooks. All
  server REST calls go through `src/lib/api.ts`, which returns `{ data, error }`
  and should not throw expected API errors.
- Read configuration through `src/lib/env.ts` and `EXPO_PUBLIC_*` variables.
  Do not embed API hosts, secrets, or production-only values in components.
- Keep UI state and server state distinct: React Query/hooks own remote data;
  components should remain presentational where practical.
- Preserve chat compatibility with the server: `POST /api/chat` streams text,
  supplies cited items in `x-items`, and encodes citations as `[[itemId]]`.
- When expanding item support, update the canonical `ItemType` and the
  appropriate type-specific renderer, thumbnail/source helpers, ingest types,
  and server contract together.

## Authentication, Apple, and native sharing

- PocketBase auth persists through the shared secure store so the native share
  extension can use it. Do not change the token key or App Group without
  changing both app and extension behavior.
- The verified native bundle ID is `app.tryflowy.client`; the share extension
  is `app.tryflowy.client.ShareExtension`; App Group is `group.app.tryflowy`.
  `app.tryflowy.app` is the web Sign in with Apple Services ID, not a native
  App ID. See the correction at the top of `HANDOVER.md`.
- Universal Links depend on the server's AASA endpoint and its
  `APPLE_CLIENT_ID`/`APPLE_TEAM_ID`. Coordinate changes with the Flowy repo and
  validate the deployed AASA rather than assuming config changes are live.
- The source of truth for generated share-extension Swift is
  `plugins/shareExtensionTemplate/ShareViewController.swift`; modify the
  config plugin and template, then regenerate `ios/`. Do not rely on an
  untracked generated copy as the only implementation.
- Changes to `app.config.ts`, `plugins/`, entitlements, capabilities, extension
  activation rules, bundle IDs, or native dependencies require a clean prebuild
  and device/build validation before handoff.

## Cross-repository contract discipline

FlowyApp depends on Flowy's PocketBase collections and API endpoints. When a
mobile change requires a server change—or a server change affects mobile—update
both repositories in the same workstream. Check especially:

- item and ingest type unions and payload fields;
- auth/session behavior and account deletion;
- streamed chat body, `x-items` header, and citation shape;
- item action, digest, email-alias, and exploration endpoints;
- Apple audience/AASA and push notification contracts.

For the authoritative server map and API workflow details, see
`/Users/carlosjunod/Documents/Projects/Flowy/CODEBASE_MAP.md`.

## Safety and completion

- Preserve unrelated working-tree changes and never commit generated `ios/` or
  `android/` folders.
- Do not make destructive credential, certificate, provisioning, or Apple
  portal changes without explicit user authorization.
- Do not leave required work as a vague TODO. If genuinely blocked, record a
  concrete `BLOCKER: ...` entry in `BLOCKERS.md`.
- Update `README.md` or the relevant rollout/reference document when commands,
  environment variables, platform setup, or a user-visible capability changes.
