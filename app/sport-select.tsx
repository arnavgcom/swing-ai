import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useSport } from "@/lib/sport-context";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { setSport, setMovement } = useSport();

  const [expandedSportId, setExpandedSportId] = useState<string | null>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: sportsData, isLoading } = useQuery<Sport[]>({
    queryKey: ["/api/sports"],
  });

  const { data: movements } = useQuery<Movement[]>({
    queryKey: ["/api/sports", expandedSportId, "movements"],
    enabled: !!expandedSportId,
  });

  const handleSportPress = (sport: Sport) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expandedSportId === sport.id) {
      setExpandedSportId(null);
    } else {
      setExpandedSportId(sport.id);
    }
  };

  const handleMovementSelect = (sport: Sport, movement: Movement) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSport({
      id: sport.id,
      name: sport.name,
      icon: sport.icon,
      color: sport.color,
    });
    setMovement({
      id: movement.id,
      name: movement.name,
      icon: movement.icon,
    });
    router.replace("/(tabs)");
  };

  const handleSportOnly = (sport: Sport) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSport({
      id: sport.id,
      name: sport.name,
      icon: sport.icon,
      color: sport.color,
    });
    setMovement(null);
    router.replace("/(tabs)");
  };

  const iconName = (name: string): keyof typeof Ionicons.glyphMap => {
    return name as keyof typeof Ionicons.glyphMap;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <View style={styles.header}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            CHOOSE YOUR SPORT
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            What are you training?
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select a sport and movement to get personalized AI analysis
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.sportsList}>
            {sportsData?.map((sport) => {
              const isExpanded = expandedSportId === sport.id;
              return (
                <View key={sport.id}>
                  <Pressable
                    onPress={() => handleSportPress(sport)}
                    style={({ pressed }) => [
                      styles.sportCard,
                      {
                        backgroundColor: isExpanded
                          ? sport.color + "15"
                          : colors.surface,
                        borderColor: isExpanded ? sport.color + "40" : colors.border,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <View style={styles.sportCardContent}>
                      <View
                        style={[
                          styles.sportIconWrap,
                          { backgroundColor: sport.color + "20" },
                        ]}
                      >
                        <Ionicons
                          name={iconName(sport.icon)}
                          size={24}
                          color={sport.color}
                        />
                      </View>
                      <View style={styles.sportInfo}>
                        <Text style={[styles.sportName, { color: colors.text }]}>
                          {sport.name}
                        </Text>
                        <Text
                          style={[styles.sportDesc, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {sport.description}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </View>
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.movementsList}>
                      {movements ? (
                        <>
                          {movements.map((movement) => (
                            <Pressable
                              key={movement.id}
                              onPress={() => handleMovementSelect(sport, movement)}
                              style={({ pressed }) => [
                                styles.movementCard,
                                {
                                  backgroundColor: colors.surface,
                                  borderColor: colors.border,
                                  transform: [{ scale: pressed ? 0.97 : 1 }],
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.movementIcon,
                                  { backgroundColor: sport.color + "15" },
                                ]}
                              >
                                <Ionicons
                                  name={iconName(movement.icon)}
                                  size={16}
                                  color={sport.color}
                                />
                              </View>
                              <View style={styles.movementInfo}>
                                <Text
                                  style={[styles.movementName, { color: colors.text }]}
                                >
                                  {movement.name}
                                </Text>
                                <Text
                                  style={[
                                    styles.movementDesc,
                                    { color: colors.textSecondary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {movement.description}
                                </Text>
                              </View>
                              <Ionicons
                                name="arrow-forward"
                                size={16}
                                color={sport.color}
                              />
                            </Pressable>
                          ))}
                          <Pressable
                            onPress={() => handleSportOnly(sport)}
                            style={[
                              styles.allButton,
                              { borderColor: sport.color + "40" },
                            ]}
                          >
                            <Text style={[styles.allButtonText, { color: sport.color }]}>
                              All {sport.name} (Auto-detect)
                            </Text>
                          </Pressable>
                        </>
                      ) : (
                        <ActivityIndicator
                          size="small"
                          color={sport.color}
                          style={{ paddingVertical: 16 }}
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: { marginBottom: 28 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  sportsList: { gap: 10 },
  sportCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  sportCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sportIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sportInfo: { flex: 1 },
  sportName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  sportDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  movementsList: {
    paddingLeft: 24,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 6,
  },
  movementCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  movementIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  movementInfo: { flex: 1 },
  movementName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  movementDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  allButton: {
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: "dashed" as const,
    paddingVertical: 12,
    alignItems: "center",
  },
  allButtonText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
