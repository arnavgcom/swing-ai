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
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/auth-context";
import { getApiUrl, apiRequest } from "@/services/query-client";
import { resolveClientMediaUrl } from "@/utils/media";

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

type SportSelectionOption = {
  id: string;
  name: string;
  enabled: boolean;
};

type PickerItem = {
  key: string;
  label: string;
  disabled?: boolean;
  hint?: string;
  badge?: string;
};

type ProfileDraftPayload = {
  name: string;
  phone: string;
  country: string;
  dominantProfile: string;
  sportsInterests: string;
  role: "admin" | "player";
};

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

const buildNormalizedProfileDraft = (input: Partial<ProfileDraftPayload>): ProfileDraftPayload => ({
  name: String(input.name || "").trim(),
  phone: String(input.phone || "").trim(),
  country: String(input.country || "").trim(),
  dominantProfile: String(input.dominantProfile || "").trim(),
  sportsInterests: String(input.sportsInterests || "").trim(),
  role: normalizeRole(input.role),
});

const areProfileDraftsEqual = (
  left: ProfileDraftPayload | null,
  right: ProfileDraftPayload | null,
): boolean => {
  if (!left || !right) return false;

  return (
    left.name === right.name
    && left.phone === right.phone
    && left.country === right.country
    && left.dominantProfile === right.dominantProfile
    && left.sportsInterests === right.sportsInterests
    && left.role === right.role
  );
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { user, refreshUser } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

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
  const [sportsInterests, setSportsInterests] = useState(user?.sportsInterests || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showDominantProfilePicker, setShowDominantProfilePicker] = useState(false);
  const [showSportsPicker, setShowSportsPicker] = useState(false);
  const [sportOptions, setSportOptions] = useState<SportSelectionOption[]>([]);

  const lastSavedProfileRef = useRef<ProfileDraftPayload | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratedRef = useRef(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

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
      setSportsInterests(user.sportsInterests || "");
      if (user.avatarUrl) {
        setAvatarUri(resolveClientMediaUrl(user.avatarUrl));
      }
      lastSavedProfileRef.current = buildNormalizedProfileDraft({
        name: user.name || "",
        phone: user.phone || "+65 ",
        country: user.country || "Singapore",
        dominantProfile: user.dominantProfile
          ? user.dominantProfile.charAt(0).toUpperCase() + user.dominantProfile.slice(1).toLowerCase()
          : "",
        sportsInterests: user.sportsInterests || "",
        role: normalizeRole(user.role),
      });
      isHydratedRef.current = true;
      setSaveState("saved");
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadSports = async () => {
      try {
        const res = await apiRequest("GET", "/api/sports?includeDisabled=true");
        const list = await res.json();
        if (cancelled || !Array.isArray(list)) return;

        const nextOptions = list
          .map((item) => ({
            id: String(item.id || ""),
            name: String(item.name || "").trim(),
            enabled: Boolean(item.enabled),
          }))
          .filter((item) => item.id && item.name)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

        setSportOptions(nextOptions);

        const enabledDefault = nextOptions.find((item) => item.enabled)?.name || "";
        if (!user?.sportsInterests && !sportsInterests) {
          setSportsInterests(enabledDefault);
        }
      } catch {
      }
    };

    loadSports();

    return () => {
      cancelled = true;
    };
  }, [user?.sportsInterests]);

  const sportPickerItems: PickerItem[] = sportOptions.map((sport) => ({
    key: sport.name,
    label: sport.name,
    disabled: !sport.enabled,
    hint: sport.enabled ? undefined : "Coming soon",
    badge: sport.enabled ? "Enabled" : "Disabled",
  }));


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
          setAvatarUri(resolveClientMediaUrl(data.avatarUrl));
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

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (autoSaveResetTimerRef.current) {
        clearTimeout(autoSaveResetTimerRef.current);
      }
    };
  }, []);

  const persistProfile = async (payload: ProfileDraftPayload) => {
    if (!payload.name) {
      return false;
    }

    setSaving(true);
    setSaveState("saving");

    try {
      await apiRequest("PUT", "/api/profile", payload);
      await refreshUser();
      lastSavedProfileRef.current = payload;
      setSaveState("saved");
      if (autoSaveResetTimerRef.current) {
        clearTimeout(autoSaveResetTimerRef.current);
      }
      autoSaveResetTimerRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 1400);
      return true;
    } catch (e) {
      setSaveState("error");
      Alert.alert("Error", "Failed to save profile");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!user || !isHydratedRef.current) {
      return;
    }

    const nextPayload = buildNormalizedProfileDraft({
      name,
      phone,
      country,
      dominantProfile,
      sportsInterests,
      role,
    });

    if (!nextPayload.name || areProfileDraftsEqual(nextPayload, lastSavedProfileRef.current)) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistProfile(nextPayload);
    }, 700);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [country, dominantProfile, name, phone, role, sportsInterests, user]);

  const handleRoleToggle = async (value: boolean) => {
    const nextRole = value ? "admin" : "player";

    if (saving || nextRole === role) {
      return;
    }

    const previousRole = role;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRole(nextRole);

    const saved = await persistProfile(buildNormalizedProfileDraft({
      name,
      phone,
      country,
      dominantProfile,
      sportsInterests,
      role: nextRole,
    }));
    if (!saved) {
      setRole(previousRole);
    }
  };

  const saveStatusLabel = saveState === "saving"
    ? "Saving"
    : saveState === "saved"
      ? "Saved"
      : saveState === "error"
        ? "Retry needed"
        : "Auto-save";

  const saveStatusTone = saveState === "error"
    ? styles.statusPillError
    : saveState === "saved"
      ? styles.statusPillSuccess
      : styles.statusPillNeutral;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (returnTo && returnTo !== "/profile") {
      router.replace(returnTo as any);
      return;
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#000000", "#1C1C1E", "#000000"]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 10 + webTopInset },
        ]}
      >
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          testID="profile-back"
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={[styles.statusPill, saveStatusTone]}>
          <Text style={styles.statusPillText}>{saveStatusLabel}</Text>
        </View>
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
                colors={["#0A84FF", "#A29BFE"]}
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

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionLabel}>Personal</Text>
          <View style={styles.sectionCard}>
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
            </View>
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.sectionCard}>
            <View style={styles.fieldsContainer}>
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
                  <Ionicons name="globe-outline" size={18} color="#0A84FF" />
                  <Text style={[styles.dropdownText, !country && styles.dropdownPlaceholder]}>
                    {country || "Select country"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#636366" />
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
                  <Ionicons name="hand-left-outline" size={18} color="#0A84FF" />
                  <Text style={[styles.dropdownText, !dominantProfile && styles.dropdownPlaceholder]}>
                    {dominantProfile || "Select dominant profile"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#636366" />
                </Pressable>
              </View>

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Sport</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowSportsPicker(true);
                  }}
                  style={styles.fieldInput}
                  testID="field-sport"
                >
                  <Ionicons name="tennisball-outline" size={18} color="#0A84FF" />
                  <Text style={[styles.dropdownText, !sportsInterests && styles.dropdownPlaceholder]}>
                    {sportsInterests || "Select sport"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#636366" />
                </Pressable>
                <Text style={styles.fieldHint}>All sports are visible. Only enabled sports can be selected.</Text>
              </View>
            </View>
          </View>
        </View>

        {user ? (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionLabel}>Access</Text>
            <View style={styles.sectionCard}>
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Role</Text>
                <View style={styles.roleToggleRow}>
                  <View style={styles.roleInfo}>
                    <Ionicons
                      name={role === "admin" ? "shield-checkmark" : "person"}
                      size={18}
                      color={role === "admin" ? "#FFD60A" : "#0A84FF"}
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
                    onValueChange={handleRoleToggle}
                    disabled={saving}
                    trackColor={{ false: "#545458", true: "#FFD60A40" }}
                    thumbColor={role === "admin" ? "#FFD60A" : "#636366"}
                    testID="role-toggle"
                  />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={showCountryPicker}
        title="Select Country"
        items={COUNTRIES.map((item) => ({ key: item, label: item }))}
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
        items={DOMINANT_PROFILES.map((item) => ({ key: item, label: item }))}
        selectedItems={dominantProfile ? [dominantProfile] : []}
        multiSelect={false}
        onSelect={(item) => {
          setDominantProfile(item);
          setShowDominantProfilePicker(false);
        }}
        onClose={() => setShowDominantProfilePicker(false)}
      />

      <PickerModal
        visible={showSportsPicker}
        title="Select Sport"
        items={sportPickerItems}
        selectedItems={sportsInterests ? [sportsInterests] : []}
        multiSelect={false}
        onSelect={(item) => {
          const selectedOption = sportOptions.find((sport) => sport.name === item);
          if (!selectedOption?.enabled) {
            Alert.alert("Coming soon", `${item} is not enabled yet.`);
            return;
          }
          setSportsInterests(item);
          setShowSportsPicker(false);
        }}
        onClose={() => setShowSportsPicker(false)}
      />

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
  items: PickerItem[];
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
            keyExtractor={(item) => item.key}
            scrollEnabled={items.length > 6}
            style={styles.modalList}
            renderItem={({ item }) => {
              const isSelected = selectedItems.includes(item.key);
              return (
                <Pressable
                  onPress={() => onSelect(item.key)}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected, item.disabled && styles.modalItemDisabled]}
                >
                  <View style={styles.modalItemMeta}>
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected, item.disabled && styles.modalItemTextDisabled]}>
                      {item.label}
                    </Text>
                    {item.hint ? <Text style={styles.modalItemHint}>{item.hint}</Text> : null}
                  </View>
                  <View style={styles.modalItemTrailing}>
                    {item.badge ? (
                      <View style={[styles.modalBadge, item.disabled ? styles.modalBadgeDisabled : styles.modalBadgeEnabled]}>
                        <Text style={[styles.modalBadgeText, item.disabled ? styles.modalBadgeTextDisabled : styles.modalBadgeTextEnabled]}>
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color="#0A84FF" />
                    )}
                  </View>
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
        <Ionicons name={icon as any} size={18} color={editable ? "#0A84FF" : "#4A4A6A"} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#636366"
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
  container: { flex: 1, backgroundColor: "#000000" },
  formContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#38383A",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statusPill: {
    minWidth: 74,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillNeutral: {
    backgroundColor: "#2C2C2E",
    borderColor: "#48484A",
  },
  statusPillSuccess: {
    backgroundColor: "#30D15814",
    borderColor: "#30D15840",
  },
  statusPillError: {
    backgroundColor: "#FF453A14",
    borderColor: "#FF453A40",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
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
    borderColor: "#0A84FF",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0A84FF",
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: "700",
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
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000000",
  },
  changePhotoText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "500",
    color: "#0A84FF",
  },
  sectionGroup: {
    gap: 10,
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    padding: 14,
  },
  sectionCards: {
    gap: 12,
  },
  fieldsContainer: {
    gap: 16,
  },
  fieldWrapper: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldHint: {
    fontSize: 12,
    color: "#636366",
  },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
  },
  fieldDisabled: {
    backgroundColor: "#1C1C1E",
    borderColor: "#38383A",
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
    padding: 0,
  },
  textDisabled: {
    color: "#636366",
  },
  textMultiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    color: "#FFFFFF",
  },
  dropdownPlaceholder: {
    color: "#636366",
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
    backgroundColor: "#0A84FF20",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#0A84FF40",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#0A84FF",
  },
  roleToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84,84,88,0.65)",
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
    fontWeight: "500",
    color: "#FFFFFF",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgePlayer: {
    backgroundColor: "#0A84FF20",
  },
  roleBadgeAdmin: {
    backgroundColor: "#FFD60A20",
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  roleBadgeTextPlayer: {
    color: "#0A84FF",
  },
  roleBadgeTextAdmin: {
    color: "#FFD60A",
  },
  helperText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 6,
  },

  recalculateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0A84FF40",
    backgroundColor: "#0A84FF20",
    marginBottom: 12,
  },
  recalculateButtonDisabled: {
    opacity: 0.7,
  },
  recalculateText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0A84FF",
  },
  clearHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FF453A30",
    backgroundColor: "#FF453A10",
    marginBottom: 12,
  },
  clearHistoryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FF453A",
  },
  clearHistoryButtonDisabled: {
    borderColor: "rgba(84,84,88,0.65)",
    backgroundColor: "#1C1C1E",
    opacity: 0.7,
  },
  clearHistoryTextDisabled: {
    color: "#636366",
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
    backgroundColor: "#1C1C1E",
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
    backgroundColor: "#48484A",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#38383A",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#0A84FF20",
  },
  modalDoneText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A84FF",
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
    backgroundColor: "#0A84FF15",
  },
  modalItemDisabled: {
    opacity: 0.72,
  },
  modalItemMeta: {
    flex: 1,
    gap: 4,
  },
  modalItemTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalItemText: {
    fontSize: 16,
    color: "#8E8E93",
  },
  modalItemTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  modalItemTextDisabled: {
    color: "#636366",
  },
  modalItemHint: {
    fontSize: 12,
    color: "#636366",
  },
  modalBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modalBadgeEnabled: {
    backgroundColor: "#30D15814",
    borderColor: "#30D15840",
  },
  modalBadgeDisabled: {
    backgroundColor: "#48484A20",
    borderColor: "#48484A40",
  },
  modalBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  modalBadgeTextEnabled: {
    color: "#30D158",
  },
  modalBadgeTextDisabled: {
    color: "#8E8E93",
  },
});
