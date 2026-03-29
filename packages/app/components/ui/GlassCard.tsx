import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { ds } from "@/constants/design-system";

type GlassCardProps = ViewProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: "light" | "dark" | "default";
};

export function GlassCard({
  children,
  style,
  intensity = 40,
  tint = "dark",
  ...rest
}: GlassCardProps) {
  // Use BlurView on iOS for subtle vibrancy; solid card elsewhere
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={intensity} tint={tint} style={[styles.base, style]} {...rest}>
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[styles.base, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: ds.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    overflow: "hidden",
  },
});
