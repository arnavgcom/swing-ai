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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import { ds } from "@/constants/design-system";
import { GlassCard } from "@/components/ui/GlassCard";

export default function AddPlayerScreen() {
  const [newPlayerEmail, setNewPlayerEmail] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPassword, setNewPlayerPassword] = useState("");
  const [creatingPlayer, setCreatingPlayer] = useState(false);
  const [createPlayerError, setCreatePlayerError] = useState("");

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
      router.back();
    } catch {
      setCreatePlayerError("Failed to create player");
    } finally {
      setCreatingPlayer(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.title}>Add New Player</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Email</Text>
            <GlassCard style={styles.fieldInput}>
              <Ionicons name="mail-outline" size={18} color="#6C5CE7" />
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
              <Ionicons name="person-outline" size={18} color="#6C5CE7" />
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

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Password</Text>
            <GlassCard style={styles.fieldInput}>
              <Ionicons name="lock-closed-outline" size={18} color="#6C5CE7" />
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

          {createPlayerError ? <Text style={styles.errorText}>{createPlayerError}</Text> : null}

          <Pressable
            onPress={handleCreatePlayer}
            disabled={creatingPlayer}
            style={({ pressed }) => [styles.saveButton, { opacity: pressed || creatingPlayer ? 0.75 : 1 }]}
          >
            {creatingPlayer ? (
              <ActivityIndicator size="small" color="#6C5CE7" />
            ) : (
              <View style={styles.saveContent}>
                <Ionicons name="checkmark-circle" size={20} color="#6C5CE7" />
                <Text style={styles.saveText}>Create Player</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  header: {
    marginTop: 52,
    paddingHorizontal: ds.space.lg,
    paddingBottom: ds.space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  scroll: { paddingHorizontal: ds.space.xl, paddingBottom: 30, gap: 14 },
  fieldWrapper: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
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
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
  saveContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#6C5CE7" },
});
