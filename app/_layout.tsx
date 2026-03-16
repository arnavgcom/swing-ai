import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useSegments, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SportProvider, useSport } from "@/lib/sport-context";
import { View, ActivityIndicator, StyleSheet } from "react-native";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedSport, isLoading: sportLoading } = useSport();
  const segments = useSegments();
  const router = useRouter();
  // Track whether the Stack has mounted at least once before we allow navigation.
  const stackMountedRef = useRef(false);

  const isLoading = authLoading || sportLoading;

  useEffect(() => {
    // Wait until the Stack is guaranteed to have rendered before navigating.
    if (!stackMountedRef.current) return;
    if (isLoading) return;

    const inAuthGroup = segments[0] === "login";
    const inSportSelect = segments[0] === "sport-select";

    if (!user) {
      if (!inAuthGroup) router.replace("/login");
      return;
    }

    if (!selectedSport) {
      if (!inSportSelect) router.replace("/sport-select");
      return;
    }

    if (inAuthGroup || inSportSelect) {
      router.replace("/(tabs)");
    }
  }, [isLoading, user, selectedSport, segments, router]);

  // Stack is always rendered so the navigator is always mounted.
  // The loading overlay sits on top and prevents interaction until ready.
  return (
    <View style={stackStyles.root}>
      <Stack
        initialRouteName="login"
        screenOptions={{ headerBackTitle: "Back" }}
        // Signal that the Stack has mounted — safe to navigate after this.
        onLayout={() => { stackMountedRef.current = true; }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="sport-select" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="analysis/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="analysis/[id]/trends" options={{ headerShown: false }} />
        <Stack.Screen name="analysis/[id]/diagnostics" options={{ headerShown: false }} />
        <Stack.Screen name="analysis/[id]/manual-annotation" options={{ headerShown: false }} />
        <Stack.Screen name="analysis/[id]/improved" options={{ headerShown: false }} />
        <Stack.Screen name="model-config" options={{ headerShown: false }} />
        <Stack.Screen name="profile/add-player" options={{ headerShown: false }} />
        <Stack.Screen name="profile/score-metrics-selection" options={{ headerShown: false }} />
      </Stack>

      {isLoading && (
        <View style={stackStyles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
      )}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  root: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0A1A",
    alignItems: "center",
    justifyContent: "center",
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
