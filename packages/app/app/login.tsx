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
import { router } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

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
            <Ionicons name="analytics" size={36} color="#0A84FF" />
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
              <Ionicons name="person-outline" size={18} color="#636366" />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
                placeholderTextColor="#636366"
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.input}
                returnKeyType="next"
                testID="signup-name"
              />
            </View>
          )}

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#636366" />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#636366"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="next"
              testID="auth-email"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#636366" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#636366"
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
              <ActivityIndicator size="small" color="#FFFFFF" />
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
  container: { flex: 1, backgroundColor: "#000000" },
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
    backgroundColor: "rgba(10, 132, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 40,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  appNameAccent: {
    color: "#0A84FF",
  },
  tagline: {
    fontSize: 15,
    color: "#8E8E93",
    letterSpacing: 0.2,
  },
  authCard: {
    borderRadius: 18,
    backgroundColor: "#1C1C1E",
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 15,
    color: "#8E8E93",
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    backgroundColor: "#2C2C2E",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    paddingVertical: 0,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#0A84FF",
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  modeToggle: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 2,
  },
  modeToggleText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  modeToggleLink: {
    color: "#0A84FF",
    fontWeight: "500",
  },
});
