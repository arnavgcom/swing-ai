const emerald = "#10B981";
const emeraldDark = "#059669";
const navy = "#0F172A";
const slate = "#1E293B";
const slateMid = "#334155";
const slateLight = "#475569";
const white = "#F8FAFC";
const offWhite = "#E2E8F0";
const accent = "#22D3EE";
const red = "#EF4444";
const amber = "#F59E0B";
const blue = "#3B82F6";

export default {
  light: {
    text: navy,
    textSecondary: slateLight,
    background: white,
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",
    border: "#E2E8F0",
    tint: emerald,
    tintDark: emeraldDark,
    accent,
    tabIconDefault: slateLight,
    tabIconSelected: emerald,
    red,
    amber,
    blue,
  },
  dark: {
    text: white,
    textSecondary: offWhite,
    background: navy,
    surface: slate,
    surfaceAlt: slateMid,
    border: slateMid,
    tint: emerald,
    tintDark: emeraldDark,
    accent,
    tabIconDefault: slateLight,
    tabIconSelected: emerald,
    red,
    amber,
    blue,
  },
};
