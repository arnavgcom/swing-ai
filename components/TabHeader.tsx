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
        style={[styles.iconCircle, avatarSource && styles.iconCircleWithImage]}
      >
        {avatarSource ? (
          <Image source={avatarSource} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={16} color="#94A3B8" />
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
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#15152D",
    borderWidth: 1,
    borderColor: "#2A2A5060",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconCircleWithImage: {
    borderColor: "#6C5CE7",
    borderWidth: 2,
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
});
