import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View, Pressable, Text, Animated as RNAnimated, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { TabBarProvider, useTabBar } from "@/contexts/tab-bar-context";
import { ds } from "@/constants/design-system";
import { useSportAccent } from "@/utils/useSportAccent";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const TAB_BAR_HEIGHT = 64;
const INDICATOR_V_PAD = 8;
const INDICATOR_HEIGHT = TAB_BAR_HEIGHT - INDICATOR_V_PAD * 2;

const INACTIVE_COLOR = "rgba(255, 255, 255, 0.55)";

type TabItemRect = { x: number; width: number };

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { translateY } = useTabBar();
  const accent = useSportAccent();
  // Active tint follows the active sport so users always know what
  // sport context they're in. Falls back to neutral white when no
  // sport is selected.
  const activeColor = accent.isSportSpecific ? accent.primary : ds.color.textPrimary;
  const hideDistance = TAB_BAR_HEIGHT + insets.bottom + 30;

  // Sliding indicator state
  const [tabs, setTabs] = useState<TabItemRect[]>([]);
  const slideX = useRef(new RNAnimated.Value(0)).current;
  const slideW = useRef(new RNAnimated.Value(0)).current;
  const didInit = useRef(false);

  const onTabLayout = useCallback((i: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabs((prev) => {
      const next = [...prev];
      next[i] = { x, width };
      return next;
    });
  }, []);

  useEffect(() => {
    const t = tabs[state.index];
    if (!t) return;
    if (!didInit.current) {
      slideX.setValue(t.x);
      slideW.setValue(t.width);
      didInit.current = true;
      return;
    }
    RNAnimated.parallel([
      RNAnimated.spring(slideX, {
        toValue: t.x,
        useNativeDriver: false,
        tension: 170,
        friction: 26,
      }),
      RNAnimated.spring(slideW, {
        toValue: t.width,
        useNativeDriver: false,
        tension: 170,
        friction: 26,
      }),
    ]).start();
  }, [state.index, tabs, slideX, slideW]);

  const animatedHide = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, hideDistance],
  });

  const ready = tabs.length === state.routes.length && tabs.every(Boolean);

  return (
    <RNAnimated.View
      style={[
        styles.outer,
        {
          paddingBottom: insets.bottom + 8,
          transform: [{ translateY: animatedHide as any }],
        },
      ]}
    >
      <View style={styles.pill}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={80}
            tint="dark"
            style={[StyleSheet.absoluteFill, { borderRadius: TAB_BAR_HEIGHT / 2, overflow: "hidden" }]}
          />
        ) : null}

        <View style={styles.inner}>
          {/* Sliding glass capsule */}
          {ready ? (
            <RNAnimated.View
              style={[
                styles.indicator,
                { left: slideX, width: slideW },
              ]}
            >
              {Platform.OS === "ios" ? (
                <BlurView
                  intensity={30}
                  tint="light"
                  style={[StyleSheet.absoluteFill, { borderRadius: INDICATOR_HEIGHT / 2, overflow: "hidden" }]}
                />
              ) : null}
            </RNAnimated.View>
          ) : null}

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: "tabLongPress", target: route.key });
            };

            const iconActive = (options as any).tabBarIconActive as string;
            const iconInactive = (options as any).tabBarIconInactive as string;
            const iconName = isFocused ? iconActive : iconInactive;
            const label = options.title || route.name;

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                onLayout={(e) => onTabLayout(index, e)}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                style={styles.tabItem}
              >
                <Ionicons
                  name={iconName as any}
                  size={18}
                  color={isFocused ? activeColor : INACTIVE_COLOR}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isFocused ? activeColor : INACTIVE_COLOR },
                    isFocused && styles.tabLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </RNAnimated.View>
  );
}

function ClassicTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIconActive: "stats-chart",
          tabBarIconInactive: "stats-chart-outline",
        } as any}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: "Analyse",
          tabBarIconActive: "add-circle",
          tabBarIconInactive: "add-circle-outline",
        } as any}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Track",
          tabBarIconActive: "time",
          tabBarIconInactive: "time-outline",
        } as any}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIconActive: "settings",
          tabBarIconInactive: "settings-outline",
        } as any}
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

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  pill: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: Platform.OS === "ios" ? "rgba(20, 20, 40, 0.55)" : "rgba(20, 20, 40, 0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ds.color.glassBorder,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
        }
      : { elevation: 16 }),
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: INDICATOR_V_PAD,
  },
  indicator: {
    position: "absolute",
    top: INDICATOR_V_PAD,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.20)",
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
  },
  tabLabel: {
    ...ds.type.regular,
    fontSize: 10,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    ...ds.type.semibold,
  },
});
