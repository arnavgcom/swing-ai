import React from "react";
import { View, Pressable, Image, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { sportColors } from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";
import { ds } from "@/constants/design-system";

export function TabHeader() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedSport } = useSport();
  const sc = sportColors[selectedSport?.name || ""] || { primary: "#6C5CE7", gradient: "#5A4BD1" };

  const avatarSource = user?.avatarUrl
    ? { uri: `${getApiUrl()}${user.avatarUrl.replace(/^\//, "")}` }
    : null;

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 + webTopInset }]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/profile");
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

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/sport-select");
        }}
        style={[styles.iconCircle, { borderColor: sc.primary + "40" }]}
      >
        <Ionicons
          name={(selectedSport?.icon as any) || "fitness-outline"}
          size={18}
          color={sc.primary}
        />
      </Pressable>
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
