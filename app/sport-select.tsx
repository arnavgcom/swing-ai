import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors, { sportColors } from "@/constants/colors";
import { useSport } from "@/lib/sport-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 56 - 12) / 2;

interface Sport {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface Movement {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export default function SportSelectScreen() {
  const insets = useSafeAreaInsets();
  const { setSport, setMovement } = useSport();
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: sportsData, isLoading } = useQuery<Sport[]>({
    queryKey: ["/api/sports"],
  });

  const { data: movements } = useQuery<Movement[]>({
    queryKey: ["/api/sports", selectedSport?.id, "movements"],
    enabled: !!selectedSport,
  });

  const handleSportPress = (sport: Sport) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedSport(sport);
  };

  const handleMovementSelect = (movement: Movement) => {
    if (!selectedSport) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSport({
      id: selectedSport.id,
      name: selectedSport.name,
      icon: selectedSport.icon,
      color: selectedSport.color,
    });
    setMovement({
      id: movement.id,
      name: movement.name,
      icon: movement.icon,
    });
    router.replace("/(tabs)");
  };

  const handleAutoDetect = () => {
    if (!selectedSport) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSport({
      id: selectedSport.id,
      name: selectedSport.name,
      icon: selectedSport.icon,
      color: selectedSport.color,
    });
    setMovement(null);
    router.replace("/(tabs)");
  };

  const ENABLED_SPORTS = ["Tennis", "Golf"];

  const icon = (name: string) => name as keyof typeof Ionicons.glyphMap;

  const getSportColors = (sportName: string) => {
    return sportColors[sportName] || { primary: "#6C5CE7", gradient: "#5A4BD1" };
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {selectedSport && (
        <View
          style={[
            styles.glowOrb,
            { backgroundColor: getSportColors(selectedSport.name).primary + "20" },
          ]}
        />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 20 + webTopInset,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!selectedSport ? (
          <>
            <View style={styles.header}>
              <Text style={styles.headerLabel}>SELECT YOUR SPORT</Text>
              <Text style={styles.headerTitle}>
                What do you{"\n"}
                <Text style={styles.headerTitleAccent}>play?</Text>
              </Text>
            </View>

            {isLoading ? (
              <ActivityIndicator size="large" color="#6C5CE7" style={{ marginTop: 60 }} />
            ) : (
              <View style={styles.sportGrid}>
                {sportsData?.map((sport) => {
                  const sc = getSportColors(sport.name);
                  const isEnabled = ENABLED_SPORTS.includes(sport.name);
                  return (
                    <Pressable
                      key={sport.id}
                      onPress={() => isEnabled && handleSportPress(sport)}
                      disabled={!isEnabled}
                      style={({ pressed }) => [
                        styles.sportCard,
                        { transform: [{ scale: pressed && isEnabled ? 0.95 : 1 }] },
                        !isEnabled && styles.sportCardDisabled,
                      ]}
                    >
                      <LinearGradient
                        colors={
                          isEnabled
                            ? [sc.primary + "25", sc.gradient + "10"]
                            : ["#1A1A3010", "#15152D08"]
                        }
                        style={styles.sportCardInner}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        {!isEnabled && (
                          <View style={styles.comingSoonBadge}>
                            <Text style={styles.comingSoonText}>Coming Soon</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.sportIconCircle,
                            { backgroundColor: isEnabled ? sc.primary + "30" : "#2A2A5020" },
                          ]}
                        >
                          <Ionicons
                            name={icon(sport.icon)}
                            size={28}
                            color={isEnabled ? sc.primary : "#475569"}
                          />
                        </View>
                        <Text
                          style={[
                            styles.sportCardName,
                            !isEnabled && { color: "#475569" },
                          ]}
                        >
                          {sport.name}
                        </Text>
                        <Text style={styles.sportCardDesc} numberOfLines={2}>
                          {sport.description}
                        </Text>
                        {isEnabled ? (
                          <View style={[styles.sportCardArrow, { backgroundColor: sc.primary + "20" }]}>
                            <Ionicons name="arrow-forward" size={14} color={sc.primary} />
                          </View>
                        ) : (
                          <View style={styles.sportCardArrow} />
                        )}
                      </LinearGradient>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.movementHeader}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedSport(null);
                }}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={20} color="#CBD5E1" />
              </Pressable>
              <View style={styles.movementHeaderText}>
                <Text style={styles.headerLabel}>{selectedSport.name.toUpperCase()}</Text>
                <Text style={styles.movementTitle}>
                  Choose your{"\n"}
                  <Text style={{ color: getSportColors(selectedSport.name).primary }}>
                    focus
                  </Text>
                </Text>
              </View>
            </View>

            <View style={[styles.selectedSportBanner]}>
              <LinearGradient
                colors={[
                  getSportColors(selectedSport.name).primary + "20",
                  getSportColors(selectedSport.name).gradient + "10",
                ]}
                style={styles.bannerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.5 }}
              >
                <View style={[styles.bannerIcon, { backgroundColor: getSportColors(selectedSport.name).primary + "30" }]}>
                  <Ionicons
                    name={icon(selectedSport.icon)}
                    size={32}
                    color={getSportColors(selectedSport.name).primary}
                  />
                </View>
                <View style={styles.bannerInfo}>
                  <Text style={styles.bannerName}>{selectedSport.name}</Text>
                  <Text style={styles.bannerDesc}>{selectedSport.description}</Text>
                </View>
              </LinearGradient>
            </View>

            {movements ? (
              <View style={styles.movementsList}>
                {movements.map((movement, idx) => {
                  const sc = getSportColors(selectedSport.name);
                  return (
                    <Pressable
                      key={movement.id}
                      onPress={() => handleMovementSelect(movement)}
                      style={({ pressed }) => [
                        styles.movementCard,
                        { transform: [{ scale: pressed ? 0.97 : 1 }] },
                      ]}
                    >
                      <View style={[styles.movementIndex, { backgroundColor: sc.primary + "20" }]}>
                        <Text style={[styles.movementIndexText, { color: sc.primary }]}>
                          {idx + 1}
                        </Text>
                      </View>
                      <View style={styles.movementInfo}>
                        <Text style={styles.movementName}>{movement.name}</Text>
                        <Text style={styles.movementDesc}>{movement.description}</Text>
                      </View>
                      <View style={[styles.movementArrow, { backgroundColor: sc.primary + "15" }]}>
                        <Ionicons name="chevron-forward" size={16} color={sc.primary} />
                      </View>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={handleAutoDetect}
                  style={({ pressed }) => [
                    styles.autoDetectButton,
                    { transform: [{ scale: pressed ? 0.97 : 1 }] },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      getSportColors(selectedSport.name).primary,
                      getSportColors(selectedSport.name).gradient,
                    ]}
                    style={styles.autoDetectGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="scan-outline" size={18} color="#fff" />
                    <Text style={styles.autoDetectText}>Auto-Detect Movement</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <ActivityIndicator
                size="large"
                color={getSportColors(selectedSport.name).primary}
                style={{ marginTop: 40 }}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  scroll: { paddingHorizontal: 24 },
  glowOrb: {
    position: "absolute",
    top: -40,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  header: { marginBottom: 32 },
  headerLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
    color: "#64748B",
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    lineHeight: 42,
  },
  headerTitleAccent: {
    color: "#A29BFE",
  },
  sportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sportCard: {
    width: CARD_WIDTH,
    borderRadius: 18,
    overflow: "hidden",
  },
  sportCardInner: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2A5030",
    minHeight: 170,
    justifyContent: "space-between",
  },
  sportIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  sportCardName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    marginBottom: 4,
  },
  sportCardDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    lineHeight: 15,
    marginBottom: 10,
  },
  sportCardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  sportCardDisabled: {
    opacity: 0.55,
  },
  comingSoonBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#FBBF2420",
    borderWidth: 1,
    borderColor: "#FBBF2430",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#FBBF24",
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  movementHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1A1A36",
    borderWidth: 1,
    borderColor: "#2A2A50",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  movementHeaderText: { flex: 1 },
  movementTitle: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
    lineHeight: 38,
  },
  selectedSportBanner: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  bannerGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5030",
  },
  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerInfo: { flex: 1 },
  bannerName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  bannerDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 3,
  },
  movementsList: { gap: 10 },
  movementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131328",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A50",
    padding: 14,
    gap: 12,
  },
  movementIndex: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  movementIndexText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  movementInfo: { flex: 1 },
  movementName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  movementDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 2,
  },
  movementArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  autoDetectButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  autoDetectGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  autoDetectText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
