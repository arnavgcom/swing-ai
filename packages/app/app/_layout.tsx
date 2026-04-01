import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useSegments, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { queryClient } from "@/services/query-client";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { SportProvider, useSport } from "@/contexts/sport-context";
import { View, ActivityIndicator, StyleSheet } from "react-native";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: sportLoading } = useSport();
  const segments = useSegments();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(true);

  const isLoading = authLoading || sportLoading;

  useEffect(() => {
    if (isLoading) {
      setIsRedirecting(true);
      return;
    }

    const inAuthGroup = segments[0] === "login";
    let nextRoute: "/login" | "/" | null = null;

    if (!user) {
      if (!inAuthGroup) {
        nextRoute = "/login";
      }
    } else if (inAuthGroup) {
      nextRoute = "/";
    }

    if (nextRoute) {
      setIsRedirecting(true);
      router.replace(nextRoute);
      return;
    }

    setIsRedirecting(false);
  }, [isLoading, user, segments, router]);

  return (
    <>
      <Stack initialRouteName="login" screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="profile"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="analysis/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="analysis/[id]/trends"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="analysis/[id]/diagnostics"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="analysis/[id]/manual-annotation"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="analysis/[id]/improved"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/add-player"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/score-metrics-selection"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/configure"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/recalculate-metrics"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/admin-dashboard"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/fps-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/validation-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/pose-landmarker-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/classification-model-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/drive-movement-classification-model-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/sports-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/ml-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/storage-settings"
          options={{ headerShown: false }}
        />
      </Stack>

      {(isLoading || isRedirecting) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0A84FF" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SportProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootNavigator />
            </GestureHandlerRootView>
          </SportProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}