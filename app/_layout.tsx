import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
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
  const { user, isLoading } = useAuth();
  const { selectedSport } = useSport();
  const segments = useSegments();

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

  const inAuthGroup = segments[0] === "login";
  const inSportSelect = segments[0] === "sport-select";

  if (!user && !inAuthGroup) {
    return <Redirect href="/login" />;
  }

  if (user && !selectedSport && !inSportSelect) {
    return <Redirect href="/sport-select" />;
  }

  if (user && selectedSport && (inAuthGroup || (inSportSelect && segments.length === 1))) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="sport-select" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootNavigator />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SportProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
