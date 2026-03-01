import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth-context";
import { getApiUrl } from "@/lib/query-client";

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

function GoogleIcon({ size = 20 }: { size?: number }) {
  const r = size / 2;
  const stroke = size * 0.22;
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: stroke,
          borderColor: "transparent",
          borderTopColor: "#EA4335",
          borderRightColor: "#FBBC05",
          borderBottomColor: "#34A853",
          borderLeftColor: "#4285F4",
          position: "absolute",
        }}
      />
      <View
        style={{
          position: "absolute",
          right: 0,
          top: size * 0.28,
          width: size * 0.52,
          height: stroke,
          backgroundColor: "#FBBC05",
          borderTopRightRadius: stroke / 2,
          borderBottomRightRadius: stroke / 2,
        }}
      />
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { googleLogin } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

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
        const apiBase = getApiUrl();
        const callbackUrl = new URL("/api/auth/google/mobile-callback", apiBase).href;

        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
          `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
          `&response_type=token` +
          `&scope=${encodeURIComponent("openid profile email")}`;

        const result = await WebBrowser.openAuthSessionAsync(authUrl, "swingai://google-auth");

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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#111136", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={styles.glowOrb1} />
      <View style={styles.glowOrb2} />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + webTopInset,
            paddingBottom: insets.bottom + 40 + webBottomInset,
          },
        ]}
      >
        <View style={styles.brandingSection}>
          <Text style={styles.appName}>
            Swing <Text style={styles.appNameAccent}>AI</Text>
          </Text>
          <Text style={styles.tagline}>Your AI Performance Coach</Text>
        </View>

        <View style={styles.bottomSection}>
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
            <LinearGradient
              colors={["#6C5CE7", "#A29BFE"]}
              style={styles.googleGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <GoogleIcon size={22} />
                  <Text style={styles.googleText}>Continue with Google</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.termsText}>
            By continuing, you agree to our Terms of Service
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "space-between",
  },
  glowOrb1: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#6C5CE712",
  },
  glowOrb2: {
    position: "absolute",
    bottom: 60,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#34D39908",
  },
  brandingSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
  },
  appName: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    letterSpacing: -1,
  },
  appNameAccent: {
    color: "#34D399",
  },
  tagline: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 10,
    letterSpacing: 0.3,
  },
  bottomSection: {
    alignItems: "center",
    gap: 16,
  },
  googleButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  googleGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 17,
    borderRadius: 16,
  },
  googleText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  termsText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#475569",
    textAlign: "center" as const,
  },
});
