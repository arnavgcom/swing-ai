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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { uploadVideo } from "@/lib/api";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";

export default function UploadScreen() {
  const colors = Colors.dark;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { selectedSport, selectedMovement } = useSport();

  const sportColor = selectedSport?.color || colors.tint;

  const [selectedVideo, setSelectedVideo] = useState<{
    uri: string;
    fileName: string;
    duration: number | null;
    fileSize: number | null;
  } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedVideo) throw new Error("No video selected");
      return uploadVideo(
        selectedVideo.uri,
        selectedVideo.fileName,
        selectedSport?.id,
        selectedMovement?.id,
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
      setSelectedVideo({
        uri: asset.uri,
        fileName: asset.fileName || `analysis_${Date.now()}.mp4`,
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
        <Text style={[styles.title, { color: colors.text }]}>
          Analyze {movementLabel}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Upload a video for AI-powered {selectedSport?.name || "sports"} analysis
        </Text>

        {selectedSport && (
          <View style={[styles.contextBadge, { backgroundColor: sportColor + "10", borderColor: sportColor + "25" }]}>
            <Ionicons name={selectedSport.icon as any} size={16} color={sportColor} />
            <Text style={[styles.contextText, { color: sportColor }]}>
              {selectedSport.name}{selectedMovement ? ` / ${selectedMovement.name}` : " (Auto-detect)"}
            </Text>
          </View>
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
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    marginBottom: 16,
  },
  contextBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  contextText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
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
  tipsSection: { gap: 8 },
  tipsTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
