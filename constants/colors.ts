const primary = "#6C5CE7";
const primaryLight = "#A29BFE";
const primaryDark = "#5A4BD1";
const neon = "#34D399";
const neonDark = "#10B981";
const midnight = "#0A0A1A";
const darkSurface = "#131328";
const darkCard = "#1A1A36";
const darkCardAlt = "#22224A";
const darkBorder = "#2A2A5060";
const glow = "#6C5CE720";
const white = "#F8FAFC";
const offWhite = "#CBD5E1";
const muted = "#64748B";
const accent = "#34D399";
const red = "#F87171";
const amber = "#FBBF24";
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
