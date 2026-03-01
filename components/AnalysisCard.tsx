import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import type { AnalysisResponse } from "@/lib/api";

interface AnalysisCardProps {
  analysis: AnalysisResponse;
  onPress: () => void;
}

export function AnalysisCard({ analysis, onPress }: AnalysisCardProps) {
  const colors = Colors.dark;

  const statusConfig = {
    pending: { color: colors.amber, icon: "time-outline" as const, label: "Pending" },
    processing: { color: colors.blue, icon: "sync-outline" as const, label: "Processing" },
    completed: { color: "#00F5A0", icon: "checkmark-circle-outline" as const, label: "Completed" },
    failed: { color: colors.red, icon: "alert-circle-outline" as const, label: "Failed" },
  };

  const status = statusConfig[analysis.status as keyof typeof statusConfig] || statusConfig.pending;
  const date = new Date(analysis.createdAt);
  const timeStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="videocam" size={22} color="#6C5CE7" />
      </View>
      <View style={styles.info}>
        <Text style={styles.filename} numberOfLines={1}>
          {analysis.videoFilename}
        </Text>
        <Text style={styles.time}>{timeStr}</Text>
      </View>
      <View style={styles.statusWrap}>
        <View style={[styles.statusBadge, { backgroundColor: status.color + "18" }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#64748B" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#131328",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6C5CE718",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  filename: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  time: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#CBD5E1",
  },
  statusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
