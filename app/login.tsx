import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function LoginScreen() {
  const colors = Colors.dark;
  const insets = useSafeAreaInsets();
  const { login, register, googleLogin } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleGoogleToken = async (accessToken: string) => {
    setGoogleLoading(true);
    try {
      await googleLogin({ accessToken });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = error?.message?.includes(":")
        ? error.message.split(":").slice(1).join(":").trim()
        : error?.message || "Google sign-in failed";
      Alert.alert("Error", msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGooglePress = async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert(
        "Setup Required",
        "Google Sign-In requires a Google Client ID. Please configure EXPO_PUBLIC_GOOGLE_CLIENT_ID in your environment.",
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGoogleLoading(true);
    try {
      if (Platform.OS === "web") {
        const redirectUri = typeof window !== "undefined" ? window.location.origin + "/login" : "";
        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=token` +
          `&scope=${encodeURIComponent("openid profile email")}`;

        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (result.type === "success" && result.url) {
          const urlFragment = result.url.split("#")[1];
          if (urlFragment) {
            const params = new URLSearchParams(urlFragment);
            const accessToken = params.get("access_token");
            if (accessToken) {
              await handleGoogleToken(accessToken);
              return;
            }
          }
          Alert.alert("Error", "Could not get access token from Google");
        }
      } else {
        const domain = process.env.EXPO_PUBLIC_DOMAIN || "";
        const host = domain.split(":")[0];
        const callbackUrl = `https://${host}/api/auth/google/mobile-callback`;

        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
          `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
          `&response_type=token` +
          `&scope=${encodeURIComponent("openid profile email")}`;

        const result = await WebBrowser.openAuthSessionAsync(authUrl, "acexai://google-auth");

        if (result.type === "success" && result.url) {
          const urlObj = new URL(result.url);
          const accessToken = urlObj.searchParams.get("access_token");
          if (accessToken) {
            await handleGoogleToken(accessToken);
            return;
          }
          Alert.alert("Error", "Could not get access token from Google");
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please fill in all required fields");
      return;
    }
    if (isRegister && !name.trim()) {
      Alert.alert("Missing fields", "Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        await register(email.trim(), name.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = error?.message?.includes(":")
        ? error.message.split(":").slice(1).join(":").trim()
        : error?.message || "Something went wrong";
      Alert.alert("Error", msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#131340", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.glowOrb1} />
      <View style={styles.glowOrb2} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + 60 + webTopInset,
              paddingBottom: insets.bottom + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <View style={styles.logoMark}>
              <LinearGradient
                colors={["#6C5CE7", "#00F5A0"]}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.logoLetter}>A</Text>
              </LinearGradient>
            </View>
            <Text style={styles.appName}>
              Ace<Text style={styles.appNameAccent}>X</Text> AI
            </Text>
            <Text style={styles.tagline}>
              Your AI Performance Coach
            </Text>
          </View>

          <Pressable
            onPress={handleGooglePress}
            disabled={googleLoading}
            style={({ pressed }) => [
              styles.googleButton,
              {
                transform: [{ scale: pressed ? 0.97 : 1 }],
                opacity: googleLoading ? 0.7 : 1,
              },
            ]}
            testID="google-login-button"
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#fff" />
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or use email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.formSection}>
            {isRegister && (
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#4A5568"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  testID="name-input"
                />
              </View>
            )}

            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#64748B" />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#4A5568"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="email-input"
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#4A5568"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                testID="password-input"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#64748B"
                />
              </Pressable>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  opacity: isLoading ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              testID="submit-button"
            >
              <LinearGradient
                colors={["#6C5CE7", "#A29BFE"]}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>
                    {isRegister ? "Create Account" : "Sign In"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.toggleSection}>
            <Text style={styles.toggleText}>
              {isRegister ? "Already have an account?" : "Don't have an account?"}
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsRegister(!isRegister);
              }}
            >
              <Text style={styles.toggleLink}>
                {isRegister ? "Sign In" : "Sign Up"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 28 },
  glowOrb1: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#6C5CE720",
  },
  glowOrb2: {
    position: "absolute",
    bottom: 60,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#00F5A015",
  },
  logoSection: { alignItems: "center", marginBottom: 44 },
  logoMark: {
    marginBottom: 16,
  },
  logoGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  appName: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    letterSpacing: -0.5,
  },
  appNameAccent: {
    color: "#00F5A0",
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 6,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1A1A36",
    borderWidth: 1,
    borderColor: "#2A2A50",
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 24,
  },
  googleText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#2A2A50" },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#475569",
  },
  formSection: { gap: 12 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131328",
    borderWidth: 1,
    borderColor: "#2A2A50",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#F8FAFC",
  },
  submitButton: {
    marginTop: 6,
    borderRadius: 12,
    overflow: "hidden",
  },
  submitGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  toggleSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 32,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  toggleLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#A29BFE",
  },
});
