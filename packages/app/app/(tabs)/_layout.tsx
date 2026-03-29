import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import { TabBarProvider, useTabBar } from "@/lib/tab-bar-context";

const PILL_HEIGHT = 58;
const PILL_BOTTOM_OFFSET = 16; // distance from safe area bottom

function ClassicTabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isIOS = Platform.OS === "ios";
  const { translateY } = useTabBar();
  const hideDistance = PILL_HEIGHT + PILL_BOTTOM_OFFSET + insets.bottom + 20;
  const horizontalInset = Math.max(12, Math.min(24, Math.round(width * 0.07)));

  const animatedTranslate = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, hideDistance],
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#0A84FF",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          position: "absolute",
          bottom: PILL_BOTTOM_OFFSET + insets.bottom,
          left: horizontalInset,
          right: horizontalInset,
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
          backgroundColor: isIOS ? "transparent" : "rgba(28,28,30,0.82)",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255,255,255,0.18)",
          elevation: 4,
          paddingBottom: 0,
          overflow: "hidden",
          transform: [{ translateY: animatedTranslate as any }],
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 14,
        },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: "600",
          marginBottom: 4,
          alignSelf: "center",
          textAlign: "center",
        },
        tabBarIconStyle: {
          marginTop: 6,
          marginBottom: 0,
          alignSelf: "center",
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="systemChromeMaterialDark"
              style={[StyleSheet.absoluteFill, { borderRadius: PILL_HEIGHT / 2, overflow: "hidden" }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: "Analyse",
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Track",
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={18} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <TabBarProvider>
      <ClassicTabLayout />
    </TabBarProvider>
  );
}
