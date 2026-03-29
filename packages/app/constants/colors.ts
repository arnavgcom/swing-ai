/**
 * Colour constants – Apple Fitness / Apple Sports inspired.
 * Uses official Apple dark-mode system colour values.
 */

// ─── Core palette ────────────────────────────────────────────
const primary = "#0A84FF"; // Apple system blue
const primaryLight = "#409CFF";
const primaryDark = "#0071E3";
const neon = "#30D158"; // Apple system green
const neonDark = "#28CD41";
const midnight = "#000000"; // pure black
const darkSurface = "#1C1C1E"; // systemGray6
const darkCard = "#2C2C2E"; // systemGray5
const darkCardAlt = "#3A3A3C"; // systemGray4
const darkBorder = "rgba(84,84,88,0.36)"; // Apple separator
const glow = "rgba(10,132,255,0.15)";
const white = "#FFFFFF";
const offWhite = "#8E8E93"; // systemGray
const muted = "#636366"; // systemGray2
const accent = "#30D158"; // green for positive
const red = "#FF453A"; // Apple system red
const amber = "#FFD60A"; // Apple system yellow
const blue = "#0A84FF";
const cyan = "#64D2FF";

export default {
  light: {
    text: "#000000",
    textSecondary: "#3C3C43",
    background: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceAlt: "#F2F2F7",
    border: "#C6C6C8",
    tint: primary,
    tintDark: primaryDark,
    accent: neon,
    tabIconDefault: muted,
    tabIconSelected: primary,
    red,
    amber,
    blue,
    glow,
    neon,
    neonDark,
  },
  dark: {
    text: white,
    textSecondary: offWhite,
    background: midnight,
    surface: darkSurface,
    surfaceAlt: darkCard,
    border: darkBorder,
    tint: primary,
    tintDark: primaryDark,
    accent: neon,
    tabIconDefault: muted,
    tabIconSelected: neon,
    red,
    amber,
    blue,
    glow,
    neon,
    neonDark,
  },
};

export const sportColors: Record<string, { primary: string; gradient: string }> = {
  Tennis: { primary: "#30D158", gradient: "#28CD41" },
  Golf: { primary: "#64D2FF", gradient: "#40C8E0" },
  Pickleball: { primary: "#FF9F0A", gradient: "#FF9500" },
  Paddle: { primary: "#BF5AF2", gradient: "#AF52DE" },
  Badminton: { primary: "#FF453A", gradient: "#FF3B30" },
  "Table Tennis": { primary: "#0A84FF", gradient: "#007AFF" },
};
