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
import { ds } from "@/constants/design-system";
import { useSportAccent } from "@/utils/useSportAccent";
import type { AnalysisResponse } from "@/services/api";
import { useAuth } from "@/contexts/auth-context";
import { formatDateTimeInTimeZone, resolveUserTimeZone } from "@/utils/timezone";

interface AnalysisCardProps {
  analysis: AnalysisResponse;
  onPress: () => void;
  showUserName?: boolean;
}

export function AnalysisCard({ analysis, onPress, showUserName }: AnalysisCardProps) {
  const colors = Colors.dark;
  const accent = useSportAccent();
  const { user } = useAuth();
  const profileTimeZone = resolveUserTimeZone(user);

  const statusConfig = {
    pending: { color: colors.amber, icon: "time-outline" as const, label: "Pending" },
    processing: { color: colors.blue, icon: "sync-outline" as const, label: "Processing" },
    completed: { color: ds.color.success, icon: "checkmark-circle-outline" as const, label: "Completed" },
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
      <View style={[styles.iconWrap, { backgroundColor: accent.primary + "1F" }]}>
        <Ionicons name="videocam" size={20} color={accent.primary} />
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
        <View style={[styles.statusBadge, { backgroundColor: status.color + "1F" }]}>
          <Ionicons name={status.icon} size={13} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={ds.color.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Solid surface (no glass) — list rows scan faster without blur,
  // and render cheaper for long history lists.
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
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
  },
  info: {
    flex: 1,
    gap: 4,
  },
  filename: {
    ...ds.type.semibold,
    fontSize: ds.font.callout,
    color: ds.color.textPrimary,
  },
  userName: {
    ...ds.type.medium,
    fontSize: ds.font.caption,
    color: ds.color.textSecondary,
  },
  time: {
    ...ds.type.regular,
    fontSize: ds.font.caption,
    color: ds.color.textTertiary,
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
    ...ds.type.semibold,
    fontSize: ds.font.caption2,
  },
});
