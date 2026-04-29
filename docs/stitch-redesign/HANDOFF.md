# Flowy — Image-Led Redesign · Handoff for Planning

> **Status:** design exploration complete in Stitch. Ready for implementation planning.
> **Date:** 2026-04-28
> **Author:** CJ (with Claude Code + Stitch MCP)
> **Worktree:** `merry-jumping-tome`

---

## What this is

A redesign of Flowy's primary user flow (Inbox → Item Detail → Chat → Settings) around an **image-led card pattern** with a **Grid ↔ List view-mode toggle**. The redesign keeps the existing "Warm Paper + Dark Graphite" brand identity and the existing tokens in `global.css` and `tailwind.config.js` — it does **not** introduce new tokens or replace the design system.

The Stitch screens in this folder are **visual specification**, not code source. Implementation is React Native + Expo + NativeWind, and uses the existing `src/components/` architecture.

---

## Visual reference (this folder)

| File | Screen | Notes |
|------|--------|-------|
| `06-inbox-image-led.png` | Inbox · grid (image-led) — original variant | The pattern decision moment |
| `07-inbox-compact.png` | Inbox · list (compact density) — original variant | Sibling view mode |
| `08-inbox-grid-with-toggle.png` | Inbox · grid + view-mode toggle | **Final spec for grid mode** |
| `09-inbox-list-with-toggle.png` | Inbox · list + view-mode toggle | **Final spec for list mode** |
| `10-chat-image-led-strip.png` | Chat · image-led "Items in this conversation" strip | **Final spec for Chat** |
| `11-item-detail-image-led.png` | Item Detail · image-led layout | Final structure (hero photo placeholder still off-prompt; will use real saved-content thumbnails in app) |
| `05-settings.png` | Settings | **Final spec — minimal change required** |
| `12-*-dark.png` | Dark-mode variants of grid / chat / settings | Reference only — actual switch is via existing `.dark` class on root View |

Stitch project (for live editing if needed):
- Project: `projects/7627295730853729703`
- Design system asset (v3, image-led canonical): `assets/10064709796777805984`

---

## Brand tokens — already in the codebase

**Do not duplicate or re-import.** The tokens below are already defined in `global.css` (CSS variables) and mapped to Tailwind classes in `tailwind.config.js`.

| Purpose | Tailwind class | Light value | Dark value |
|---------|----------------|-------------|------------|
| Screen background | `bg-bg` | `#F8F4EA` warm paper | `#1A1C20` dark graphite |
| Surface (grouped) | `bg-surface` | `#F0E8D4` | `#20232A` |
| Card | `bg-card` | `#FFFFFF` | `#272A31` |
| Foreground / primary | `text-fg` / `bg-primary` | `#1C1815` | `#EEEAE0` |
| Muted | `text-muted` | `#6B6258` | `#9DA1AA` |
| Accent | `text-accent` / `bg-accent` | `#DB663C` | `#EB7C4C` |
| Border (hairline) | `border-border` | `#DFD5C2` | `#3A3D44` |
| Bottom tab bar | (literal `#1A1C20`) | `#1A1C20` (always dark, even in light mode) | `#1A1C20` |
| Status · ready | `bg-success` | `#10B981` | `#34D399` |
| Status · processing | `bg-accent` | `#DB663C` | `#EB7C4C` |

**Fonts (already loaded):**
- `font-sans` → `Inter_400Regular`
- `font-medium` → `Inter_500Medium`
- `font-semibold` → `Inter_600SemiBold`
- `font-display` → `InstrumentSerif_400Regular` *(used as Flowy's editorial serif — Stitch screens reference "Newsreader" but `Instrument Serif` is the actual loaded font, similar character)*

**Theme switching is already wired** via `src/lib/theme.tsx` → `colorScheme.set('dark' | 'light')` → NativeWind toggles `class="dark"` on the root View.

---

## Canonical patterns (the design contract)

### 1. Bottom tab bar (signature element)
- Always dark `#1A1C20`, in both light and dark themes.
- 24px top corner radius, flush to safe area, ~72px tall.
- TEXT-only labels: `Inbox · Chat · Settings`. **No icons.** This is non-negotiable brand.
- Active tab: cream/white text + small dot beneath.
- Right edge: 56×56 fully-rounded orange `#DB663C` (light) / `#EB7C4C` (dark) FAB with `+` glyph.

### 2. View-mode toggle (the ONE place icons are allowed)
- Lives in the inbox header between bell and avatar.
- Hairline-bordered pill (~32px tall) containing two icons divided by a hairline.
- Active glyph: filled graphite/cream background. Inactive: muted icon, no fill.
- Toggles between Grid (image-led) and List (compact) modes.

### 3. Image-led item card (Grid mode default)
- Full-bleed photo fills top ~70% of card (rounded 20px outer, photo follows curvature).
- Frosted-glass white pill (`rgba(255,255,255,0.92)`) in top-left of photo: tiny favicon + domain.
- Videos: black frosted pill in bottom-left of photo with play glyph + duration.
- White footer strip: title (Inter semibold ~22px, 2 lines max) + metadata row (Inter small muted on left, big serif date on right).
- **No category chips on these cards** — the photo carries the category.

### 4. Compact list row (List mode)
- 64px tall, hairline `#DFD5C2` divider between rows on warm paper canvas (no card surface).
- 40×40 rounded-8 thumbnail on left.
- Title (Inter medium 15px ellipsis) + sub-line `domain · category · time ago` (muted).
- Right: serif date stamp + tiny status dot (orange = AI processing, green = ready).

### 5. Orange hero suggestion card
- Full-bleed warm orange `#DB663C`/`#EB7C4C`, rounded 20px.
- "Flowy AI" + "Suggested for you" label row.
- BIG editorial serif headline (3 lines max, tight line-height).
- Bottom: 5 stacked thumbnails + "+5" indicator (grid mode), or compressed `AI DIGEST · Ready to review` chip strip (list mode).
- Loud and singular — only one accent-orange element per visible viewport.

### 6. Item detail (list → detail visual continuity)
- Hero photo comes FIRST (above the title), full-bleed within margins, rounded 20px.
- Source pill in top-left of hero (mirrors the card thumbnail).
- Editorial serif title sits BELOW the image.
- Full-width orange "Open original" pill CTA below title.
- Body: Inter 16/26 paragraphs + one blockquote with warm-orange left rule + italic serif quote.
- "Flowy AI · Three things to take away" summary card.
- Related items strip = mini image-led cards (rounded 16px).

### 7. Chat
- AI bubble: card surface, hairline border, cream/graphite text.
- User bubble: graphite (light) / cream (dark) inverse fill, right-aligned.
- Citation chips: warm orange pill with "[1] domain.com" inside running AI text.
- "Items in this conversation" strip: mini image-led cards (140×160, rounded 16, frosted source pill).
- Input bar: pinned pill with "+" attach left, muted placeholder, orange circular send button right.

### 8. Settings
- iOS grouped-list rhythm but on warm paper (light) / dark graphite (dark).
- Newsreader serif page title `Settings.`
- Theme segmented control: `Warm Paper · Dark Graphite · System`.
- Single accent-orange moment: the "Auto-process with Flowy AI" toggle's active state.
- Sign out card with thin orange bottom indicator (not red — minimal destructive treatment).

---

## Implementation plan — recommended phasing

### Phase 1 · Image-led `ItemCard` + view-mode prop (~3–4 hrs)
**Files to touch:**
- `src/components/inbox/ItemCard.tsx` — add new image-led layout (Grid mode). Existing card becomes the *fallback* link/note card when no thumbnail exists.
- `src/components/inbox/ItemRow.tsx` — already exists; verify it matches the compact-list spec (status dot, serif date, hairline dividers, sub-line metadata).
- `src/lib/viewMode.ts` — already exists; ensure it persists `'grid' | 'list'`.
- `src/hooks/useItems.ts` — no schema change needed; cards/rows render same `Item` shape.

**Acceptance:** Inbox screen renders `ItemCard` in grid mode and `ItemRow` in list mode; toggle in header switches between them; both modes render against `bg-bg`.

### Phase 2 · View-mode toggle + suggestion hero card (~2–3 hrs)
**New components:**
- `src/components/inbox/ViewModeToggle.tsx` — segmented pill, two icons, `active`/`inactive` states. Reads/writes from `viewMode.ts`.
- `src/components/inbox/SuggestionHeroCard.tsx` — full-bleed orange card, serif headline, thumbnail strip (grid) or `AI DIGEST` chip (list).

**Files to touch:**
- `app/(app)/inbox.tsx` — render `ViewModeToggle` in header, render `SuggestionHeroCard` above the card/row stack, render section headers in list mode.

**Acceptance:** Header shows the toggle; hero card renders above the feed; toggle smoothly swaps card stack ↔ row list.

### Phase 3 · Chat image-led strip + Item Detail layout (~2–3 hrs)
**Files to touch:**
- `src/components/chat/ChatWindow.tsx` — replace existing thumbnail strip with mini image-led cards (140×160, frosted source pill, footer title).
- `src/components/chat/Citation.tsx` — verify orange pill chip styling matches spec.
- `app/(app)/item/[id].tsx` — reorder layout: hero photo first (above title), title below, full-width orange CTA below dek, then body / blockquote / AI summary / related strip.

**Acceptance:** Chat shows mini image-led cards in conversation context; Item Detail flows hero → title → CTA → body; tap-from-Inbox visual continuity feels intentional.

---

## Out of scope — do **not** touch in this redesign

- `src/lib/theme.tsx`, `global.css`, `tailwind.config.js` — tokens are already correct. No additions, no renames.
- Bottom tab bar — already brand-aligned.
- `FilterBar` — already matches spec (pill chips with active/inactive states).
- Auth screens (`(auth)/login.tsx`) — out of redesign scope.
- Share extension (`plugins/withShareExtension.js`, `ios/ShareExtension/`) — out of scope.
- Settings — already matches spec; only verify theme toggle UI matches the segmented control style.
- PocketBase realtime sync, hooks data layer, API contracts — no changes.

---

## Open questions for plan mode

1. **Image-led cards when no thumbnail exists.** Saved notes / plain links won't have a photo. Spec says "fallback link/note card with serif title carrying the visual weight." Decide: render as a different card variant in grid mode, or fall back to compact-row treatment inline? Recommendation: variant card (keeps grid grid-shaped).
2. **Suggestion hero card data source.** Where does the AI-curated suggestion come from? New API endpoint, or first-fitting existing item with a `category: "digest"` flag? Recommendation: stub it client-side for now, design API later.
3. **View-mode toggle persistence.** Per-device only, or sync to PocketBase user record? Recommendation: per-device via `viewMode.ts` (already exists), defer cross-device sync.
4. **Hero image placeholders for review screenshots.** Stitch's renderings included off-prompt people. In the real app, hero images come from saved-content thumbnails (already R2-hosted). Confirm: no need to ship demo imagery.
5. **Animation between view modes.** Crossfade? Layout animation? Recommendation: `LayoutAnimation` on iOS (free), no Reanimated needed.

---

## Quick reference for the planner

When you start `/gsd-plan-phase` or similar, the planner should know:
- Brand tokens are settled. Don't propose new colors or fonts.
- Existing component architecture is correct. Add new components, don't refactor existing ones.
- The 3-phase split above is a recommendation. Reorder if you spot a smaller/safer first commit.
- The Stitch screens are reference — match the **patterns**, not the literal pixel values.
- Test against PocketBase realtime updates: the inbox feed must still re-render on `items` changes regardless of view mode.

**Start here:** read the screens in this folder, then `src/components/inbox/ItemCard.tsx` and `app/(app)/inbox.tsx` to understand the current state, then propose Phase 1.
