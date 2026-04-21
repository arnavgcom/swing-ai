/**
 * useSportAccent — returns the active sport's accent colour pair.
 *
 * Use this for any UI element that should reflect the user's current
 * sport context: score gauges, sub-score bars, active tab indicator,
 * primary chart line, sport-aware CTAs, etc.
 *
 * Falls back to the design-system neutral accent when no sport is
 * selected, so callers never need to null-check the result.
 *
 * Usage:
 *   const accent = useSportAccent();
 *   <View style={{ backgroundColor: accent.primary }} />
 */
import { useMemo } from "react";
import { useSport } from "@/contexts/sport-context";
import { sportColors } from "@/constants/colors";
import { ds } from "@/constants/design-system";

export interface SportAccent {
  /** Solid accent colour — use for fills, text emphasis, indicators. */
  primary: string;
  /** Slightly darker variant — use for gradients, pressed states. */
  gradient: string;
  /** Translucent glow — use for soft halo effects behind hero numbers. */
  glow: string;
  /** True when the colour came from the active sport (vs. neutral fallback). */
  isSportSpecific: boolean;
}

const NEUTRAL: SportAccent = {
  primary: ds.color.accent,
  gradient: ds.color.accent,
  glow: ds.color.accentGlow,
  isSportSpecific: false,
};

export function useSportAccent(): SportAccent {
  const { selectedSport } = useSport();

  return useMemo(() => {
    if (!selectedSport) return NEUTRAL;
    const entry = sportColors[selectedSport.name];
    if (!entry) {
      // Sport context carries its own colour even for unknown sports.
      const fromContext = selectedSport.color;
      if (fromContext) {
        return {
          primary: fromContext,
          gradient: fromContext,
          glow: hexToGlow(fromContext),
          isSportSpecific: true,
        };
      }
      return NEUTRAL;
    }
    return {
      primary: entry.primary,
      gradient: entry.gradient,
      glow: hexToGlow(entry.primary),
      isSportSpecific: true,
    };
  }, [selectedSport]);
}

/** Convert a #RRGGBB hex into an `rgba(r, g, b, 0.15)` glow string. */
function hexToGlow(hex: string, alpha = 0.15): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
