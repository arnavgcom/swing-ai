import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/auth-context";
import { useTabBarSafe } from "@/contexts/tab-bar-context";
import { resolveClientMediaUrl } from "@/utils/media";
import { ds } from "@/constants/design-system";

type SettingsRow = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  route?: string;
  onPress?: () => void;
  destructive?: boolean;
};

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const tabBar = useTabBarSafe();

  const avatarUrl = resolveClientMediaUrl(user?.avatarUrl);
  const isAdmin = user?.role?.toLowerCase() === "admin";

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch {}
        },
      },
    ]);
  };

  const navigateTo = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const profileRows: SettingsRow[] = [
    {
      key: "edit-profile",
      icon: "person-outline",
      iconColor: ds.color.accent,
      label: "Edit Profile",
      route: "/profile",
    },
    {
      key: "metrics",
      icon: "options-outline",
      iconColor: ds.color.success,
      label: "Performance Metrics",
      route: "/profile/score-metrics-selection",
    },
  ];

  const adminRows: SettingsRow[] = isAdmin
    ? [
        {
          key: "configure",
          icon: "build-outline",
          iconColor: ds.color.accent,
          label: "Platform Configure",
          route: "/profile/configure",
        },

        {
          key: "sports",
          icon: "tennisball-outline",
          iconColor: ds.color.success,
          label: "Sports",
          route: "/profile/sports-settings",
        },
        {
          key: "ml-settings",
          icon: "hardware-chip-outline",
          iconColor: ds.color.purple,
          label: "ML / LSTM Settings",
          route: "/profile/ml-settings",
        },
      ]
    : [];

  const appRows: SettingsRow[] = [
    {
      key: "fps",
      icon: "speedometer-outline",
      iconColor: ds.color.orange,
      label: "Analysis FPS",
      route: "/profile/fps-settings",
    },
    {
      key: "storage",
      icon: "cloud-outline",
      iconColor: ds.color.teal,
      label: "Storage Settings",
      route: "/profile/storage-settings",
    },
  ];

  const renderGroup = (label: string, rows: SettingsRow[]) => {
    if (!rows.length) return null;
    return (
      <View style={styles.sectionGroup}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <View style={styles.sectionCard}>
          {rows.map((row, i) => (
            <React.Fragment key={row.key}>
              {i > 0 && <View style={styles.separator} />}
              <Pressable
                onPress={() => {
                  if (row.onPress) {
                    row.onPress();
                  } else if (row.route) {
                    navigateTo(row.route);
                  }
                }}
                style={({ pressed }) => [
                  styles.settingsRow,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.rowIconWrap,
                    { backgroundColor: `${row.iconColor || ds.color.accent}18` },
                  ]}
                >
                  <Ionicons
                    name={row.icon}
                    size={20}
                    color={row.iconColor || ds.color.accent}
                  />
                </View>
                <Text
                  style={[
                    styles.rowLabel,
                    row.destructive && { color: ds.color.danger },
                  ]}
                >
                  {row.label}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#48484A" />
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={tabBar?.handleScroll}
        scrollEventThrottle={16}
      >
        {/* Avatar + Name */}
        <Pressable
          onPress={() => navigateTo("/profile")}
          style={({ pressed }) => [
            styles.avatarSection,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
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
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user?.name || "User"}</Text>
            <Ionicons name="chevron-down" size={16} color="#94A3B8" />
          </View>
        </Pressable>

        {/* Settings Sections */}
        {renderGroup("Account", profileRows)}
        {isAdmin ? renderGroup("Admin", adminRows) : null}
        {renderGroup("App", appRows)}

        {/* Logout */}
        <View style={styles.sectionGroup}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Ionicons name="log-out-outline" size={20} color={ds.color.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },


  scrollContent: {
    paddingHorizontal: 20,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 14,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.12)",
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 44,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: ds.color.textPrimary,
  },
  sectionGroup: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: ds.color.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 14,
    backgroundColor: ds.color.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(84, 84, 88, 0.45)",
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 14,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "400",
    color: ds.color.textPrimary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(84, 84, 88, 0.45)",
    marginLeft: 60,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${ds.color.danger}30`,
    backgroundColor: `${ds.color.danger}10`,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: ds.color.danger,
  },
});
