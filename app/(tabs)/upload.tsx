import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { fetchModelEvaluationSettings, uploadVideo, type AnalysisSummary } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";

const NativeDateTimePicker = Platform.OS === "web"
  ? null
  : require("@react-native-community/datetimepicker").default;

const LAST_WORKED_ANALYSIS_KEY = "swingai_last_worked_analysis_id";
const PENDING_ANALYSIS_SUMMARY_KEY = "swingai_pending_analysis_summary";

const SESSION_TYPE_OPTIONS = [
  { key: "practice", label: "Practice" },
  { key: "match-play", label: "Match" },
] as const;

const TENNIS_FOCUS_OPTIONS = [
  { key: "auto-detect", label: "Auto", movementName: null },
  { key: "forehand", label: "Forehand", movementName: "Forehand" },
  { key: "backhand", label: "Backhand", movementName: "Backhand" },
  { key: "serve", label: "Serve", movementName: "Serve" },
  { key: "volley", label: "Volley", movementName: "Volley" },
] as const;

type SessionTypeKey = (typeof SESSION_TYPE_OPTIONS)[number]["key"];
type UploadFocusKey = (typeof TENNIS_FOCUS_OPTIONS)[number]["key"];

type SportOption = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type MovementOption = {
  id: string;
  name: string;
  icon: string;
};

function getPlayerDisplayName(u: {
  id: string;
  name: string;
  email: string;
  role: string;
}): string {
  const fullName = String(u.name || "").trim();
  return fullName || String(u.email || "").trim() || "Unknown";
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

function getFileExtension(fileName?: string | null, uri?: string | null): string {
  const fileNameExt = fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fileNameExt) return fileNameExt.toLowerCase();
  const uriExt = uri?.split("?")[0]?.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (uriExt) return uriExt.toLowerCase();
  return "mp4";
}

function formatSessionDateTime(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function toDateInputValue(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeInputValue(value: Date): string {
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildLocalDateTime(datePart: string, timePart: string): Date | null {
  const dateMatch = String(datePart || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(timePart || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const monthIndex = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const next = new Date(year, monthIndex, day, hour, minute, 0, 0);

  if (Number.isNaN(next.getTime())) return null;
  if (
    next.getFullYear() !== year ||
    next.getMonth() !== monthIndex ||
    next.getDate() !== day ||
    next.getHours() !== hour ||
    next.getMinutes() !== minute
  ) {
    return null;
  }

  return next;
}

function summarizePickerAsset(
  asset: ImagePicker.ImagePickerAsset | null | undefined,
) {
  if (!asset) return null;
  return {
    uri: asset.uri,
    fileName: "fileName" in asset ? (asset.fileName ?? null) : null,
    name: "name" in asset ? (asset.name ?? null) : null,
    mimeType: "mimeType" in asset ? (asset.mimeType ?? null) : null,
    duration: "duration" in asset ? (asset.duration ?? null) : null,
    fileSize: "fileSize" in asset ? (asset.fileSize ?? null) : null,
    size: "size" in asset ? (asset.size ?? null) : null,
    width: "width" in asset ? (asset.width ?? null) : null,
    height: "height" in asset ? (asset.height ?? null) : null,
    assetId: "assetId" in asset ? (asset.assetId ?? null) : null,
  };
}

export default function UploadScreen() {
  const colors = Colors.dark;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { selectedSport } = useSport();

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
  const [recordedAtOverride, setRecordedAtOverride] = useState<Date | null>(null);
  const [showRecordedAtModal, setShowRecordedAtModal] = useState(false);
  const [recordedAtDraft, setRecordedAtDraft] = useState<Date>(new Date());
  const [recordedDateInput, setRecordedDateInput] = useState("");
  const [recordedTimeInput, setRecordedTimeInput] = useState("");
  const [sessionType, setSessionType] = useState<SessionTypeKey>("practice");
  const [selectedFocusKey, setSelectedFocusKey] = useState<UploadFocusKey>("auto-detect");
  const [uploadUiStage, setUploadUiStage] = useState<"idle" | "uploading" | "starting">("idle");

  const { data: sportsData } = useQuery<SportOption[]>({
    queryKey: ["/api/sports"],
    enabled: !!user,
  });

  const tennisSport = React.useMemo(
    () => (sportsData || []).find((sport) => String(sport.name || "").toLowerCase() === "tennis") || null,
    [sportsData],
  );

  const { data: tennisMovements } = useQuery<MovementOption[]>({
    queryKey: ["/api/sports", tennisSport?.id || "", "movements"],
    enabled: !!tennisSport?.id,
  });

  const selectedFocus = React.useMemo(
    () => TENNIS_FOCUS_OPTIONS.find((option) => option.key === selectedFocusKey) || TENNIS_FOCUS_OPTIONS[0],
    [selectedFocusKey],
  );

  const selectedMovementName = sessionType === "match-play"
    ? "Game"
    : selectedFocus.movementName;
  const requestedFocusKey = sessionType === "match-play"
    ? "game"
    : selectedFocusKey;

  const selectedMovement = React.useMemo(() => {
    if (!selectedMovementName) return null;
    return (tennisMovements || []).find(
      (movement) => String(movement.name || "").toLowerCase() === selectedMovementName.toLowerCase(),
    ) || null;
  }, [selectedMovementName, tennisMovements]);

  React.useEffect(() => {
    let active = true;

    if (!user) {
      setUserList([]);
      setSelectedPlayerId("");
      setShowPlayerDropdown(false);
      setModelEvaluationMode(false);
      return () => {
        active = false;
      };
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
    } else {
      if (!selectedPlayerId) {
        setSelectedPlayerId(user.id);
      }

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
    }

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
  }, [isAdmin, selectedPlayerId, user]);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedVideo) throw new Error("No video selected");
      if (!tennisSport?.id) throw new Error("Tennis is not available yet. Please try again.");
      if (selectedMovementName && !selectedMovement?.id) {
        throw new Error("The selected tennis focus is still loading. Please try again.");
      }
      return uploadVideo(
        selectedVideo.uri,
        selectedVideo.fileName,
        tennisSport.id,
        selectedMovement?.id,
        selectedPlayerId || user?.id,
        recordedAtOverride,
        sessionType,
        requestedFocusKey,
      );
    },
    onSuccess: async (data) => {
      setUploadUiStage("starting");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem(LAST_WORKED_ANALYSIS_KEY, data.id).catch(() => {});
      const nowIso = new Date().toISOString();
      const effectiveUserId = selectedPlayerId || user?.id || data.userId;
      const configKey = `${String(tennisSport?.name || selectedSport?.name || "tennis").trim().toLowerCase()}-${String(selectedMovementName || "auto-detect")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")}`;
      const optimisticAnalysis: AnalysisSummary = {
        ...data,
        userId: effectiveUserId,
        userName: userList.find((item) => item.id === (selectedPlayerId || user?.id))?.name || user?.name || data.userName,
        videoPath: data.videoPath || selectedVideo?.uri || "",
        status: data.status || "pending",
        detectedMovement: data.detectedMovement || selectedMovementName || null,
        capturedAt: data.capturedAt || recordedAtOverride?.toISOString() || data.createdAt || nowIso,
        createdAt: data.createdAt || nowIso,
        updatedAt: data.updatedAt || nowIso,
        overallScore: null,
        subScores: null,
        metricValues: null,
        scoreOutputs: null,
        sectionScores: null,
        configKey,
        modelVersion: null,
      };
      queryClient.setQueryData<AnalysisSummary[]>(["analyses-summary"], (current) => {
        const existing = current || [];
        const withoutSame = existing.filter((item) => item.id !== optimisticAnalysis.id);
        return [optimisticAnalysis, ...withoutSame];
      });
      await AsyncStorage.setItem(
        PENDING_ANALYSIS_SUMMARY_KEY,
        JSON.stringify(optimisticAnalysis),
      ).catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ["analyses-summary"] });

      setSelectedVideo(null);
      setRecordedAtOverride(null);
      setSessionType("practice");
      setSelectedFocusKey("auto-detect");

      router.push({
        pathname: "/analysis/[id]",
        params: { id: data.id, backgroundOnSlow: "1" },
      });
    },
    onError: (error: Error) => {
      setUploadUiStage("idle");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = String(error.message || "").trim() || "Upload failed";
      const title = /tennis|stroke|rally/i.test(message) ? "Invalid Video" : "Upload Failed";
      Alert.alert(title, message);
    },
  });

  const isUploadBusy = uploadMutation.isPending || uploadUiStage === "starting";
  const analyzeButtonLabel = uploadUiStage === "starting"
    ? "Starting analysis..."
    : uploadMutation.isPending
      ? "Uploading video..."
      : "Start Analysis";
  const uploadStatusMessage = uploadUiStage === "starting"
    ? "Upload complete. Opening your analysis screen now."
    : uploadMutation.isPending
      ? "Uploading and validating your clip. Analysis starts automatically after this step."
      : null;

  const setSelectedVideoFromAsset = useCallback((asset: {
    uri: string;
    fileName?: string | null;
    name?: string | null;
    duration?: number | null;
    fileSize?: number | null;
    size?: number;
  }) => {
    const targetUser = userList.find((u) => u.id === (selectedPlayerId || user?.id));
    const fullNameToken = toFileToken(
      targetUser?.name || user?.name || targetUser?.email || user?.email || "Player",
      "Player",
    );
    const sportToken = toFileToken(tennisSport?.name || selectedSport?.name || "Tennis", "Tennis");
    const categoryToken = toFileToken(selectedMovementName || "AutoDetect", "AutoDetect");
    const { date, time } = getTimestampParts(new Date());
    const originalName = (asset.fileName || asset.name || "").trim();
    const extension = getFileExtension(originalName, asset.uri);
    const generatedFileName = `${fullNameToken}-${sportToken}-${categoryToken}-${date}-${time}.${extension}`;
    const finalFileName = modelEvaluationMode && originalName
      ? originalName
      : generatedFileName;

    setSelectedVideo({
      uri: asset.uri,
      fileName: finalFileName,
      duration: typeof asset.duration === "number" ? asset.duration / 1000 : null,
      fileSize: asset.fileSize ?? asset.size ?? null,
    });
    setRecordedAtOverride(null);
  }, [modelEvaluationMode, selectedMovementName, selectedPlayerId, selectedSport?.name, tennisSport?.name, user?.email, user?.id, user?.name, userList]);

  const handleVideoResult = (result: ImagePicker.ImagePickerResult) => {
    console.warn("launchVideoLibrary result", {
      canceled: result.canceled,
      assetCount: result.assets?.length ?? 0,
      firstAsset: summarizePickerAsset(result.assets?.[0]),
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedVideoFromAsset(result.assets[0]);
    }
  };

  const openRecordedAtPicker = () => {
    const base = recordedAtOverride ?? new Date();
    setRecordedAtDraft(base);
    setRecordedDateInput(toDateInputValue(base));
    setRecordedTimeInput(toTimeInputValue(base));
    setShowRecordedAtModal(true);
  };

  const closeRecordedAtPicker = () => {
    setShowRecordedAtModal(false);
  };

  const saveRecordedAtOverride = () => {
    const nextValue = Platform.OS === "web"
      ? buildLocalDateTime(recordedDateInput, recordedTimeInput)
      : recordedAtDraft;

    if (!nextValue) {
      Alert.alert("Invalid date", "Enter a valid session date and time.");
      return;
    }

    if (nextValue.getTime() > Date.now() + 60_000) {
      Alert.alert("Invalid date", "Session date and time cannot be in the future.");
      return;
    }

    setRecordedAtOverride(nextValue);
    setShowRecordedAtModal(false);
  };

  const clearRecordedAtOverride = () => {
    setRecordedAtOverride(null);
    setShowRecordedAtModal(false);
  };

  const launchVideoLibrary = async () => {
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.warn("launchVideoLibrary permission", {
          granted: permission.granted,
          canAskAgain: permission.canAskAgain,
          status: permission.status,
          accessPrivileges:
            "accessPrivileges" in permission ? permission.accessPrivileges : undefined,
          expires: permission.expires,
        });
        if (!permission.granted) {
          Alert.alert(
            "Permission Needed",
            "Photo Library access is required to choose a video.",
            permission.canAskAgain
              ? [{ text: "OK", style: "default" }]
              : [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Open Settings",
                    onPress: () => {
                      Linking.openSettings().catch(() => {});
                    },
                  },
                ],
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 0.7,
        videoMaxDuration: 30,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
        ...(Platform.OS === "android" ? { legacy: true } : {}),
      });
      handleVideoResult(result);
    } catch (error: any) {
      console.warn("launchVideoLibrary failed", {
        platform: Platform.OS,
        code: error?.code,
        message: error?.message,
        exception: error?.exception,
        stack: error?.stack,
      });

      const msg = String(error?.message || "");
      const lowerMsg = msg.toLowerCase();
      if (error?.code === "ERR_CANCELED" || lowerMsg.includes("cancel")) return;
      if (
        msg.includes("PHPhotosErrorDomain")
        || msg.includes("3164")
        || msg.includes("Could not load")
        || msg.includes("Cannot load representation")
        || msg.includes("Cannot Open")
      ) {
        Alert.alert(
          "Video Access Error",
          "iOS Photos still could not hand this video to the app. Try recording a new video, or reinstall the latest app build if Photos keeps failing.",
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
      { text: Platform.OS === "ios" ? "Choose from Photos" : "Choose from Gallery", onPress: launchVideoLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const movementLabel = sessionType === "match-play"
    ? "Match"
    : selectedFocus.movementName || tennisSport?.name || selectedSport?.name || "Tennis";
  const sessionDateValue = recordedAtOverride
    ? formatSessionDateTime(recordedAtOverride)
    : "Optional";
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
            Upload a video for AI-powered tennis analysis
          </Text>
        </View>

        {isAdmin ? (
          <View style={styles.adminPlayerSection}>
            <Text style={[styles.focusSectionLabel, { color: colors.textSecondary }]}>Player</Text>
            <Pressable
              onPress={() => setShowPlayerDropdown((prev) => !prev)}
              style={[
                styles.playerDropdown,
                styles.inlinePlayerDropdown,
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
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <Text style={[styles.focusSectionLabel, { color: colors.textSecondary }]}>Session Type</Text>
          <View style={styles.sessionTypeRow}>
            {SESSION_TYPE_OPTIONS.map((option) => {
              const selected = option.key === sessionType;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSessionType(option.key);
                  }}
                  style={[
                    styles.sessionTypeOption,
                    {
                      borderColor: selected ? sportColor : "#2A2A5060",
                      backgroundColor: selected ? `${sportColor}18` : "#15152D",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sessionTypeOptionText,
                      { color: selected ? sportColor : colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {sessionType === "practice" ? (
          <View style={styles.sectionBlock}>
            <Text style={[styles.focusSectionLabel, { color: colors.textSecondary }]}>Focus</Text>
            <View style={styles.focusOptionsRow}>
              {TENNIS_FOCUS_OPTIONS.map((option) => {
                const selected = option.key === selectedFocusKey;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedFocusKey(option.key);
                    }}
                    style={[
                      styles.focusOption,
                      {
                        borderColor: selected ? sportColor : "#2A2A5060",
                        backgroundColor: selected ? `${sportColor}18` : "#15152D",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.focusOptionText,
                        { color: selected ? sportColor : colors.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

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
                  if (isUploadBusy) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedVideo(null);
                  setRecordedAtOverride(null);
                }}
                disabled={isUploadBusy}
              >
                <Ionicons
                  name="close-circle"
                  size={26}
                  color={isUploadBusy ? "#334155" : "#475569"}
                />
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
          <View style={styles.sessionDateCard}>
            <Pressable
              onPress={openRecordedAtPicker}
              style={({ pressed }) => [
                styles.sessionDatePickerButton,
                {
                  borderColor: `${sportColor}50`,
                  backgroundColor: `${sportColor}10`,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={16} color={sportColor} />
              <View style={styles.sessionDateValueWrap}>
                <Text style={[styles.sessionDateValue, { color: colors.text }]}>
                  Video Date
                </Text>
                <Text style={styles.sessionDateCaption}>
                  {sessionDateValue}
                </Text>
              </View>
              <View style={styles.sessionDateActions}>
                {recordedAtOverride ? (
                  <Pressable onPress={clearRecordedAtOverride} hitSlop={8}>
                    <Text style={[styles.sessionDateClear, { color: sportColor }]}>Reset</Text>
                  </Pressable>
                ) : null}
                <Text style={[styles.sessionDateClear, { color: sportColor }]}>Update</Text>
                <Ionicons name="chevron-forward" size={16} color={sportColor} />
              </View>
            </Pressable>
          </View>
        )}

        {selectedVideo && (
          <View style={styles.analyzeSection}>
            <Pressable
              onPress={() => {
                if (isUploadBusy) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setUploadUiStage("uploading");
                uploadMutation.mutate();
              }}
              disabled={isUploadBusy}
              style={({ pressed }) => [
                styles.analyzeButton,
                {
                  backgroundColor: isUploadBusy
                    ? sportColor + "80"
                    : sportColor,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              {isUploadBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="flash" size={20} color="#fff" />
              )}
              <Text style={styles.analyzeText}>{analyzeButtonLabel}</Text>
            </Pressable>
            {uploadStatusMessage ? (
              <Text style={styles.analyzeStatusText}>{uploadStatusMessage}</Text>
            ) : null}
          </View>
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

      <Modal
        transparent
        visible={showRecordedAtModal}
        animationType="fade"
        onRequestClose={closeRecordedAtPicker}
      >
        <Pressable style={styles.recordedAtModalBackdrop} onPress={closeRecordedAtPicker}>
          <Pressable style={styles.recordedAtModalCard} onPress={() => {}}>
            <Text style={[styles.recordedAtModalTitle, { color: colors.text }]}>Choose session date & time</Text>
            <Text style={styles.recordedAtModalHelp}>
              Use this when the video was recorded earlier than the upload time.
            </Text>

            {Platform.OS === "web" ? (
              <View style={styles.recordedAtWebFields}>
                <View style={styles.recordedAtFieldGroup}>
                  <Text style={styles.recordedAtFieldLabel}>Date</Text>
                  <TextInput
                    value={recordedDateInput}
                    onChangeText={setRecordedDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.recordedAtInput}
                  />
                </View>
                <View style={styles.recordedAtFieldGroup}>
                  <Text style={styles.recordedAtFieldLabel}>Time</Text>
                  <TextInput
                    value={recordedTimeInput}
                    onChangeText={setRecordedTimeInput}
                    placeholder="HH:MM"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.recordedAtInput}
                  />
                </View>
              </View>
            ) : NativeDateTimePicker ? (
              <View style={styles.recordedAtNativePickers}>
                <NativeDateTimePicker
                  value={recordedAtDraft}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  maximumDate={new Date()}
                  onChange={(_event: unknown, nextDate?: Date) => {
                    if (nextDate) {
                      setRecordedAtDraft((current) => new Date(
                        nextDate.getFullYear(),
                        nextDate.getMonth(),
                        nextDate.getDate(),
                        current.getHours(),
                        current.getMinutes(),
                        0,
                        0,
                      ));
                    }
                  }}
                />
                <NativeDateTimePicker
                  value={recordedAtDraft}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_event: unknown, nextDate?: Date) => {
                    if (nextDate) {
                      setRecordedAtDraft((current) => new Date(
                        current.getFullYear(),
                        current.getMonth(),
                        current.getDate(),
                        nextDate.getHours(),
                        nextDate.getMinutes(),
                        0,
                        0,
                      ));
                    }
                  }}
                />
              </View>
            ) : null}

            <View style={styles.recordedAtActions}>
              <Pressable onPress={closeRecordedAtPicker} style={styles.recordedAtSecondaryButton}>
                <Text style={styles.recordedAtSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveRecordedAtOverride}
                style={[styles.recordedAtPrimaryButton, { backgroundColor: sportColor }]}
              >
                <Text style={styles.recordedAtPrimaryText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  adminPlayerSection: {
    gap: 8,
    marginBottom: 14,
  },
  inlinePlayerDropdown: {
    maxWidth: "72%",
  },
  sectionBlock: {
    gap: 8,
    marginBottom: 14,
  },
  focusSectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  sessionTypeRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: 6,
  },
  sessionTypeOption: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sessionTypeOptionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  focusOptionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  focusOption: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 0,
  },
  focusOptionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  playerDropdown: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
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
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 30,
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  uploadIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
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
  sessionDateCard: {
    marginBottom: 12,
  },
  sessionDateClear: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  sessionDatePickerButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sessionDateValueWrap: {
    flex: 1,
    gap: 0,
  },
  sessionDateValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sessionDateCaption: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  sessionDateActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analyzeSection: {
    gap: 8,
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
  analyzeStatusText: {
    color: "#94A3B8",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 16,
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
  recordedAtModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.68)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  recordedAtModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#243041",
    backgroundColor: "#0F172A",
    padding: 18,
    gap: 14,
  },
  recordedAtModalTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  recordedAtModalHelp: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  recordedAtWebFields: {
    gap: 12,
  },
  recordedAtFieldGroup: {
    gap: 6,
  },
  recordedAtFieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#CBD5E1",
  },
  recordedAtInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
    color: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  recordedAtNativePickers: {
    gap: 6,
  },
  recordedAtActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  recordedAtSecondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  recordedAtSecondaryText: {
    color: "#CBD5E1",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  recordedAtPrimaryButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  recordedAtPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
