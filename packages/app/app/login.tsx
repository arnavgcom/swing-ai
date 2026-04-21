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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAuth } from "@/contexts/auth-context";
import { ds } from "@/constants/design-system";

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
      {/* Restored from the original Swing AI: vertical midnight gradient
          plus two soft glow orbs (teal top-right, blue bottom-left). */}
      <LinearGradient
        colors={["#040611", "#0B1122", "#03060E"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.glowOrb, styles.glowOrbTop]} pointerEvents="none" />
      <View style={[styles.glowOrb, styles.glowOrbBottom]} pointerEvents="none" />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + webTopInset + 40,
            paddingBottom: insets.bottom + 28 + webBottomInset,
          },
        ]}
      >
        <View style={styles.brandingSection}>
          <View style={styles.logoWrap}>
            <Ionicons name="analytics" size={36} color={ds.color.success} />
          </View>
          <Text style={styles.appName}>
            Swing <Text style={styles.appNameAccent}>AI</Text>
          </Text>
          <Text style={styles.tagline}>Precision coaching for every swing</Text>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.cardTitle}>{isSignUpMode ? "Create Account" : "Welcome Back"}</Text>
          <Text style={styles.cardSubtitle}>
            {isSignUpMode ? "Start your journey" : "Sign in to continue"}
          </Text>

          {isSignUpMode && (
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={ds.color.textTertiary} />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
                placeholderTextColor={ds.color.textTertiary}
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="next"
                testID="signup-name"
              />
            </View>
          )}

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={ds.color.textTertiary} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={ds.color.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="next"
              testID="auth-email"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={ds.color.textTertiary} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={ds.color.textTertiary}
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
                transform: [{ scale: pressed ? 0.97 : 1 }],
                opacity: authLoading ? 0.7 : 1,
              },
            ]}
            testID="local-auth-button"
          >
            {authLoading ? (
              <ActivityIndicator size="small" color={ds.color.bg} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignUpMode ? "Sign Up" : "Sign In"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setIsSignUpMode((prev) => !prev)}
            style={styles.modeToggle}
            testID="auth-mode-toggle"
          >
            <Text style={styles.modeToggleText}>
              {isSignUpMode
                ? "Already have an account? "
                : "New here? "}
              <Text style={styles.modeToggleLink}>
                {isSignUpMode ? "Sign In" : "Create Account"}
              </Text>
            </Text>
          </Pressable>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  glowOrb: {
    position: "absolute",
    borderRadius: 130,
  },
  glowOrbTop: {
    top: -90,
    right: -30,
    width: 260,
    height: 260,
    backgroundColor: "#34D39912", // soft teal halo
  },
  glowOrbBottom: {
    bottom: -80,
    left: -40,
    width: 240,
    height: 240,
    backgroundColor: "#60A5FA14", // soft blue halo
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 32,
  },
  brandingSection: {
    alignItems: "center",
    gap: 8,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(52, 211, 153, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  appName: {
    ...ds.type.bold,
    fontSize: 40,
    color: ds.color.textPrimary,
    letterSpacing: -1,
  },
  appNameAccent: {
    color: ds.color.success,
  },
  tagline: {
    ...ds.type.regular,
    fontSize: ds.font.callout,
    color: ds.color.textSecondary,
    letterSpacing: 0.2,
  },
  authCard: {
    borderRadius: 18,
    backgroundColor: ds.color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ds.color.glassBorder,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    ...ds.type.bold,
    fontSize: ds.font.title,
    color: ds.color.textPrimary,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    ...ds.type.regular,
    fontSize: ds.font.callout,
    color: ds.color.textSecondary,
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: ds.color.bgTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ds.color.glassBorder,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
  },
  input: {
    ...ds.type.regular,
    flex: 1,
    color: ds.color.textPrimary,
    fontSize: ds.font.callout,
    paddingVertical: 0,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: ds.color.accent,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...ds.type.semibold,
    fontSize: ds.font.headline,
    color: ds.color.bg,
    letterSpacing: -0.2,
  },
  modeToggle: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 2,
  },
  modeToggleText: {
    ...ds.type.regular,
    fontSize: ds.font.subhead,
    color: ds.color.textSecondary,
  },
  modeToggleLink: {
    ...ds.type.medium,
    color: ds.color.success,
  },
});
