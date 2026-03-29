const primary = "#818CF8";
const primaryLight = "#A5B4FC";
const primaryDark = "#6366F1";
const neon = "#4ADE80";
const neonDark = "#22C55E";
const midnight = "#050A18";
const darkSurface = "#0C1428";
const darkCard = "#111C38";
const darkCardAlt = "#162040";
const darkBorder = "#ffffff18";
const glow = "#818CF818";
const white = "#F1F5F9";
const offWhite = "#B0BEC5";
const muted = "#546E7A";
const accent = "#4ADE80";
const red = "#FB7185";
const amber = "#FCD34D";
const blue = "#60A5FA";
const cyan = "#22D3EE";

export default {
  light: {
    text: "#0F172A",
    textSecondary: "#64748B",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",
    border: "#E2E8F0",
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
  Tennis: { primary: "#10B981", gradient: "#059669" },
  Golf: { primary: "#22D3EE", gradient: "#0891B2" },
  Pickleball: { primary: "#F59E0B", gradient: "#D97706" },
  Paddle: { primary: "#8B5CF6", gradient: "#7C3AED" },
  Badminton: { primary: "#EF4444", gradient: "#DC2626" },
  "Table Tennis": { primary: "#3B82F6", gradient: "#2563EB" },
};
