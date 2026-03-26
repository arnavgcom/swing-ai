import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ds } from "@/constants/design-system";
import AdminDashboardWorkspace from "@/components/AdminDashboardWorkspace";

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const [scrollY, setScrollY] = React.useState(0);
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }
    if (returnTo && returnTo !== "/profile") {
      router.replace(returnTo as any);
      return;
    }
    router.replace("/profile");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          setScrollY(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
      >
        <AdminDashboardWorkspace
          scrollRef={scrollRef}
          scrollY={scrollY}
          onBack={handleBack}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ds.color.bg,
  },
  scroll: {
    paddingHorizontal: 20,
  },
});