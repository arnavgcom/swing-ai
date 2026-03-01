import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { fetch } from "expo/fetch";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [country, setCountry] = useState(user?.country || "");
  const [sportsInterests, setSportsInterests] = useState(user?.sportsInterests || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
      setCountry(user.country || "");
      setSportsInterests(user.sportsInterests || "");
      setBio(user.bio || "");
      if (user.avatarUrl) {
        const baseUrl = getApiUrl();
        setAvatarUri(`${baseUrl}${user.avatarUrl.replace(/^\//, "")}`);
      }
    }
  }, [user]);

  const pickImage = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const actionOptions = ["Take Photo", "Choose from Gallery", "Cancel"];
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
        address: address.trim(),
        country: country.trim(),
        sportsInterests: sportsInterests.trim(),
        bio: bio.trim(),
      });
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === "web") {
        globalThis.alert("Profile updated successfully");
      } else {
        Alert.alert("Saved", "Profile updated successfully");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
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
            placeholder="+1 (555) 123-4567"
            keyboardType="phone-pad"
          />
          <ProfileField
            label="Address"
            value={address}
            onChangeText={setAddress}
            icon="location-outline"
            placeholder="123 Main St, City"
          />
          <ProfileField
            label="Country"
            value={country}
            onChangeText={setCountry}
            icon="globe-outline"
            placeholder="United States"
          />
          <ProfileField
            label="Sports Interests"
            value={sportsInterests}
            onChangeText={setSportsInterests}
            icon="fitness-outline"
            placeholder="Tennis, Cricket, Basketball..."
          />
          <ProfileField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            icon="document-text-outline"
            placeholder="Tell us about yourself..."
            multiline
          />
        </View>

        <Pressable
          onPress={saveProfile}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: saving ? 0.7 : 1 },
          ]}
          testID="save-profile"
        >
          <LinearGradient
            colors={["#6C5CE7", "#A29BFE"]}
            style={styles.saveGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveText}>Save Changes</Text>
              </>
            )}
          </LinearGradient>
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
    </View>
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
  saveButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
  },
  saveGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
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
});
