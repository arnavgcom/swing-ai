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
        colors={["#040611", "#0B1122", "#03060E"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.glowOrbTop} />
      <View style={styles.glowOrbBottom} />

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
  container: { flex: 1, backgroundColor: "#050914" },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 18,
  },
  glowOrbTop: {
    position: "absolute",
    top: -90,
    right: -30,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#34D39912",
  },
  glowOrbBottom: {
    position: "absolute",
    bottom: -80,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#60A5FA14",
  },
  brandingSection: {
    alignItems: "center",
    marginBottom: 4,
  },
  appName: {
    fontSize: 46,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    letterSpacing: -1.2,
  },
  appNameAccent: {
    color: "#22C55E",
  },
  tagline: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  authCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#33415566",
    backgroundColor: "#0F172A99",
    padding: 18,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33415599",
    backgroundColor: "#0B1221",
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 12 : 10,
  },
  input: {
    flex: 1,
    color: "#F8FAFC",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#22C55E",
    backgroundColor: "transparent",
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#22C55E",
  },
  modeToggle: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 2,
  },
  modeToggleText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#93C5FD",
  },
});
