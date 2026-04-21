import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { ds } from "@/constants/design-system";

type GlassCardProps = ViewProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Blur intensity (iOS only). Matches the original Swing AI feel. */
  intensity?: number;
  tint?: "light" | "dark" | "default";
  /**
   * Force a solid (non-blurred) surface. Useful for very dense lists where
   * blur hurts scanning. Off by default — the default look is the original
   * translucent glass.
   */
  solid?: boolean;
};

export function GlassCard({
  children,
  style,
  intensity = 28,
  tint = "dark",
  solid = false,
  ...rest
}: GlassCardProps) {
  if (solid || Platform.OS === "android") {
    return (
      <View style={[styles.base, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={[styles.base, style]} {...rest}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: ds.radius.lg,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
    overflow: "hidden",
    ...ds.shadow.subtle,
  },
});
