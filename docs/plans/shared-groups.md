# Shared Groups — native client (pointer)

Status: plan only, nothing implemented. Date: 2026-09-23.

The source of truth lives in the Flowy repo, branch `claude/shared-projects-architecture-klupr7`,
folder `docs/plans/2026-09-23-shared-groups/`:

- `PLAN.md` — goal, strategy, decisions, open questions (Spanish)
- `CONTRACTS-NATIVE.md` — everything this repo implements (types, `src/lib/api.ts` methods, hooks,
  screens under `app/(app)/groups/`, send-to-group, deep links incl. the `flowy:` / `tryflowy:` scheme fix,
  iOS share-extension group stage, group chat)
- `CONTRACTS-API.md` / `CONTRACTS-CHAT.md` — server contracts the native client calls
- `TICKETS.md` — native tickets N1–N8 with dependencies on server tickets

Native tickets must not start before their server dependency is merged (see `TICKETS.md`).
`src/types/groups.ts` must stay a verbatim copy of Flowy `apps/web/types/groups.ts` + `group-memory.ts`.
