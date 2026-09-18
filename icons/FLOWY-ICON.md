# Flowy icon

## Approved iOS icon — 2026-09-16

`icon-1024.png` is the approved iOS raster master: lowercase italic f with a curled descender, charcoal on orange, and a white dot whose right edge aligns with the upper terminal of the f. `assets/icon.png` mirrors it. Expo's `app.config.ts` already selects `./icons/icon-1024.png`; the generated iOS AppIcon asset is refreshed locally too.

The master is a 1024 × 1024 sRGB RGB PNG, without alpha, presentation margins, exterior shadows, or pre-rounded corners. iOS applies its own mask. Changes appear after a new native build, not an OTA update. The earlier SVGs and Android/splash exports below represent the preceding design and are not the source for this approved iOS icon.

The web repository uses the same mark in `apps/web/app/icon.png`, `apps/web/app/apple-icon.png` and its three PWA icon exports. The maskable export has additional padding.

Approved image, pre-change backups and validation previews are archived locally at `/Users/carlosjunod/Documents/Flowy-Icon-2026-09-16/`.

## Earlier vector design

The mark is lowercase italic f with a white dot, using outlined Instrument Serif Italic. Orange #F2764C; ink #1A1B1E.

flowy-icon.svg is the full square source. flowy-icon-rounded.svg is for rounded display. flowy-icon-adaptive.svg is the transparent Android foreground, paired with #F2764C.

iOS icon exports must be opaque RGB PNG, with no pre-rounded corners. Android foreground must retain transparency. Native launcher and splash changes require a new build.

Editable source and generation scripts are archived locally in Documents/Flowy - Anuncios/Marca/flowy-f-dot. Web and native SVG files contain outlines, so rendering requires no installed font.

## Validation and release hold — 2026-09-16

- Xcode `actool` compiled the new PNG into an iOS simulator asset catalog successfully. Metadata confirms 1024 × 1024, RGB, sRGB, no alpha.
- The browser preview was inspected at 16, 32, 40 and 60 pixels on light/dark backgrounds. Next.js returns the new favicon with HTTP 200 and emits both favicon and Apple touch metadata; the web workspace typecheck passes. Root typecheck still reports errors in test files and does not pass.
- A standalone icon-preview installation and a read-only app listing both stalled on the already-running iOS 26 simulator; these commands were stopped without restarting it. Actual SpringBoard rendering and physical-device validation remain unverified.
- User release hold: do not start a TestFlight build or submission for this icon alone. Release it together with the additional feature the user plans to add.
