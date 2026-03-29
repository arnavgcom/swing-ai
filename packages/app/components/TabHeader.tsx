import React from "react";
import { View, Pressable, Image, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { sportColors } from "@/constants/colors";
import { ds } from "@/constants/design-system";
import { resolveClientMediaUrl } from "@/lib/media";

type TabHeaderProps = {
  rightContent?: React.ReactNode;
};

export function TabHeader({ rightContent }: TabHeaderProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useAuth();
  const { selectedSport } = useSport();
  const sc = sportColors[selectedSport?.name || ""] || { primary: "#0A84FF", gradient: "#5A4BD1" };

  const avatarUrl = resolveClientMediaUrl(user?.avatarUrl);
  const avatarSource = avatarUrl ? { uri: avatarUrl } : null;

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 + webTopInset }]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: "/profile",
            params: pathname ? { returnTo: pathname } : undefined,
          });
        }}
        style={[
          styles.iconCircle,
          avatarSource && {
            borderColor: sc.primary,
            borderWidth: 2,
          },
        ]}
      >
        {avatarSource ? (
          <Image source={avatarSource} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={16} color={sc.primary} />
        )}
      </Pressable>
      {rightContent ? <View style={styles.rightSlot}>{rightContent}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: ds.space.xl,
    paddingBottom: ds.space.sm,
  },
  rightSlot: {
    flexShrink: 1,
    alignItems: "flex-end",
    marginLeft: ds.space.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.color.glass,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...ds.shadow.subtle,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: ds.radius.pill,
  },
});
