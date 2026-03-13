import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Modal,
  FlatList,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl, apiRequest, queryClient } from "@/lib/query-client";
import {
  fetchModelEvaluationSettings,
  updateModelEvaluationSettings,
} from "@/lib/api";

const COUNTRIES = [
  "Singapore",
  "Australia",
  "Canada",
  "China",
  "France",
  "Germany",
  "India",
  "Indonesia",
  "Japan",
  "Malaysia",
  "New Zealand",
  "Philippines",
  "South Korea",
  "Thailand",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
];

const DOMINANT_PROFILES = ["Right", "Left"];

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "+65 ");
  const [country, setCountry] = useState(user?.country || "Singapore");
  const [dominantProfile, setDominantProfile] = useState(
    user?.dominantProfile
      ? user.dominantProfile.charAt(0).toUpperCase() + user.dominantProfile.slice(1).toLowerCase()
      : "",
  );
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "player">(normalizeRole(user?.role));
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcToast, setRecalcToast] = useState<{
    visible: boolean;
    message: string;
    tone: "info" | "success" | "error";
  }>({ visible: false, message: "", tone: "info" });
  const recalcToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showDominantProfilePicker, setShowDominantProfilePicker] = useState(false);
  const [modelEvaluationMode, setModelEvaluationMode] = useState(false);
  const [modelEvalLoading, setModelEvalLoading] = useState(false);
  const isPersistedAdmin = normalizeRole(user?.role) === "admin";
  const isSelectedAdmin = normalizeRole(role) === "admin";
  const showAdminControls = isSelectedAdmin;
  const canUseAdminApis = isPersistedAdmin && isSelectedAdmin;

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "+65 ");
      setCountry(user.country || "Singapore");
      setDominantProfile(
        user.dominantProfile
          ? user.dominantProfile.charAt(0).toUpperCase() + user.dominantProfile.slice(1).toLowerCase()
          : "",
      );
      setRole(normalizeRole(user.role));
      if (user.avatarUrl) {
        const baseUrl = getApiUrl();
        setAvatarUri(`${baseUrl}${user.avatarUrl.replace(/^\//, "")}`);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!canUseAdminApis) {
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
      }
    })();

    return () => {
      active = false;
    };
  }, [canUseAdminApis]);

  useEffect(() => {
    return () => {
      if (recalcToastTimerRef.current) {
        clearTimeout(recalcToastTimerRef.current);
      }
    };
  }, []);

  const handleModelEvaluationToggle = async (enabled: boolean) => {
    if (!canUseAdminApis) {
      Alert.alert("Save role first", "Please save profile changes after switching to Admin.");
      return;
    }
    setModelEvalLoading(true);
    try {
      await updateModelEvaluationSettings(enabled);
      setModelEvaluationMode(enabled);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["model-evaluation-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["scoring-model-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["discrepancy-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["scoring-model-registry"] }),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Failed to update Model Evaluation Mode");
    } finally {
      setModelEvalLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (Platform.OS === "web") {
        await launchGallery();
        return;
      }

      Alert.alert("Profile Photo", "Choose an option", [
        { text: "Take Photo", onPress: launchCamera },
        { text: "Choose from Gallery", onPress: launchGallery },
        { text: "Cancel", style: "cancel" },
      ]);
    } catch (e) {
      console.error("Image picker error:", e);
    }
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const launchGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery access is required to pick a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      legacy: true,
    });
    if (!result.canceled && result.assets[0]) {
      uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const baseUrl = getApiUrl();
      const formData = new FormData();

      if (Platform.OS === "web") {
        const response = await globalThis.fetch(uri);
        const blob = await response.blob();
        formData.append("avatar", blob, "avatar.jpg");
      } else {
        formData.append("avatar", {
          uri,
          type: "image/jpeg",
          name: "avatar.jpg",
        } as any);
      }

      const res = await globalThis.fetch(`${baseUrl}api/profile/avatar`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.avatarUrl) {
          setAvatarUri(`${baseUrl}${data.avatarUrl.replace(/^\//, "")}`);
        }
        await refreshUser();
      } else {
        Alert.alert("Error", "Failed to upload photo");
      }
    } catch (e) {
      console.error("Avatar upload error:", e);
      Alert.alert("Error", "Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiRequest("PUT", "/api/profile", {
        name: name.trim(),
        phone: phone.trim(),
        country: country.trim(),
        dominantProfile: dominantProfile.trim(),
        role: normalizeRole(role),
      });
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleClearHistory = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Clear History",
      "This will permanently delete all your analysis history. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear History",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest("DELETE", "/api/analyses");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (Platform.OS === "web") {
                globalThis.alert("History cleared successfully");
              } else {
                Alert.alert("Done", "History cleared successfully");
              }
            } catch (e) {
              Alert.alert("Error", "Failed to clear history");
            }
          },
        },
      ],
    );
  };

  const handleRecalculateMetrics = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecalculating(true);
    try {
      const res = await apiRequest("POST", "/api/analyses/recalculate");
      const data = await res.json();
      const queued = Number(data?.queuedAnalyses ?? 0);

      if (recalcToastTimerRef.current) {
        clearTimeout(recalcToastTimerRef.current);
      }

      setRecalcToast({
        visible: true,
        tone: "success",
        message: `Recalc of ${queued} videos started`,
      });

      await queryClient.invalidateQueries({ queryKey: ["analyses-summary"] });
      await queryClient.refetchQueries({ queryKey: ["analyses-summary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      recalcToastTimerRef.current = setTimeout(() => {
        setRecalcToast((prev) => ({ ...prev, visible: false }));
      }, 1800);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Failed to recalc";
      Alert.alert("Error", reason);
    } finally {
      setRecalculating(false);
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const canClearHistory = false;
  const showClearHistory = false;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 10 + webTopInset },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          testID="profile-back"
        >
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Pressable onPress={pickImage} style={styles.avatarSection} testID="avatar-picker">
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <LinearGradient
                colors={["#6C5CE7", "#A29BFE"]}
                style={styles.avatarPlaceholder}
              >
                <Text style={styles.avatarInitial}>
                  {user?.name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </LinearGradient>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </View>
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </Pressable>

        <View style={styles.fieldsContainer}>
          <ProfileField
            label="Full Name"
            value={name}
            onChangeText={setName}
            icon="person-outline"
            placeholder="Your name"
          />
          <ProfileField
            label="Email"
            value={user?.email || ""}
            icon="mail-outline"
            editable={false}
          />
          <ProfileField
            label="Mobile Number"
            value={phone}
            onChangeText={setPhone}
            icon="call-outline"
            placeholder="+65 9123 4567"
            keyboardType="phone-pad"
          />

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Country</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowCountryPicker(true);
              }}
              style={styles.fieldInput}
              testID="field-country"
            >
              <Ionicons name="globe-outline" size={18} color="#6C5CE7" />
              <Text style={[styles.dropdownText, !country && styles.dropdownPlaceholder]}>
                {country || "Select country"}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748B" />
            </Pressable>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Dominant Profile</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowDominantProfilePicker(true);
              }}
              style={styles.fieldInput}
              testID="field-dominant-profile"
            >
              <Ionicons name="hand-left-outline" size={18} color="#6C5CE7" />
              <Text style={[styles.dropdownText, !dominantProfile && styles.dropdownPlaceholder]}>
                {dominantProfile || "Select dominant profile"}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#64748B" />
            </Pressable>
          </View>

          {user ? (
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.roleToggleRow}>
                <View style={styles.roleInfo}>
                  <Ionicons
                    name={role === "admin" ? "shield-checkmark" : "person"}
                    size={18}
                    color={role === "admin" ? "#FBBF24" : "#6C5CE7"}
                  />
                  <Text style={styles.roleText}>
                    {role === "admin" ? "Admin" : "Player"}
                  </Text>
                  <View style={[styles.roleBadge, role === "admin" ? styles.roleBadgeAdmin : styles.roleBadgePlayer]}>
                    <Text style={[styles.roleBadgeText, role === "admin" ? styles.roleBadgeTextAdmin : styles.roleBadgeTextPlayer]}>
                      {role === "admin" ? "ADMIN" : "PLAYER"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={role === "admin"}
                  onValueChange={(val) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setRole(val ? "admin" : "player");
                  }}
                  trackColor={{ false: "#2A2A50", true: "#FBBF2440" }}
                  thumbColor={role === "admin" ? "#FBBF24" : "#64748B"}
                  testID="role-toggle"
                />
              </View>
            </View>
          ) : null}

          {showAdminControls && (
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Model Evaluation Mode</Text>
              <View style={styles.roleToggleRow}>
                <View style={styles.roleInfo}>
                  <Ionicons
                    name={modelEvaluationMode ? "analytics" : "analytics-outline"}
                    size={18}
                    color={modelEvaluationMode ? "#34D399" : "#6C5CE7"}
                  />
                  <Text style={styles.roleText}>
                    {modelEvaluationMode ? "ON - Evaluation Dataset Only" : "OFF - All Videos"}
                  </Text>
                </View>
                <Switch
                  value={modelEvaluationMode}
                  disabled={modelEvalLoading || !canUseAdminApis}
                  onValueChange={(val) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    handleModelEvaluationToggle(val);
                  }}
                  trackColor={{ false: "#2A2A50", true: "#34D39940" }}
                  thumbColor={modelEvaluationMode ? "#34D399" : "#64748B"}
                  testID="model-evaluation-toggle"
                />
              </View>
              {!canUseAdminApis ? (
                <Text style={styles.adminHintText}>Save profile to enable admin actions.</Text>
              ) : null}
            </View>
          )}

        </View>

        <Pressable
          onPress={() => {
            router.push("/profile/score-metrics-selection");
          }}
          style={({ pressed }) => [
            styles.recalculateButton,
            { transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
          testID="score-metrics-selection"
        >
          <Ionicons name="options-outline" size={20} color="#6C5CE7" />
          <Text style={styles.recalculateText}>Score/Metrics Selection</Text>
        </Pressable>

        {/* Only show Recalc button for admins */}
        {showAdminControls && (
          <Pressable
            onPress={handleRecalculateMetrics}
            disabled={recalculating || !canUseAdminApis}
            style={({ pressed }) => [
              styles.recalculateButton,
              (recalculating || !canUseAdminApis) && styles.recalculateButtonDisabled,
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
            testID="recalculate-metrics"
          >
            {recalculating ? (
              <ActivityIndicator size="small" color="#6C5CE7" />
            ) : (
              <Ionicons name="refresh" size={20} color="#6C5CE7" />
            )}
            <Text style={styles.recalculateText}>Recalc. Metrics/Scores</Text>
          </Pressable>
          )}

          {/* Admin-only: Add Player Screen Trigger */}
          {showAdminControls && (
            <Pressable
              onPress={() => {
                if (!canUseAdminApis) {
                  Alert.alert("Save role first", "Please save profile changes after switching to Admin.");
                  return;
                }
                router.push("/profile/add-player");
              }}
              disabled={!canUseAdminApis}
              style={({ pressed }) => [
                styles.saveButton,
                !canUseAdminApis && styles.recalculateButtonDisabled,
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
              testID="create-player-trigger"
            >
              <View style={styles.saveContent}>
                <Ionicons name="person-add" size={20} color="#6C5CE7" />
                <Text style={styles.saveText}>Add New Player</Text>
              </View>
            </Pressable>
          )}

        {showClearHistory && (
          <Pressable
            onPress={handleClearHistory}
            disabled={!canClearHistory}
            style={({ pressed }) => [
              styles.clearHistoryButton,
              !canClearHistory && styles.clearHistoryButtonDisabled,
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
            testID="clear-history"
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={canClearHistory ? "#EF4444" : "#64748B"}
            />
            <Text
              style={[
                styles.clearHistoryText,
                !canClearHistory && styles.clearHistoryTextDisabled,
              ]}
            >
              Clear History
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={saveProfile}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: saving ? 0.7 : 1 },
          ]}
          testID="save-profile"
        >
          <View style={styles.saveContent}>
            {saving ? (
              <ActivityIndicator size="small" color="#6C5CE7" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#6C5CE7" />
                <Text style={styles.saveText}>Save Changes</Text>
              </>
            )}
          </View>
        </Pressable>

          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
            testID="logout-button"
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={showCountryPicker}
        title="Select Country"
        items={COUNTRIES}
        selectedItems={country ? [country] : []}
        multiSelect={false}
        onSelect={(item) => {
          setCountry(item);
          setShowCountryPicker(false);
        }}
        onClose={() => setShowCountryPicker(false)}
      />

      <PickerModal
        visible={showDominantProfilePicker}
        title="Select Dominant Profile"
        items={DOMINANT_PROFILES}
        selectedItems={dominantProfile ? [dominantProfile] : []}
        multiSelect={false}
        onSelect={(item) => {
          setDominantProfile(item);
          setShowDominantProfilePicker(false);
        }}
        onClose={() => setShowDominantProfilePicker(false)}
      />

      {recalcToast.visible ? (
        <View style={styles.recalcToastContainer} pointerEvents="none">
          <View
            style={[
              styles.recalcToast,
              recalcToast.tone === "success" && styles.recalcToastSuccess,
              recalcToast.tone === "error" && styles.recalcToastError,
            ]}
          >
            <Ionicons
              name={
                recalcToast.tone === "success"
                  ? "checkmark-circle"
                  : recalcToast.tone === "error"
                    ? "alert-circle"
                    : "time-outline"
              }
              size={14}
              color={
                recalcToast.tone === "success"
                  ? "#34D399"
                  : recalcToast.tone === "error"
                    ? "#F87171"
                    : "#94A3B8"
              }
            />
            <Text style={styles.recalcToastText}>{recalcToast.message}</Text>
          </View>
        </View>
      ) : null}

    </View>
  );
}

function PickerModal({
  visible,
  title,
  items,
  selectedItems,
  multiSelect,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: string[];
  selectedItems: string[];
  multiSelect: boolean;
  onSelect: (item: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}
          onPress={() => {}}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            {multiSelect && (
              <Pressable onPress={onClose} style={styles.modalDoneButton}>
                <Text style={styles.modalDoneText}>Done</Text>
              </Pressable>
            )}
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item}
            scrollEnabled={items.length > 6}
            style={styles.modalList}
            renderItem={({ item }) => {
              const isSelected = selectedItems.includes(item);
              return (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {item}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#6C5CE7" />
                  )}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  icon,
  placeholder,
  editable = true,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  icon: string;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad" | "email-address";
}) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldInput, !editable && styles.fieldDisabled]}>
        <Ionicons name={icon as any} size={18} color={editable ? "#6C5CE7" : "#4A4A6A"} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#4A4A6A"
          editable={editable}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          style={[
            styles.textInput,
            !editable && styles.textDisabled,
            multiline && styles.textMultiline,
          ]}
          keyboardType={keyboardType || "default"}
          testID={`field-${label.toLowerCase().replace(/\s/g, "-")}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  recalcToastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
    zIndex: 30,
  },
  recalcToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#0A0A1A",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  recalcToastSuccess: {
    borderColor: "#166534",
    backgroundColor: "#052E1A",
  },
  recalcToastError: {
    borderColor: "#7F1D1D",
    backgroundColor: "#3F1114",
  },
  recalcToastText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
  },
  adminHintText: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  formContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A36",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A36",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: "relative",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#6C5CE7",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#6C5CE7",
  },
  avatarInitial: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  avatarOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
    borderRadius: 50,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#6C5CE7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0A0A1A",
  },
  changePhotoText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#6C5CE7",
  },
  fieldsContainer: {
    gap: 16,
    marginBottom: 28,
  },
  fieldWrapper: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#131328",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
  },
  fieldDisabled: {
    backgroundColor: "#0E0E22",
    borderColor: "#1A1A36",
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#F8FAFC",
    padding: 0,
  },
  textDisabled: {
    color: "#64748B",
  },
  textMultiline: {
    minHeight: 60,
    textAlignVertical: "top" as const,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#F8FAFC",
  },
  dropdownPlaceholder: {
    color: "#4A4A6A",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6C5CE720",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#6C5CE740",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#A29BFE",
  },
  roleToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#131328",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  roleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roleText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#F8FAFC",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgePlayer: {
    backgroundColor: "#6C5CE720",
  },
  roleBadgeAdmin: {
    backgroundColor: "#FBBF2420",
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  roleBadgeTextPlayer: {
    color: "#A29BFE",
  },
  roleBadgeTextAdmin: {
    color: "#FBBF24",
  },
  helperText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 6,
  },
  modelConfigButton: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#6C5CE740",
    backgroundColor: "#6C5CE720",
    paddingVertical: 16,
  },
  modelConfigButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
  },
  recalculateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#6C5CE740",
    backgroundColor: "#6C5CE720",
    marginBottom: 12,
  },
  recalculateButtonDisabled: {
    opacity: 0.7,
  },
  recalculateText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
  },
  clearHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EF444430",
    backgroundColor: "#EF444410",
    marginBottom: 12,
  },
  clearHistoryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#EF4444",
  },
  clearHistoryButtonDisabled: {
    borderColor: "#2A2A50",
    backgroundColor: "#131328",
    opacity: 0.7,
  },
  clearHistoryTextDisabled: {
    color: "#64748B",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#6C5CE740",
    backgroundColor: "#6C5CE720",
    borderRadius: 14,
    marginBottom: 16,
  },
  saveContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  saveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EF444430",
    backgroundColor: "#EF444410",
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#EF4444",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  createPlayerKeyboardWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#131328",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: "84%",
    minHeight: 430,
  },
  createPlayerFormContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  createPlayerFields: {
    gap: 16,
  },
  createPlayerFooter: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4A4A6A",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A50",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  modalDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#6C5CE720",
  },
  modalDoneText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
  },
  modalList: {
    paddingHorizontal: 12,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  modalItemSelected: {
    backgroundColor: "#6C5CE715",
  },
  modalItemText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  modalItemTextSelected: {
    color: "#F8FAFC",
    fontFamily: "Inter_600SemiBold",
  },
});
