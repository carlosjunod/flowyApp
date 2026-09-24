# Shared Groups MVP V2 — native client pointer

Status: approval-ready plan only; nothing implemented. Date: 2026-09-23.

The source of truth is Flowy branch `claude/shared-projects-architecture-klupr7`, server commit `0af8c46`, folder
`docs/plans/2026-09-23-shared-groups/mvp-v2/`. The original parent contracts remain long-term vision and must not be
used as the native implementation backlog.

Read these V2 documents:

- `PLAN-V2.md` — product loop, included/deferred scope and web-first release gates;
- `MIGRATION-GUIDE.md` — why the original N1–N8 plan was reduced;
- `CONTRACTS-CLIENTS.md` — exact web/native boundary and gated native minimum;
- `CONTRACTS-API.md` / `CONTRACTS-CHAT.md` — server DTO, stream and citation contracts;
- `TICKETS.md` — N1–N3 follow-up, after the 25 server/web tickets and Gate E;
- `BLOCKERS.md` — approval decisions that must close before implementation.

Native work must not start merely because the server types exist. Gate E requires an allowlisted web beta with no
critical/high issue and either collaborative activation evidence or a concrete native-capture blocker from user
research.

The native minimum is list/open groups, browse sources, read the cited brief, attach an already-saved item, accept
invite/deep links and use author-private group chat. Group creation/management, comments, share-extension group
selection, public pages, templates, deliverables, digest and proactive research are deferred.

Type parity uses two explicit mirrors with `GROUPS_CONTRACT_VERSION = 2`; do not concatenate server files:

- Flowy `apps/web/types/groups.ts` ↔ FlowyApp `src/types/groups.ts`;
- Flowy chat request/header types ↔ FlowyApp chat transport types.

The streaming contract stays `text/plain`, `x-items` JSON and `[[itemId]]`. Optional `groupItemId` in `x-items`
opens the logical group source. The client never writes group PocketBase collections directly.
