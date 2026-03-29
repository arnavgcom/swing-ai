/**
 * Design system inspired by Apple Fitness + Apple Sports.
 *
 * Background hierarchy: bg → bgElevated → bgTertiary
 * Apple dark-mode system colors used for semantic tokens.
 */
export const ds = {
  color: {
    // ─── Backgrounds ─────────────────────────────
    bg: "#000000", // pure black (Apple Fitness / Sports)
    bgElevated: "#1C1C1E", // systemGray6 dark
    bgTertiary: "#2C2C2E", // systemGray5 dark
    bgGrouped: "#1C1C1E", // grouped background
    bgSecondaryGrouped: "#2C2C2E",

    // ─── Glass / Overlay ─────────────────────────
    glass: "rgba(28, 28, 30, 0.72)",
    glassLight: "rgba(255, 255, 255, 0.04)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
    glassBorderLight: "rgba(255, 255, 255, 0.14)",

    // ─── Text ────────────────────────────────────
    textPrimary: "#FFFFFF",
    textSecondary: "#8E8E93", // systemGray
    textTertiary: "#636366", // systemGray2

    // ─── Semantic ────────────────────────────────
    success: "#30D158", // Apple system green
    warning: "#FFD60A", // Apple system yellow
    danger: "#FF453A", // Apple system red
    accent: "#0A84FF", // Apple system blue
    accentGlow: "rgba(10, 132, 255, 0.15)",

    // ─── Extended palette ────────────────────────
    orange: "#FF9F0A",
    mint: "#63E6E2",
    teal: "#40C8E0",
    cyan: "#64D2FF",
    indigo: "#5E5CE6",
    purple: "#BF5AF2",
    pink: "#FF375F",

    // ─── Separators ──────────────────────────────
    separator: "rgba(84, 84, 88, 0.65)", // Apple separator dark
    separatorOpaque: "#38383A",
  },
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  space: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 16,
    xl: 20,
    xxl: 28,
  },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
    subtle: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    none: {
      shadowColor: "transparent",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
  font: {
    title: 22,
    headline: 17,
    body: 15,
    callout: 14,
    subhead: 13,
    footnote: 12,
    caption: 11,
    caption2: 10,
  },
  motion: {
    quick: 120,
    normal: 200,
    slow: 320,
  },
} as const;

/**
 * Shared style tokens for common UI patterns.
 * Import and spread these into screen StyleSheets to guarantee
 * consistent look-and-feel across every screen.
 *
 * Usage:
 *   import { ds, sharedStyles } from "@/constants/design-system";
 *   const styles = StyleSheet.create({ ...sharedStyles, myStyle: { … } });
 */
export const sharedStyles = {
  // ─── Navigation header ───────────────────────────────────────────────────
  navHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#38383A",
  },
  navHeaderTitle: {
    fontSize: 17,       // Apple HIG: navigation bar title
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  navBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2C2C2E",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  // ─── Primary action button ────────────────────────────────────────────────
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#0A84FF",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: "rgba(10,132,255,0.35)",
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },

  // ─── Secondary / outline button ───────────────────────────────────────────
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#2C2C2E",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },

  // ─── Filter / selection chip ─────────────────────────────────────────────
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 34,
    justifyContent: "center" as const,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },

  // ─── Section label (UPPERCASE metadata label above a group) ──────────────
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#8E8E93",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },

  // ─── List / settings row ─────────────────────────────────────────────────
  listRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listRowTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  listRowSubtitle: {
    fontSize: 13,
    color: "#8E8E93",
  },
} as const;
