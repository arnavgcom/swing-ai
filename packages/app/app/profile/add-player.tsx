import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/services/query-client";
import { fetch } from "expo/fetch";
import { ds } from "@/constants/design-system";
import { GlassCard } from "@/components/ui/GlassCard";

export default function AddPlayerScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [newPlayerEmail, setNewPlayerEmail] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPassword, setNewPlayerPassword] = useState("");
  const [creatingPlayer, setCreatingPlayer] = useState(false);
  const [createPlayerError, setCreatePlayerError] = useState("");
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
    if (returnTo && returnTo !== "/profile") {
      router.replace(returnTo as any);
      return;
    }
    router.replace("/profile");
  };

  const handleCreatePlayer = async () => {
    setCreatePlayerError("");
    const email = newPlayerEmail.trim();
    const name = newPlayerName.trim();
    const password = newPlayerPassword;

    if (!email || !name || !password) {
      setCreatePlayerError("Email, full name, and password are required");
      return;
    }

    if (password.length < 6) {
      setCreatePlayerError("Password must be at least 6 characters");
      return;
    }

    setCreatingPlayer(true);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/admin/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, name, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCreatePlayerError(data?.error || `Failed to create player (HTTP ${res.status})`);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Player Created", "New player profile created successfully.");
      handleBack();
    } catch {
      setCreatePlayerError("Failed to create player");
    } finally {
      setCreatingPlayer(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#000000", "#1C1C1E", "#000000"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 10 + webTopInset }]}> 
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Add New Player</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionLabel}>Identity</Text>
            <GlassCard style={styles.sectionCard}>
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Email</Text>
                <GlassCard style={styles.fieldInput}>
                  <Ionicons name="mail-outline" size={18} color="#0A84FF" />
                  <TextInput
                    value={newPlayerEmail}
                    onChangeText={(text) => {
                      setNewPlayerEmail(text);
                      if (createPlayerError) setCreatePlayerError("");
                    }}
                    placeholder="player@email.com"
                    placeholderTextColor="#4A4A6A"
                    style={styles.textInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </GlassCard>
              </View>

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <GlassCard style={styles.fieldInput}>
                  <Ionicons name="person-outline" size={18} color="#0A84FF" />
                  <TextInput
                    value={newPlayerName}
                    onChangeText={(text) => {
                      setNewPlayerName(text);
                      if (createPlayerError) setCreatePlayerError("");
                    }}
                    placeholder="Player Name"
                    placeholderTextColor="#4A4A6A"
                    style={styles.textInput}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </GlassCard>
              </View>
            </GlassCard>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionLabel}>Security</Text>
            <GlassCard style={styles.sectionCard}>
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Password</Text>
                <GlassCard style={styles.fieldInput}>
                  <Ionicons name="lock-closed-outline" size={18} color="#0A84FF" />
                  <TextInput
                    value={newPlayerPassword}
                    onChangeText={(text) => {
                      setNewPlayerPassword(text);
                      if (createPlayerError) setCreatePlayerError("");
                    }}
                    placeholder="At least 6 characters"
                    placeholderTextColor="#4A4A6A"
                    style={styles.textInput}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </GlassCard>
              </View>
            </GlassCard>
          </View>

          <View style={styles.sectionGroup}>
            <Text style={styles.sectionLabel}>Action</Text>
            <GlassCard style={styles.sectionCard}>
              {createPlayerError ? <Text style={styles.errorText}>{createPlayerError}</Text> : null}

              <Pressable
                onPress={handleCreatePlayer}
                disabled={creatingPlayer}
                style={({ pressed }) => [styles.saveButton, { opacity: pressed || creatingPlayer ? 0.75 : 1 }]}
              >
                {creatingPlayer ? (
                  <ActivityIndicator size="small" color="#0A84FF" />
                ) : (
                  <View style={styles.saveContent}>
                    <Ionicons name="checkmark-circle" size={20} color="#0A84FF" />
                    <Text style={styles.saveText}>Add Player</Text>
                  </View>
                )}
              </Pressable>
            </GlassCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  header: {
    paddingHorizontal: ds.space.xl,
    paddingBottom: ds.space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: ds.color.glassBorder,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: ds.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ds.color.glass,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: ds.color.textPrimary,
  },
  scroll: { paddingHorizontal: ds.space.xl, paddingTop: 24, paddingBottom: 30 },
  sectionGroup: { gap: 10, marginBottom: 22 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: ds.color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    padding: 14,
    gap: 16,
  },
  fieldWrapper: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: ds.color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: ds.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    color: ds.color.textPrimary,
    fontSize: 15,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "500",
    marginTop: -4,
  },
  saveButton: {
    marginTop: 10,
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: `${ds.color.accent}40`,
    backgroundColor: `${ds.color.accent}20`,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  saveContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveText: { fontSize: 15, fontWeight: "600", color: "#0A84FF" },
});
