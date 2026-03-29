import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const handleLocalAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!email.trim() || !password.trim() || (isSignUpMode && !fullName.trim())) {
      Alert.alert(
        "Required",
        isSignUpMode
          ? "Please enter full name, email, and password."
          : "Please enter email and password.",
      );
      return;
    }

    setAuthLoading(true);
    try {
      if (isSignUpMode) {
        await register(email.trim(), fullName.trim(), password);
      } else {
        await login(email.trim(), password);
      }

      router.replace("/");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        isSignUpMode ? "Sign Up Failed" : "Login Failed",
        e?.message || "Unable to continue",
      );
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#020614", "#0A1128", "#050A18"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      <View style={styles.glowOrbTop} />
      <View style={styles.glowOrbBottom} />
      <View style={styles.glowOrbMid} />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + webTopInset,
            paddingBottom: insets.bottom + 28 + webBottomInset,
          },
        ]}
      >
        <View style={styles.brandingSection}>
          <Text style={styles.appName}>
            Swing <Text style={styles.appNameAccent}>AI</Text>
          </Text>
          <Text style={styles.tagline}>Precision coaching for every swing</Text>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.cardTitle}>{isSignUpMode ? "Create Account" : "Login"}</Text>

          {isSignUpMode && (
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color="#9CA3AF" />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
                placeholderTextColor="#6B7280"
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="next"
                testID="signup-name"
              />
            </View>
          )}

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="next"
              testID="auth-email"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#6B7280"
              secureTextEntry
              style={styles.input}
              returnKeyType="go"
              onSubmitEditing={handleLocalAuth}
              testID="auth-password"
            />
          </View>

          <Pressable
            onPress={handleLocalAuth}
            disabled={authLoading}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: authLoading ? 0.7 : 1,
              },
            ]}
            testID="local-auth-button"
          >
            {authLoading ? (
              <ActivityIndicator size="small" color="#22C55E" />
            ) : (
              <>
                <Ionicons name="arrow-forward-circle" size={20} color="#22C55E" />
                <Text style={styles.primaryButtonText}>
                  {isSignUpMode ? "Sign Up" : "Login"}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => setIsSignUpMode((prev) => !prev)}
            style={styles.modeToggle}
            testID="auth-mode-toggle"
          >
            <Text style={styles.modeToggleText}>
              {isSignUpMode
                ? "Already have an account? Login"
                : "New here? Create an account"}
            </Text>
          </Pressable>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020614" },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
    gap: 24,
  },
  glowOrbTop: {
    position: "absolute",
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#818CF808",
  },
  glowOrbBottom: {
    position: "absolute",
    bottom: -90,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#4ADE8006",
  },
  glowOrbMid: {
    position: "absolute",
    top: "35%",
    left: "20%",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#818CF806",
  },
  brandingSection: {
    alignItems: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#F1F5F9",
    letterSpacing: -1.5,
  },
  appNameAccent: {
    color: "#4ADE80",
  },
  tagline: {
    marginTop: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#78909C",
    letterSpacing: 0.3,
  },
  authCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(12, 20, 40, 0.55)",
    padding: 22,
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#F1F5F9",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(5, 10, 24, 0.7)",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
  },
  input: {
    flex: 1,
    color: "#F1F5F9",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#4ADE80",
    backgroundColor: "rgba(74, 222, 128, 0.06)",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#4ADE80",
    letterSpacing: 0.2,
  },
  modeToggle: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 2,
  },
  modeToggleText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#A5B4FC",
  },
});
