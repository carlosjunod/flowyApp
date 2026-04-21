# Flowy Mobile — Palette + Polish Port

**Date:** 2026-04-21
**Status:** Approved
**Scope:** Bring the flowyApp (Expo/React Native) visual system in line with the recent Flowy web redesign (`Flowy/apps/web` — commits `a1778fb` UI upgrade + `dcb6c0b` rebrand). Tier B from the brainstorm: palette + typography + dark mode + essential motion. No full component rewrite.

## Goals

1. Mobile renders the "Warm Paper" light theme and "Dark Graphite" dark theme with pixel-close fidelity to web.
2. Inter + Instrument Serif fonts load reliably on app start.
3. A 3-state theme toggle (light / dark / system) persists across app restarts.
4. Cards, buttons, and list items carry subtle motion (entry fade-in, pressed scale, pending shimmer).
5. Brand copy rebranded "Tryflowy" → "Flowy" (display strings only — bundle IDs and slugs remain).

## Non-goals

- Rewriting ItemCard to match web's hover actions (retry/delete on the card itself). The mobile detail screen already owns those actions.
- Rebuilding the chat input, item detail modal, or filter bar layouts. Only color / typography / shadow updates.
- Renaming `app.json` `slug`, `scheme`, `bundleIdentifier`, `appleTeamId`, or associated domains. These are signing-critical.
- Loading JetBrains Mono on mobile (no code blocks warrant it yet).

## Design tokens

Keep existing short names (`bg`, `fg`, `card`, `accent`, `muted`, `border`) to avoid touching every consuming component. Add `surface` and `primary` for web parity.

### Light (Warm Paper)

| Token | Hex | Source (web HSL) |
|---|---|---|
| `bg` | `#F8F4EA` | `hsl(40 30% 97%)` |
| `surface` | `#F0E8D4` | `hsl(40 25% 94%)` |
| `card` | `#FFFFFF` | `hsl(0 0% 100%)` |
| `fg` / `primary` | `#1C1815` | `hsl(20 14% 10%)` |
| `muted` | `#6B6258` | `hsl(20 8% 38%)` |
| `accent` | `#DB663C` | `hsl(15 75% 50%)` |
| `border` | `#DFD5C2` | `hsl(30 12% 82%)` |

### Dark (Graphite)

| Token | Hex | Source |
|---|---|---|
| `bg` | `#1A1C20` | `hsl(220 8% 11%)` |
| `surface` | `#20232A` | `hsl(220 7% 14%)` |
| `card` | `#272A31` | `hsl(220 6% 17%)` |
| `fg` / `primary` | `#EEEAE0` | `hsl(40 12% 92%)` |
| `muted` | `#9DA1AA` | `hsl(220 6% 65%)` |
| `accent` | `#EB7C4C` | `hsl(15 82% 62%)` |
| `border` | `#3A3D44` | `hsl(220 5% 24%)` |

Status colors (`danger`, `success`) carry over unchanged.

### Category pill palette (hash-based)

Match web's `ItemCard.categoryColor()`. Palette order: `rose`, `amber`, `emerald`, `sky`, `violet`, `fuchsia`. Hash function must be byte-identical to web's so "recipes" renders the same color on both platforms:

```ts
// Identical to web/components/inbox/ItemCard.tsx categoryColor()
let hash = 0;
for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
return palette[hash % palette.length];
```

Implementation: extend `Badge` with an optional `palette: string | null` prop that, when present, hashes the string to one of six pairs. Values are inlined in a `categoryPalettes` const map rather than `bg-{c}-100` utilities, since NativeWind's generated Tailwind build does not include the full color palette by default. Light: `{bg: '#FFE4E6', text: '#9F1239'}` etc. Dark: `{bg: 'rgba(244,63,94,0.15)', text: '#FECDD3'}` etc. Rendered via inline style in dark mode, Tailwind class in light (both work via `useTheme().resolved`).

## Dark mode architecture

- `tailwind.config.js` sets `darkMode: 'class'`.
- New `src/lib/theme.tsx` exposes:
  - `type Theme = 'light' | 'dark' | 'system'`
  - `type Resolved = 'light' | 'dark'`
  - `useTheme()` → `{ theme, resolved, setTheme, toggle }`
- Persistence: `expo-secure-store` under key `flowy.theme`. (SecureStore already in deps.)
- System listener: `Appearance.addChangeListener` keeps `resolved` in sync when theme is `'system'`.
- Dark-class application: `NativeWindStyleSheet.setColorScheme(resolved)` from `nativewind` — this is the documented way to programmatically drive `dark:` utilities in NativeWind 4 with `darkMode: 'class'`.
- `app.json` `userInterfaceStyle` stays `"automatic"` (StatusBar + system chrome follow OS; our in-app surfaces follow resolved).

### Theme toggle UI

A small icon button in the inbox header (left of "Sign out"). Tap cycles: `system → light → dark → system`. Icon reflects current `theme` state:
- `system` → device icon
- `light` → sun
- `dark` → moon

Implementation: `src/components/ui/ThemeToggle.tsx`. Icons: lightweight SVG components (no extra deps) — three ~20×20 paths inlined.

## Typography

Load via `@expo-google-fonts/inter` and `@expo-google-fonts/instrument-serif`:

```tsx
// app/_layout.tsx
const [fontsLoaded] = useFonts({
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  InstrumentSerif_400Regular,
});
if (!fontsLoaded) return null;
```

Tailwind config:

```js
fontFamily: {
  sans: ['Inter_400Regular'],
  medium: ['Inter_500Medium'],
  semibold: ['Inter_600SemiBold'],
  display: ['InstrumentSerif_400Regular'],
}
```

Usage:
- `font-display` on screen titles ("Inbox", "Chat", "Flowy" brand mark on login, item titles in detail view).
- `font-semibold` on buttons, card titles.
- `font-sans` body default (inherited via `Text` styling in components).

## Shadows

Two named shadows via Tailwind `boxShadow`:

```js
boxShadow: {
  card: '0 1px 2px rgba(28, 24, 21, 0.06)',
  'card-hover': '0 12px 24px rgba(28, 24, 21, 0.12)',
}
```

Android fallback: add `elevation: 2` via inline style on card-like containers in `ItemCard`, `ItemDetailRow`, and chat citation chips. NativeWind translates `shadow-card` to iOS shadow props automatically; Android needs elevation to render.

## Motion

Three patterns using Reanimated (already in deps) and plain Pressable:

1. **Entry fade-in on list items** — `Animated.View` from `react-native-reanimated` with `entering={FadeIn.duration(220)}` on the outermost row of `ItemCard`, `ItemRow`, `ItemDetailRow`.
2. **Pressed scale** — `Pressable` with `style={({pressed}) => pressed && { transform: [{ scale: 0.98 }], opacity: 0.96 }}`. Applied to `ItemCard`, `ItemRow`, `ItemDetailRow`, `Button`, `FilterBar` chips.
3. **Shimmer on pending cards** — new `src/components/ui/Shimmer.tsx`: an absolute-positioned `LinearGradient` (`expo-linear-gradient` — new dep) driven by `useSharedValue` + `withRepeat(withTiming(...))` on `translateX`. Used in `ItemCard` pending state overlay and placeholder bar.

Honor `AccessibilityInfo.isReduceMotionEnabled()` where practical — the fade-in animations already skip on reduce-motion because FadeIn respects it by default.

## Component refactor summary

Every file listed gets token-class replacements (`bg-card` stays, but its rendered color changes; a few add `dark:` variants where web differentiates dark from light beyond the raw token swap).

### New
- `src/lib/theme.tsx` — ThemeProvider, useTheme, SecureStore persistence, Appearance listener, NativeWind colorScheme sync.
- `src/components/ui/ThemeToggle.tsx` — cycle button + inlined sun/moon/system SVG icons.
- `src/components/ui/Shimmer.tsx` — Reanimated shimmer overlay.

### Modified
- `tailwind.config.js` — new color tokens, fontFamily, boxShadow, darkMode: 'class'.
- `app/_layout.tsx` — wrap tree in ThemeProvider, load fonts, hold render until fonts+auth ready.
- `app/(app)/_layout.tsx` — tab bar colors pulled from resolved theme (no more hardcoded hex).
- `app/(app)/inbox.tsx` — header: "Inbox" in `font-display`, add ThemeToggle.
- `app/(app)/chat.tsx` — "Chat" in `font-display`.
- `app/(app)/item/[id].tsx` — title in `font-display`, modal bg uses `bg-card`, placeholderTextColor wired to muted via theme hook.
- `app/(auth)/login.tsx` — "Flowy" branding in `font-display`, placeholderTextColor wired to theme.
- `app/index.tsx`, `app/(auth)/_layout.tsx` — no code change; inherit token updates.
- `src/components/ui/Button.tsx` — variant palette updated (primary=accent, secondary=card/border, ghost=transparent+accent text, danger=red); add pressed scale transform; add `accent` variant mirroring web.
- `src/components/ui/Badge.tsx` — add optional `palette` prop for hashed category colors.
- `src/components/ui/Spinner.tsx` — color from theme (accent).
- `src/components/ui/Thumbnail.tsx` — token refresh only.
- `src/components/inbox/ItemCard.tsx` — `shadow-card`, elevation fallback, pressed scale, FadeIn entering, hashed category pill, pending shimmer.
- `src/components/inbox/ItemRow.tsx` — FadeIn, pressed scale, token refresh.
- `src/components/inbox/ItemDetailRow.tsx` — FadeIn, pressed scale, token refresh.
- `src/components/inbox/FilterBar.tsx` — chip styles use surface/border; active state uses accent; placeholder via theme.
- `src/components/chat/ChatMessage.tsx` — markdown styles driven by theme hook, not hardcoded hex.
- `src/components/chat/ChatInput.tsx` — placeholder color via theme, accent send button pressed state.
- `src/components/chat/ChatWindow.tsx` — token refresh only.
- `app.json` — `name: "Tryflowy"` → `"Flowy"`. Slug/scheme/bundleId untouched. `splash.backgroundColor: "#ffffff"` → `"#F8F4EA"` (matches Warm Paper bg).

### Dependencies added
- `@expo-google-fonts/inter`
- `@expo-google-fonts/instrument-serif`
- `expo-font` (required by google-fonts packages; Expo bundles it but may need explicit install)
- `expo-linear-gradient` (for shimmer)

## Verification

No visual test suite exists on mobile. Manual checks after implementation:

- [ ] `npm run typecheck` passes.
- [ ] `npx expo start --ios` launches without runtime errors.
- [ ] Inbox renders Warm Paper in light mode (cream bg, orange accent chips, dark serif "Inbox" title).
- [ ] Toggle icon cycles system → light → dark → system; each click updates visible surfaces immediately.
- [ ] Theme persists across full app kill + relaunch.
- [ ] Switching device appearance (Settings → Developer → Dark Appearance toggle) while theme is "system" flips the resolved theme live.
- [ ] ItemCard shows visible shadow on iOS and elevation on Android.
- [ ] Pressing an ItemCard visibly scales down ~2%.
- [ ] Pending ItemCard shows the shimmer animation.
- [ ] Login screen: "Flowy" in serif, button is orange-red, inputs read correctly in dark.
- [ ] Chat messages: user bubble is accent, assistant bubble uses card bg and fg text; both themes.
- [ ] No "Tryflowy" string appears anywhere user-visible (except bundle-level strings in Settings app, which we intentionally leave).

## Known risks

- **NativeWind 4 + `darkMode: 'class'` + new arch**: `NativeWindStyleSheet.setColorScheme` is the documented hook, but the new architecture (`newArchEnabled: true`) has historically shipped edge cases. If the `dark:` utilities don't cascade, fallback is to render two inline style objects per component via `useTheme().resolved`. This is captured as a fallback in Phase 3 of the plan.
- **Font flash**: returning `null` from `_layout.tsx` until fonts load means the splash screen stays visible a beat longer. Acceptable vs. the alternative (flash of system font before Inter swaps in).
- **Shimmer perf on older devices**: Reanimated shimmer runs on the UI thread via worklets — should be cheap, but if an older iPhone struggles we drop to a plain `ActivityIndicator` in pending state.

## Out of scope for this pass (parked)

- Rebuilding ItemCard with web-style hover retry/delete actions. (Mobile has its own pattern: tap opens detail screen with actions.)
- Web's ItemDrawer side-panel experience on tablets. (Mobile's full-screen stack nav is the native pattern.)
- ThemeScript-style FOUC prevention. (Splash screen covers it.)
- E2E visual regression tests.
