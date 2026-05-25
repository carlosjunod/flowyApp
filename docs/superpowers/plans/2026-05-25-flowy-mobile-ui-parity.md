# Flowy Mobile UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bring FlowyApp (React Native + Expo) to functional/structural UI parity with the Flowy web app, screen by screen, prioritized P0→P2 — without regressing the places mobile is already ahead.

**Architecture:** Web (`~/Documents/Projects/Flowy/apps/web`) is the source of truth. The plan is dependency-ordered: the item-detail **content-renderer system** is the spine (everything in detail hangs off it), so it goes first; independent P0 (email alias) parallels it; interaction/chat/digest/settings polish follows. Mobile keeps RN-native patterns (push screens vs web drawers, tabs vs top-nav) — parity is about *capabilities and states*, not pixel-matching desktop.

**Tech stack:** React Native, Expo Router, TanStack Query, NativeWind, PocketBase SDK. New deps required by some tasks (flagged): `react-native-webview`, `expo-video` (or `expo-av`), `@react-native-community/datetimepicker`, `expo-clipboard`.

**Audit basis:** 3 structural audits run 2026-05-25 against web + mobile `main`. Every gap below cites `file:line` in both repos. Visual/color polish is explicitly out of scope (this is functional/structural parity).

---

## Re-audit summary (what's actually missing)

Severity: **P0** core capability wrong/missing · **P1** notable gap · **P2** nice-to-have · ✅ already done · ⭐ mobile is ahead (preserve)

### Inbox / Item detail
| # | Gap | Sev | Web ref ‖ Mobile state |
|---|-----|-----|------------------------|
| D1 | **No content-type dispatcher** (`getContentType`+`ContentRenderer`) | **P0** | `web/lib/contentType.ts`, `content/ContentRenderer.tsx` ‖ absent; detail branches only on `type==='receipt'` (`item/[id].tsx:295`) |
| D2 | **YouTube renderer** (embed/play, chapters/transcript tabs, timestamp deep-links) | **P0** | `content/YouTubeContent.tsx` + `lib/transcript.ts` ‖ static hero image only |
| D3 | **Reel renderer** (9:16 video, transcript, IG placeholder) | **P0** | `content/ReelContent.tsx` ‖ renders as dead `<Image>` |
| D4 | **Carousel renderer** (thumb strip, per-slide AI Vision, video slides) | P1 | `content/CarouselContent.tsx` ‖ generic `MediaCarousel` (no strip/vision/video) |
| D5 | **Generic renderer** (Visual Summary / Transcript tabs) | P1 | `content/GenericContent.tsx` ‖ raw Markdown dump |
| D6 | Source-type chip in detail meta ("YouTube Video", "IG Carousel · N slides") | P1 | `ItemDrawer.tsx:102-155` ‖ absent |
| D7 | Inline tag add/remove on detail | P1 | `ItemDrawer.tsx:825-925` ‖ read-only badges |
| D8 | Share action in detail toolbar | P1 | `ItemDrawer` toolbar + `lib/share.ts` ‖ absent |
| D9 | **ExploreCTA.onPress unwired** (renders 5 states, triggers nothing) | P1 | `ItemDrawer.tsx:312-317` ‖ `item/[id].tsx:232-237` — *overlaps functional #5* |
| D10 | Distinct "no search matches" inbox state | P1 | `InboxGrid.tsx:163,186-192` ‖ same emoji swap |
| D11 | 3rd "detail" view-mode in inbox (`ItemDetailRow` built but unmounted) | P2 | `InboxGrid.tsx:197-200` ‖ `ViewModeToggle.tsx:15` grid↔list only |
| D12 | Editable summary + Regenerate | P2 | `ItemDrawer.tsx:927-977` ‖ modal-only edit |
| ⭐ | Related-items rail, processing-error banner, date-bucketed list, pull-to-refresh+realtime | — | mobile ahead — **preserve** |

### Chat
| # | Gap | Sev | Web ref ‖ Mobile state |
|---|-----|-----|------------------------|
| C1 | Inline citations as **pills** (thumbnail + tap-to-open) | P1 | `chat/ItemChip.tsx` injected via markdown `a` ‖ `[[id]]` degrades to plain link (`ChatMessage.tsx:21-28`) |
| C2 | Real **empty/welcome state + tappable suggested prompts** | P1 | `ChatWindow.tsx:82-107` ‖ emoji + 1 line (`ChatWindow.tsx:23-32`) |
| C3 | `CitedItem` type too lean for rich chips (no thumbnail fields) | P1 (enabler) | `x-items` carries richer fields web parses ‖ mobile parser drops them (`api.ts:208-214`, `types/index.ts:119-126`) |
| C4 | Send-button busy spinner | P2 | `ChatInput.tsx:73-77` ‖ static "Send" |
| C5 | "Might be related" fallback rail when no citations | P2 | `ChatMessage.tsx:144-146` ‖ absent |
| ⭐ | ConversationItemsStrip, New-chat reset, AbortController wiring | — | mobile ahead — **preserve** |

### Settings / Digest / Auth / Nav
| # | Gap | Sev | Web ref ‖ Mobile state |
|---|-----|-----|------------------------|
| S1 | **Inbox email-alias screen** (view/copy/regenerate + states) | **P0** | `settings/inbox/page.tsx`, `InboxAliasForm.tsx` ‖ absent entirely (*= functional #8*) |
| S2 | Google sign-in button on login | ✅ **DONE** | `login/page.tsx:295-323` ‖ **added in PR #6** |
| S3 | Digest **pending/in-flight jobs** section | P1 | `digest/page.tsx:123-164` ‖ generated list only |
| S4 | Digest delivery time: **local-time picker** (not raw UTC) | P1 | `settings/digest:19-37` ‖ raw UTC text field (`digest-settings.tsx:112-126`) |
| S5 | Wide-screen (≥768) nav fallback — tab bar hides with no replacement | P1 | `BottomNav`+header ‖ `(app)/_layout.tsx:33-35` hides tabs, nothing replaces |
| S6 | Digest detail window-range label | P2 | `digest/[id]/page.tsx:45-59` ‖ relative date only |
| S7 | Digest empty-sections message + list empty-CTA + category preview | P2 | `digest/page.tsx:172-205`, `[id]/page.tsx:88-89` ‖ silent/minimal |
| S8 | Expand signup error-code map | P2 | `signup/page.tsx:12-21` ‖ fewer codes (`signup.tsx:18-29`) |
| ⭐ | 3-way theme selector, About/version, digest item deep-links, push deep-linking | — | mobile ahead — **preserve** |

---

# PHASE A (P0) — Item-detail content-renderer system

The spine. Internal order: A1 (data helpers) → A2 (dispatcher + renderers) → A3 (rewire detail). A2 renderers can be built in parallel once A1 lands.

## Task A1: Port content-type classification + transcript parsing helpers
**Files:** Create `src/lib/contentType.ts`, `src/lib/transcript.ts`. **No new deps.**

- [ ] **Step 1:** Create `src/lib/contentType.ts` (port of `web/lib/contentType.ts`, mobile types):

```typescript
import type { Item } from '@/types';

export type ContentType = 'carousel' | 'youtube' | 'reel' | 'receipt' | 'generic';

// Matches instagram.com/reel/<code>/ and instagram.com/<user>/reel(s)/<code>/
const REEL_URL_RE = /instagram\.com\/(?:[\w.-]+\/)?(?:reel|reels)\//i;

export function getContentType(item: Item): ContentType {
  if (item.type === 'receipt') return 'receipt';
  if (item.type === 'youtube') return 'youtube';
  if (item.type === 'instagram') {
    if (Array.isArray(item.media) && item.media.length > 1) return 'carousel';
    const src = item.source_url ?? item.raw_url ?? '';
    if (REEL_URL_RE.test(src)) return 'reel';
  }
  return 'generic';
}
```

- [ ] **Step 2:** Port `web/lib/transcript.ts` to `src/lib/transcript.ts` — copy `parseTimestampedSegments`/chapter parsing verbatim (pure string functions, no DOM). Read the web file first and mirror its exported signatures so A2's YouTube tabs can consume them. Adjust only imports.
- [ ] **Step 3:** `npx tsc --noEmit` → PASS. Commit: `feat(detail): port contentType + transcript helpers`.

## Task A2: Build the dispatcher + four missing renderers
**Files:** Create `src/components/inbox/content/{ContentRenderer,YouTubeContent,ReelContent,CarouselContent,GenericContent}.tsx`. **New deps (flag for rebuild): `react-native-webview` (YT embed), `expo-video` (reel/video slides).**

- [ ] **Step 1: Dispatcher** `content/ContentRenderer.tsx` mirroring `web/content/ContentRenderer.tsx:16-31`:

```tsx
import type { Item } from '@/types';
import { getContentType } from '@/lib/contentType';
import { ReceiptContent } from './ReceiptContent';
import { YouTubeContent } from './YouTubeContent';
import { ReelContent } from './ReelContent';
import { CarouselContent } from './CarouselContent';
import { GenericContent } from './GenericContent';

export function ContentRenderer({ item }: { item: Item }) {
  switch (getContentType(item)) {
    case 'receipt': return <ReceiptContent item={item} />;
    case 'youtube': return <YouTubeContent item={item} />;
    case 'reel': return <ReelContent item={item} />;
    case 'carousel': return <CarouselContent item={item} />;
    default: return <GenericContent item={item} />;
  }
}
```

- [ ] **Step 2: GenericContent** (no new deps) — Visual Summary / Transcript tab pair, porting `web/content/GenericContent.tsx:13-74`. Surfaces `item.exploration?.video_insights?.on_screen_text` and per-`media[].summary` under a "Visual Summary" tab, `item.content` (Markdown) under the other. Include the empty states ("No visual summary", "No transcript captured"). Build this first — it's the fallback and needs no native libs.
- [ ] **Step 3: CarouselContent** — extend beyond `MediaCarousel`: pager + **thumbnail strip** + slide counter + per-slide AI Vision toggle (per-slide `.summary`/`.extracted_text`) + **video-slide support** (`expo-video` when `media[i].kind==='video'`). Web ref `content/CarouselContent.tsx:28-212`. Reuse existing `MediaCarousel.tsx` as the pager base. Empty state: "No slides found".
- [ ] **Step 4: YouTubeContent** — thumbnail → tap-to-play via `react-native-webview` (`https://www.youtube.com/embed/<id>`; reuse `extractYoutubeId` from `thumbnails.ts`), channel bar, **Chapters/Transcript tabs** using A1's `transcript.ts`, timestamp rows that seek the embed (`?start=<sec>`). Web ref `content/YouTubeContent.tsx:37-305`. Empty states: "No chapters extracted", "No transcript captured".
- [ ] **Step 5: ReelContent** — 9:16 `expo-video` player (poster = `thumbnailFor`), transcript block, "Watch on Instagram" deep-link, gradient placeholder when no video. Web ref `content/ReelContent.tsx:22-105`.
- [ ] **Step 6:** After each renderer: `npx tsc --noEmit` → PASS, commit per renderer (`feat(detail): mobile <X>Content renderer`).

> ⚠️ Steps 4–5 (and 3's video slides) add native deps → **EAS rebuild + device test required**. Step 2 (Generic) is no-rebuild; land it first to derisk.

## Task A3: Rewire `item/[id].tsx` to dispatch
**Files:** Modify `app/(app)/item/[id].tsx`.

- [ ] **Step 1:** Replace the ad-hoc `type==='receipt'` body branch (`item/[id].tsx:131-160,295-370`) with `<ContentRenderer item={item} />`, keeping the existing meta header, ExploreCTA, EnrichedSections, TagSuggestions, and related-items rail (⭐ preserve these). The renderer owns media + content + per-type empty states.
- [ ] **Step 2:** `npx tsc --noEmit` → PASS; manual device check each content type (youtube plays, reel plays, carousel strip works, generic tabs, receipt unchanged). Commit: `feat(detail): dispatch item body via ContentRenderer`.

---

# PHASE B (P0) — Inbox email alias  (= functional parity #8 / S1)

Independent of Phase A; can run in parallel. **No new deps** (use `expo-clipboard`, likely already present — verify).

**Files:** add `api.getEmailAlias`/`api.regenerateEmailAlias` to `src/lib/api.ts`; create `app/(app)/inbox-alias.tsx` (or `settings/inbox.tsx`); add a row in `app/(app)/settings.tsx`; register the route in `app/(app)/_layout.tsx` (`href:null` hidden + reachable from settings).

- [ ] **Step 1:** Read web `app/api/account/alias/route.ts` to confirm method/shape; add typed client methods mirroring it.
- [ ] **Step 2:** Build the screen porting `InboxAliasForm.tsx:99-148` capabilities: show address, **Copy** (`expo-clipboard`), **Regenerate** (with confirm), "how it works" copy, and the **load / error / RATE_LIMITED** states (`InboxAliasForm.tsx:81-95`).
- [ ] **Step 3:** Add a "Email-to-inbox" row in `settings.tsx` linking to it (web's `/settings/inbox` is orphaned — link it properly here).
- [ ] **Step 4:** `tsc` → PASS; commit `feat(settings): inbox email-alias screen`.

---

# PHASE C (P1) — Detail & inbox interactions

Depends on Phase A (detail restructured). Mostly no-rebuild.

- [ ] **C-D6 Source-type chip:** add a type/source chip to the detail meta header, porting `ItemDrawer.tsx:102-155` `sourceChip` logic (icon via existing `typeGlyph`, label like "Instagram Carousel · N slides", "YouTube Video"). File: `item/[id].tsx`.
- [ ] **C-D7 Inline tag add/remove:** replace read-only tag badges (`item/[id].tsx:372-378`) with add-input + per-tag `×`, patching via `api.patchItem`. Web ref `ItemDrawer.tsx:825-925`.
- [ ] **C-D8 Share action:** add Share to the detail toolbar using RN `Share.share({ url })`; mirror web `lib/share.ts`. File: `item/[id].tsx:104-128` + optionally `ItemActionsMenu.tsx`.
- [ ] **C-D9 Wire ExploreCTA:** pass an `onPress` that calls a new `api.exploreMany([id],{deep})` mutation (see functional NEXT-STEPS #5 — **do that task here, once**), driving the 5 states from `isPending`/`isError`/`isSuccess`, invalidate `['items']`. Files: `src/lib/api.ts`, `ExploreCTA.tsx:24,138`, `item/[id].tsx:232-237`.
- [ ] **C-D10 "No matches" inbox state:** distinguish filtered-empty from first-run-empty in `inbox.tsx:184-189` (mirror `InboxGrid.tsx:163,186-192`).
- [ ] Per task: `tsc` → PASS + commit.

---

# PHASE D (P1) — Chat richness

- [ ] **C3 first (enabler):** extend mobile `CitedItem` (`types/index.ts:119-126`) with the richer fields web's `x-items` carries (thumbnail/`og_image`, `raw_url`, `site_name`, `status`) and extend the parser (`api.ts:208-214`) to keep them. Without this, pills can't show thumbnails.
- [ ] **C1 Citation pills:** replace the markdown `a`/link renderer (`ChatMessage.tsx:21-28,109-115`) so inline `[[id]]` renders an `ItemChip`-style pill (thumbnail + `[index]` + domain, tap → `/item/:id`). Port `chat/ItemChip.tsx` look into RN.
- [ ] **C2 Empty/welcome + suggested prompts:** rebuild `ChatWindow.tsx:23-32` empty state into a branded welcome with 3 tappable example prompts that auto-send (port `ChatWindow.tsx:14-18,95-106`). ⭐ keep ConversationItemsStrip + New-chat.
- [ ] **C4/C5 (P2):** send-button spinner (`ChatInput.tsx`); "might be related" fallback rail (`ChatMessage.tsx:144-146`).
- [ ] Per task: `tsc` → PASS + commit.

---

# PHASE E (P1) — Digest / settings / nav

- [ ] **S3 Pending jobs section:** add an "in-progress" section to the digest list porting `digest/page.tsx:123-164` (active/queued/scheduled/failed + attempts + failedReason). Verify the data source (BullMQ status endpoint) exists for the native client; add a client method if needed. File: `digest/index.tsx`.
- [ ] **S4 Local-time picker:** replace raw-UTC text field (`digest-settings.tsx:112-126`) with `@react-native-community/datetimepicker` (⚠️ new dep → rebuild) + UTC↔local conversion mirroring `settings/digest:19-37`.
- [ ] **S5 Wide-screen nav fallback:** when tabs hide at ≥768 (`(app)/_layout.tsx:33-35`), render a side/persistent nav so primary destinations stay reachable on tablet.
- [ ] **S6/S7 (P2):** digest detail window-range label; empty-sections message; list empty-CTA + category preview row.
- [ ] Per task: `tsc` → PASS + commit.

---

# PHASE F (P2) — Polish tier

- [ ] **D11** mount the 3rd "detail" view-mode in inbox: extend `ViewModeToggle.tsx` to 3-way and render the already-built `ItemDetailRow` in `inbox.tsx` (`InboxGrid.tsx:197-200` ref).
- [ ] **D12** editable summary + Regenerate affordance on detail (`ItemDrawer.tsx:927-977` ref).
- [ ] **S8** expand mobile signup error-code map to match web (`signup/page.tsx:12-21`).
- [ ] Chat C4/C5 if not already done in Phase D.

---

## Dependency / rebuild map

| Phase | Depends on | New native deps (→ EAS rebuild) |
|-------|-----------|----------------------------------|
| A1 | — | none |
| A2 Generic | A1 | none |
| A2 Carousel/YouTube/Reel | A1 | `react-native-webview`, `expo-video` |
| A3 | A1+A2 | (inherits) |
| B | — | `expo-clipboard` (verify; usually bundled) |
| C | A | none (Share is RN core) |
| D | — | none |
| E (S4) | — | `@react-native-community/datetimepicker` |
| F | A (D11) | none |

**Recommended sequencing:** Land **A1 + A2-Generic + A3** (no-rebuild, immediately fixes the worst case — non-YT/reel items get proper tabs) and **Phase B** and the **no-rebuild Phase C/D items** in a first PR. Batch all native-dep work (A2 YouTube/Reel/video slides, E-S4 picker) into a single "native UI" EAS rebuild cycle so you only rebuild once.

## Preserve list (do NOT regress)
Related-items rail · processing-error banner · date-bucketed list · pull-to-refresh + realtime subscribe · ConversationItemsStrip · New-chat reset · AbortController · 3-way theme selector · About/version · digest item deep-links · push-notification deep-linking.

## Self-review
- **Spec coverage:** every audited gap mapped (D1–D12, C1–C5, S1–S8) with severity + file:line; ✅ S2 already shipped (PR #6); D9≡functional #5 and S1≡functional #8 cross-referenced to avoid duplicate work.
- **Dependency integrity:** content renderers (A2) require A1 helpers + the dispatcher; A3 requires A2; chat pills (C1) require the type/parser enabler (C3).
- **Fidelity note:** A1/dispatcher/alias/chip-type given as concrete code; heavy native renderers (YouTube/Reel/Carousel-video) given as structured specs + web refs + RN lib choices because they require device iteration — consistent with how native-build work was scoped in the functional parity plan.
