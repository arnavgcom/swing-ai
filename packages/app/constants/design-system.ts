/**
 * Design system — restored from the original Swing AI palette.
 *
 * Core color values match the legacy app verbatim (deeper midnight,
 * warmer translucent glass, purple `#6C5CE7` brand accent). Additive
 * scaffolding (Inter typography presets, tabular numbers, sharedStyles,
 * extended palette + sport tokens) is preserved so dependent components
 * keep compiling.
 */
export const ds = {
  color: {
    // ─── Backgrounds (restored) ──────────────────
    bg: "#070B16",
    bgElevated: "#0F172A",
    bgTertiary: "#1A1A36",
    bgGrouped: "#0F172A",
    bgSecondaryGrouped: "#1A1A36",

    // ─── Glass / Overlay (restored) ──────────────
    // Warmer, slightly transparent navy. Pairs with intensity 28 in
    // GlassCard to recreate the original "deep frost" look.
    glass: "rgba(15, 23, 42, 0.58)",
    glassLight: "rgba(255, 255, 255, 0.05)",
    glassBorder: "rgba(255, 255, 255, 0.16)",
    glassBorderLight: "rgba(255, 255, 255, 0.20)",

    // ─── Text (restored) ─────────────────────────
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textTertiary: "#94A3B8",

    // ─── Semantic (restored) ─────────────────────
    success: "#34D399",
    warning: "#FBBF24",
    danger: "#F87171",
    accent: "#6C5CE7",
    accentGlow: "rgba(108, 92, 231, 0.18)",

    // ─── Extended palette ────────────────────────
    orange: "#F59E0B",
    mint: "#5EEAD4",
    teal: "#14B8A6",
    cyan: "#22D3EE",
    indigo: "#6366F1",
    purple: "#8B5CF6",
    pink: "#F472B6",
    info: "#60A5FA",

    // ─── Separators ──────────────────────────────
    separator: "rgba(255, 255, 255, 0.08)",
    separatorOpaque: "#22224A",
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
    // Bumped one step from Apple HIG defaults — coaches/players are
    // often 35–60+ and the app is used outdoors.
    title: 24,
    headline: 18,
    body: 16,
    callout: 15,
    subhead: 14,
    footnote: 13,
    caption: 12,
    caption2: 11,
  },
  // Tabular figures so score numbers line up in lists & comparison views.
  // Spread into Text style: { ...ds.tabularNums, fontSize: 24, ... }
  tabularNums: {
    fontVariant: ["tabular-nums" as const],
  },
  /**
   * Inter font-family presets. The Inter family is loaded in app/_layout.tsx
   * via @expo-google-fonts/inter. Spread these into Text styles so weight is
   * driven by family (more reliable cross-platform than `fontWeight`).
   *
   *   <Text style={[ds.font.bodyText, ds.type.semibold]}>Score</Text>
   */
  type: {
    regular: { fontFamily: "Inter_400Regular" as const },
    medium: { fontFamily: "Inter_500Medium" as const },
    semibold: { fontFamily: "Inter_600SemiBold" as const },
    bold: { fontFamily: "Inter_700Bold" as const },
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
    borderBottomColor: ds.color.separator,
  },
  navHeaderTitle: {
    fontSize: ds.font.headline,
    fontWeight: "600" as const,
    color: ds.color.textPrimary,
  },
  navBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ds.color.bgElevated,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  // ─── Primary action button ────────────────────────────────────────────────
  // Purple brand accent on the original Swing AI palette.
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: ds.color.accent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: "rgba(108, 92, 231, 0.45)",
  },
  primaryButtonText: {
    fontSize: ds.font.callout,
    fontWeight: "600" as const,
    color: ds.color.textPrimary,
  },

  // ─── Secondary / outline button ───────────────────────────────────────────
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    fontSize: ds.font.callout,
    fontWeight: "600" as const,
    color: ds.color.textPrimary,
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
    fontSize: ds.font.footnote,
    fontWeight: "600" as const,
  },

  // ─── Section label (UPPERCASE metadata label above a group) ──────────────
  sectionLabel: {
    fontSize: ds.font.caption,
    fontWeight: "600" as const,
    color: ds.color.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },

  // ─── List / settings row ─────────────────────────────────────────────────
  listRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    backgroundColor: ds.color.bgElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listRowTitle: {
    fontSize: ds.font.callout,
    fontWeight: "600" as const,
    color: ds.color.textPrimary,
  },
  listRowSubtitle: {
    fontSize: ds.font.footnote,
    color: ds.color.textSecondary,
  },
} as const;
