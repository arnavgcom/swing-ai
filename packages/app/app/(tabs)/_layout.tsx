import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React from "react";
import { TabBarProvider, useTabBar } from "@/contexts/tab-bar-context";

const TAB_BAR_HEIGHT = 50;

function ClassicTabLayout() {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const { translateY } = useTabBar();
  const hideDistance = TAB_BAR_HEIGHT + insets.bottom + 12;

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
        tabBarInactiveTintColor: "#636366",
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: isIOS ? "transparent" : "rgba(28,28,30,0.96)",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "rgba(255,255,255,0.08)",
          borderColor: "transparent",
          elevation: 0,
          overflow: "hidden",
          transform: [{ translateY: animatedTranslate as any }],
          shadowColor: "transparent",
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: 2,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 12,
          fontWeight: "500",
          marginTop: 2,
          alignSelf: "center",
          textAlign: "center",
        },
        tabBarIconStyle: {
          marginBottom: 0,
          alignSelf: "center",
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint="systemChromeMaterialDark"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: "Analyse",
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Track",
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={22} color={color} />,
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
