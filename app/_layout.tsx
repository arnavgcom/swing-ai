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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SportProvider, useSport } from "@/lib/sport-context";
import { View, ActivityIndicator } from "react-native";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedSport, isLoading: sportLoading } = useSport();
  const segments = useSegments();
  const router = useRouter();
  const [navigationReady, setNavigationReady] = useState(false);

  const isLoading = authLoading || sportLoading;

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setNavigationReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!navigationReady) return;

    const inAuthGroup = segments[0] === "login";
    const inSportSelect = segments[0] === "sport-select";

    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && !selectedSport && !inSportSelect) {
      router.replace("/sport-select");
    } else if (user && selectedSport && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, selectedSport, segments, navigationReady]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0A1A",
        }}
      >
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="sport-select" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="analysis/[id]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
    </Stack>
  );
}

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
