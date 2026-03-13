import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { fetchModelEvaluationSettings, uploadVideo } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";

function getPlayerDisplayName(u: {
  id: string;
  name: string;
  email: string;
  role: string;
}): string {
  const fullName = String(u.name || "").trim();
  return fullName || String(u.email || "").trim() || "Unknown";
}

function formatMovementBadgeLabel(movementName?: string | null): string {
  if (!movementName) return "Auto detect";
  return movementName
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toFileToken(value: string, fallback: string): string {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ");
  return cleaned || fallback;
}

function getTimestampParts(now: Date): { date: string; time: string } {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return {
    date: `${yyyy}${mm}${dd}`,
    time: `${hh}${mi}${ss}`,
  };
}

function getFileExtension(asset: ImagePicker.ImagePickerAsset): string {
  const fileNameExt = asset.fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fileNameExt) return fileNameExt.toLowerCase();
  const uriExt = asset.uri?.split("?")[0]?.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (uriExt) return uriExt.toLowerCase();
  return "mp4";
}

export default function UploadScreen() {
  const colors = Colors.dark;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { selectedSport, selectedMovement } = useSport();

  const sportColor = selectedSport?.color || colors.tint;

  const [selectedVideo, setSelectedVideo] = useState<{
    uri: string;
    fileName: string;
    duration: number | null;
    fileSize: number | null;
  } | null>(null);
  const [userList, setUserList] = useState<
    Array<{ id: string; name: string; email: string; role: string }>
  >([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [modelEvaluationMode, setModelEvaluationMode] = useState(false);

  React.useEffect(() => {
    if (!user) {
      setUserList([]);
      setSelectedPlayerId("");
      setShowPlayerDropdown(false);
      return;
    }

    if (!isAdmin) {
      setUserList([
        {
          id: user.id,
          name: user.name || "",
          email: user.email || "",
          role: user.role || "player",
        },
      ]);
      setSelectedPlayerId(user.id);
      setShowPlayerDropdown(false);
      return;
    }

    if (!selectedPlayerId) {
      setSelectedPlayerId(user.id);
    }

    let active = true;
    (async () => {
      try {
        const baseUrl = getApiUrl();
        const res = await fetch(`${baseUrl}api/users`, { credentials: "include" });
        if (!active) return;
        if (res.ok) {
          const users = await res.json();
          if (Array.isArray(users) && users.length > 0) {
            setUserList(users);
            return;
          }
        }
        setUserList([
          {
            id: user.id,
            name: user.name || "",
            email: user.email || "",
            role: user.role || "player",
          },
        ]);
      } catch {
        if (!active) return;
        setUserList([
          {
            id: user.id,
            name: user.name || "",
            email: user.email || "",
            role: user.role || "player",
          },
        ]);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, isAdmin]);

  React.useEffect(() => {
    if (!user) {
      setModelEvaluationMode(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const settings = await fetchModelEvaluationSettings();
        if (!active) return;
        setModelEvaluationMode(Boolean(settings.enabled));
      } catch {
        if (!active) return;
        setModelEvaluationMode(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedVideo) throw new Error("No video selected");
      return uploadVideo(
        selectedVideo.uri,
        selectedVideo.fileName,
        selectedSport?.id,
        selectedMovement?.id,
        selectedPlayerId || user?.id,
      );
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["analyses-summary"] });
      setSelectedVideo(null);
      router.push({
        pathname: "/analysis/[id]",
        params: { id: data.id },
      });
    },
    onError: (error: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Upload Failed", error.message);
    },
  });

  const handleVideoResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const targetUser = userList.find((u) => u.id === (selectedPlayerId || user?.id));
      const fullNameToken = toFileToken(
        targetUser?.name || user?.name || targetUser?.email || user?.email || "Player",
        "Player",
      );
      const sportToken = toFileToken(selectedSport?.name || "Sport", "Sport");
      const categoryToken = toFileToken(selectedMovement?.name || "AutoDetect", "AutoDetect");
      const { date, time } = getTimestampParts(new Date());
      const extension = getFileExtension(asset);
      const generatedFileName = `${fullNameToken}-${sportToken}-${categoryToken}-${date}-${time}.${extension}`;
      const evaluationFilename = (asset.fileName || "").trim();
      const finalFileName = modelEvaluationMode && evaluationFilename
        ? evaluationFilename
        : generatedFileName;

      setSelectedVideo({
        uri: asset.uri,
        fileName: finalFileName,
        duration: asset.duration ? asset.duration / 1000 : null,
        fileSize: asset.fileSize || null,
      });
    }
  };

  const launchVideoLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 0.7,
        videoMaxDuration: 30,
        legacy: true,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      });
      handleVideoResult(result);
    } catch (error: any) {
      const msg = error?.message || "";
      if (error?.code === "ERR_CANCELED" || msg.includes("cancel")) return;
      if (msg.includes("PHPhotosErrorDomain") || msg.includes("3164") || msg.includes("Could not load")) {
        Alert.alert(
          "Video Access Error",
          "iOS could not process this video. Please try recording a new video using the camera option, or pick a shorter/smaller video.",
          [
            { text: "Record Video", onPress: launchVideoCamera },
            { text: "OK", style: "cancel" },
          ],
        );
      } else {
        Alert.alert("Error", "Could not access your video library. Please try again.");
      }
    }
  };

  const launchVideoCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Needed", "Camera access is required to record video.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        quality: 0.7,
        videoMaxDuration: 30,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      });
      handleVideoResult(result);
    } catch (error: any) {
      if (error?.code === "ERR_CANCELED") return;
      Alert.alert("Error", "Could not record video. Please try again.");
    }
  };

  const pickVideo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === "web") {
      await launchVideoLibrary();
      return;
    }

    Alert.alert("Select Video", "Choose how to add your video", [
      { text: "Record Video", onPress: launchVideoCamera },
      { text: "Choose from Gallery", onPress: launchVideoLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const movementLabel = selectedMovement?.name || selectedSport?.name || "Performance";
  const isAutoDetectMode = !selectedMovement?.name;
  const selectedPlayerLabel =
    (() => {
      const selected = userList.find((u) => u.id === selectedPlayerId);
      return selected ? getPlayerDisplayName(selected) : getPlayerDisplayName({
        id: user?.id || "",
        name: user?.name || "",
        email: user?.email || "",
        role: user?.role || "player",
      });
    })() ||
    "Select player";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />
      <TabHeader />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: colors.text }]}>
            Analyze {movementLabel}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Upload a video for AI-powered {selectedSport?.name || "sports"} analysis
          </Text>
        </View>

        <View style={styles.topControlsRow}>
          {isAdmin ? (
            <Pressable
              onPress={() => setShowPlayerDropdown((prev) => !prev)}
              style={[
                styles.playerDropdown,
                {
                  borderColor: `${sportColor}55`,
                  backgroundColor: `${sportColor}12`,
                },
              ]}
            >
              <Ionicons name="people" size={15} color={sportColor} />
              <Text
                style={[styles.playerDropdownText, { color: sportColor }]}
                numberOfLines={1}
              >
                {selectedPlayerLabel}
              </Text>
              <Ionicons
                name={showPlayerDropdown ? "chevron-up" : "chevron-down"}
                size={14}
                color={sportColor}
              />
            </Pressable>
          ) : (
            <View
              style={[
                styles.playerDropdown,
                styles.playerDropdownReadonly,
                {
                  borderColor: `${sportColor}55`,
                  backgroundColor: `${sportColor}12`,
                },
              ]}
            >
              <Ionicons name="people" size={15} color={sportColor} />
              <Text
                style={[styles.playerDropdownText, { color: sportColor }]}
                numberOfLines={1}
              >
                {selectedPlayerLabel}
              </Text>
            </View>
          )}

          {selectedSport && (
            <View style={[styles.contextBadge, { backgroundColor: sportColor + "10", borderColor: sportColor + "25" }]}>
              <Ionicons
                name="flash-outline"
                size={11}
                color={isAutoDetectMode ? sportColor : "#34D399"}
              />
              <Text style={[styles.contextText, { color: sportColor }]}> 
                {formatMovementBadgeLabel(selectedMovement?.name)}
              </Text>
            </View>
          )}
        </View>

        {isAdmin && showPlayerDropdown && (
          <Modal
            transparent
            animationType="none"
            onRequestClose={() => setShowPlayerDropdown(false)}
          >
            <Pressable
              style={styles.playerDropdownOverlay}
              onPress={() => setShowPlayerDropdown(false)}
            >
              <Pressable style={styles.playerDropdownMenu} onPress={() => {}}>
                {userList.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setSelectedPlayerId(option.id);
                      setShowPlayerDropdown(false);
                    }}
                    style={[
                      styles.playerDropdownItem,
                      option.id === selectedPlayerId && {
                        backgroundColor: `${sportColor}18`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.playerDropdownItemText,
                        option.id === selectedPlayerId && { color: sportColor },
                      ]}
                    >
                      {getPlayerDisplayName(option)}
                    </Text>
                    {option.id === selectedPlayerId ? (
                      <Ionicons name="checkmark" size={15} color={sportColor} />
                    ) : null}
                  </Pressable>
                ))}
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {!selectedVideo ? (
          <Pressable
            onPress={pickVideo}
            style={({ pressed }) => [
              styles.uploadZone,
              {
                borderColor: sportColor + "60",
                backgroundColor: sportColor + "06",
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View
              style={[
                styles.uploadIcon,
                { backgroundColor: sportColor + "14" },
              ]}
            >
              <Ionicons name="cloud-upload" size={32} color={sportColor} />
            </View>
            <Text style={[styles.uploadTitle, { color: colors.text }]}>
              Select Video
            </Text>
            <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>
              Max 20 seconds recommended
            </Text>
            <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>
              MP4, MOV, AVI, WebM
            </Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: "#15152D",
                borderColor: "#2A2A5060",
              },
            ]}
          >
            <View style={styles.previewHeader}>
              <View
                style={[
                  styles.videoIconWrap,
                  { backgroundColor: sportColor + "14" },
                ]}
              >
                <Ionicons name="videocam" size={24} color={sportColor} />
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedVideo(null);
                }}
              >
                <Ionicons name="close-circle" size={26} color="#475569" />
              </Pressable>
            </View>

            <Text
              style={[styles.fileName, { color: colors.text }]}
              numberOfLines={2}
            >
              {selectedVideo.fileName}
            </Text>

            <View style={styles.metaRow}>
              {selectedVideo.duration !== null && (
                <View style={styles.metaItem}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color="#94A3B8"
                  />
                  <Text style={styles.metaText}>
                    {selectedVideo.duration.toFixed(1)}s
                  </Text>
                </View>
              )}
              {selectedVideo.fileSize !== null && (
                <View style={styles.metaItem}>
                  <Ionicons
                    name="document-outline"
                    size={14}
                    color="#94A3B8"
                  />
                  <Text style={styles.metaText}>
                    {(selectedVideo.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {selectedVideo && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              uploadMutation.mutate();
            }}
            disabled={uploadMutation.isPending}
            style={({ pressed }) => [
              styles.analyzeButton,
              {
                backgroundColor: uploadMutation.isPending
                  ? sportColor + "80"
                  : sportColor,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            {uploadMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="flash" size={20} color="#fff" />
            )}
            <Text style={styles.analyzeText}>
              {uploadMutation.isPending ? "Uploading..." : "Start Analysis"}
            </Text>
          </Pressable>
        )}

        <View style={styles.tipsSection}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>
            Tips for Best Results
          </Text>
          {[
            { icon: "camera-outline" as const, text: "Film from the side for optimal pose detection" },
            { icon: "sunny-outline" as const, text: "Ensure good lighting conditions" },
            { icon: "body-outline" as const, text: "Full body should be visible in frame" },
            { icon: "resize-outline" as const, text: "Keep camera steady and at waist height" },
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View
                style={[styles.tipIcon, { backgroundColor: "#15152D" }]}
              >
                <Ionicons name={tip.icon} size={16} color={sportColor} />
              </View>
              <Text style={styles.tipText}>
                {tip.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  headerSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    color: "#94A3B8",
  },
  topControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  contextBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "58%",
  },
  contextText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  playerDropdown: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: "55%",
  },
  playerDropdownText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 180,
  },
  playerDropdownReadonly: {
    paddingRight: 10,
  },
  playerDropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    paddingTop: 200,
    paddingHorizontal: 20,
  },
  playerDropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    maxHeight: 300,
    overflow: "hidden",
  },
  playerDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerDropdownItemText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#CBD5E1",
  },
  uploadZone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  uploadTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  uploadHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  videoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 32,
  },
  analyzeText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  tipsSection: { gap: 4, marginTop: 12 },
  tipsTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    color: "#94A3B8",
  },
});
