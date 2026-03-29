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
import { useAuth } from "@/lib/auth-context";
import { formatDateTimeInTimeZone, resolveUserTimeZone } from "@/lib/timezone";

interface AnalysisCardProps {
  analysis: AnalysisResponse;
  onPress: () => void;
  showUserName?: boolean;
}

export function AnalysisCard({ analysis, onPress, showUserName }: AnalysisCardProps) {
  const colors = Colors.dark;
  const { user } = useAuth();
  const profileTimeZone = resolveUserTimeZone(user);

  const statusConfig = {
    pending: { color: colors.amber, icon: "time-outline" as const, label: "Pending" },
    processing: { color: colors.blue, icon: "sync-outline" as const, label: "Processing" },
    completed: { color: "#30D158", icon: "checkmark-circle-outline" as const, label: "Completed" },
    failed: { color: colors.red, icon: "alert-circle-outline" as const, label: "Failed" },
  };

  const status = statusConfig[analysis.status as keyof typeof statusConfig] || statusConfig.pending;
  const videoDate = analysis.capturedAt || analysis.createdAt;
  const date = new Date(videoDate);
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
      <View style={[styles.accentBar, { backgroundColor: status.color }]} />
      <View style={styles.iconWrap}>
        <Ionicons name="videocam" size={20} color="#0A84FF" />
      </View>
      <View style={styles.info}>
        <Text style={styles.filename} numberOfLines={1}>
          {analysis.videoFilename}
        </Text>
        {showUserName && analysis.userName ? (
          <Text style={styles.userName} numberOfLines={1}>{analysis.userName}</Text>
        ) : null}
        <Text style={styles.time}>{timeStr}</Text>
      </View>
      <View style={styles.statusWrap}>
        <View style={[styles.statusBadge, { backgroundColor: status.color + "14" }]}>
          <Ionicons name={status.icon} size={13} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#48484A" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#54545860",
    backgroundColor: "#1C1C1E",
    gap: 12,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A84FF14",
  },
  info: {
    flex: 1,
    gap: 4,
  },
  filename: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#A29BFE",
  },
  time: {
    fontSize: 12,
    color: "#8E8E93",
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
    fontWeight: "600",
  },
});
