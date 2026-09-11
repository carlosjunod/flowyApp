import { vars } from "nativewind";
import { useTheme } from "./theme";

// Mirrors apps/web/app/globals.css (Warm Paper / Dark Graphite).
// Kept local to Digest so this refinement cannot recolor unrelated screens.
export const digestColors = {
  light: {
    bg: "#FAF8F5",
    surface: "#F4F1EC",
    card: "#FFFFFF",
    fg: "#1D1816",
    primary: "#1D1816",
    accent: "#DF5020",
    accentStrong: "#B63E16",
    muted: "#695E59",
    border: "#D7D1CC",
    onAccent: "#FFFFFF",
  },
  dark: {
    bg: "#1A1B1E",
    surface: "#212326",
    card: "#292A2E",
    fg: "#EDEBE8",
    primary: "#EDEBE8",
    accent: "#EE764F",
    accentStrong: "#C14015",
    muted: "#A0A4AB",
    border: "#3A3C40",
    onAccent: "#FFFFFF",
  },
} as const;

const digestVars = {
  light: vars({
    "--color-bg": "250 248 245",
    "--color-surface": "244 241 236",
    "--color-card": "255 255 255",
    "--color-fg": "29 24 22",
    "--color-primary": "29 24 22",
    "--color-accent": "223 80 32",
    "--color-muted": "105 94 89",
    "--color-border": "215 209 204",
    "--color-on-accent": "255 255 255",
  }),
  dark: vars({
    "--color-bg": "26 27 30",
    "--color-surface": "33 35 38",
    "--color-card": "41 42 46",
    "--color-fg": "237 235 232",
    "--color-primary": "237 235 232",
    "--color-accent": "238 118 79",
    "--color-muted": "160 164 171",
    "--color-border": "58 60 64",
    "--color-on-accent": "255 255 255",
  }),
};

export function useDigestColors() {
  return digestColors[useTheme().resolved];
}

export function useDigestVars() {
  return digestVars[useTheme().resolved];
}
