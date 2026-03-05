import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { sportColors } from "@/constants/colors";
import { fetchAnalysesSummary, fetchDiscrepancySummary } from "@/lib/api";
import type { AnalysisSummary } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";

function filterBySport(
  analyses: AnalysisSummary[],
  sportName: string | undefined,
  movementName: string | undefined,
): AnalysisSummary[] {
  if (!sportName) return analyses;
  const sportLower = sportName.toLowerCase();
  return analyses.filter((a) => {
    if (!a.configKey) return false;
    const keyLower = a.configKey.toLowerCase();
    if (!keyLower.startsWith(sportLower)) return false;
    if (movementName) {
      const movLower = movementName.toLowerCase().replace(/\s+/g, "");
      if (!keyLower.includes(movLower)) return false;
    }
    return true;
  });
}

function formatLabel(label: string): string {
  return label
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMovementBadgeLabel(movementName?: string | null): string {
  if (!movementName) return "Auto detect";
  return formatLabel(movementName);
}

function toWeekdayInitial(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const initials = ["S", "M", "T", "W", "T", "F", "S"];
  return initials[date.getUTCDay()] || "-";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMismatchPalette(rate: number): { bg: string; border: string; text: string } {
  if (rate < 10) {
    return { bg: "#052E1A", border: "#166534", text: "#34D399" };
  }
  if (rate <= 25) {
    return { bg: "#3F2A07", border: "#92400E", text: "#FBBF24" };
  }
  return { bg: "#3F1114", border: "#7F1D1D", text: "#F87171" };
}

function getPlayerDisplayName(u: {
  id: string;
  name: string;
  email: string;
  role: string;
}): string {
  const fullName = String(u.name || "").trim();
  return fullName || String(u.email || "").trim() || "Unknown";
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { selectedSport, selectedMovement } = useSport();
  const isAdmin = user?.role === "admin";
  const [userList, setUserList] = React.useState<Array<{id:string,name:string,email:string,role:string}>>([]);
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string>("all");
  const [showPlayerDropdown, setShowPlayerDropdown] = React.useState(false);
  React.useEffect(() => {
    if (!isAdmin) {
      setSelectedPlayerId("all");
      setShowPlayerDropdown(false);
      setUserList([]);
      return;
    }

    (async () => {
      try {
        const baseUrl = getApiUrl();
        const res = await fetch(`${baseUrl}api/users`, { credentials: "include" });
        if (res.ok) {
          const users = await res.json();
          if (Array.isArray(users) && users.length > 0) {
            setUserList(users);
          } else if (user) {
            setUserList([
              {
                id: user.id,
                name: user.name || "",
                email: user.email || "",
                role: user.role || "player",
              },
            ]);
          } else {
            setUserList([]);
          }
        }
      } catch (e) {
        if (user) {
          setUserList([
            {
              id: user.id,
              name: user.name || "",
              email: user.email || "",
              role: user.role || "player",
            },
          ]);
        } else {
          setUserList([]);
        }
      }
    })();
  }, [isAdmin, user]);

  const sc = sportColors[selectedSport?.name || ""] || {
    primary: "#6C5CE7",
    gradient: "#5A4BD1",
  };

  const {
    data: allAnalyses,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["analyses-summary"],
    queryFn: fetchAnalysesSummary,
    refetchInterval: 5000,
    enabled: !!user,
    retry: false,
  });

  const {
    data: discrepancy,
    isLoading: discrepancyLoading,
    isError: discrepancyIsError,
    refetch: refetchDiscrepancy,
    isRefetching: discrepancyRefetching,
  } = useQuery({
    queryKey: [
      "discrepancy-summary",
      selectedSport?.name || "all",
      selectedMovement?.name || "auto-detect",
      isAdmin ? selectedPlayerId : user?.id || "self",
    ],
    queryFn: () =>
      fetchDiscrepancySummary(
        selectedSport?.name,
        selectedMovement?.name,
        isAdmin ? selectedPlayerId : user?.id,
      ),
    enabled: !!user,
    retry: false,
  });

  let filteredAnalyses = filterBySport(
    allAnalyses || [],
    selectedSport?.name,
    selectedMovement?.name,
  );
  if (isAdmin && selectedPlayerId !== "all") {
    filteredAnalyses = filteredAnalyses.filter(a => a.userId === selectedPlayerId);
  } else if (!isAdmin && user?.id) {
    filteredAnalyses = filteredAnalyses.filter(a => a.userId === user.id);
  }
  const isAutoDetectMode = !selectedMovement?.name;
  const selectedPlayerLabel =
    selectedPlayerId === "all"
      ? "All"
      : (() => {
          const selected = userList.find((u) => u.id === selectedPlayerId);
          return selected ? getPlayerDisplayName(selected) : "All";
        })();
  const playerFilterLabel = isAdmin ? selectedPlayerLabel : user?.name || "Player";
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <TabHeader />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || discrepancyRefetching}
            onRefresh={() => {
              refetch();
              refetchDiscrepancy();
            }}
            tintColor="#6C5CE7"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>Hi Vikram,</Text>
          <Text style={styles.greetingSubtitle}>Ready to improve your game today?</Text>
          <View style={styles.sportLineRow}>
            {isAdmin ? (
              <Pressable
                onPress={() => setShowPlayerDropdown((prev) => !prev)}
                style={[
                  styles.playerDropdown,
                  {
                    borderColor: `${sc.primary}55`,
                    backgroundColor: `${sc.primary}12`,
                  },
                ]}
              >
                <Ionicons name="people" size={15} color={sc.primary} />
                <Text style={[styles.playerDropdownText, { color: sc.primary }]} numberOfLines={1}>
                  {playerFilterLabel}
                </Text>
                <Ionicons
                  name={showPlayerDropdown ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={sc.primary}
                />
              </Pressable>
            ) : (
              <View
                style={[
                  styles.playerDropdown,
                  styles.playerDropdownReadonly,
                  {
                    borderColor: `${sc.primary}55`,
                    backgroundColor: `${sc.primary}12`,
                  },
                ]}
              >
                <Ionicons name="people" size={15} color={sc.primary} />
                <Text style={[styles.playerDropdownText, { color: sc.primary }]} numberOfLines={1}>
                  {playerFilterLabel}
                </Text>
              </View>
            )}
            {selectedSport?.name && (
              <View
                style={[
                  styles.movementBadge,
                  isAutoDetectMode && {
                    backgroundColor: `${sc.primary}12`,
                    borderColor: `${sc.primary}30`,
                  },
                ]}
              >
                <Ionicons
                  name="flash-outline"
                  size={11}
                  color={isAutoDetectMode ? sc.primary : "#34D399"}
                />
                <Text
                  style={[
                    styles.movementBadgeText,
                    isAutoDetectMode && { color: sc.primary },
                  ]}
                >
                  {formatMovementBadgeLabel(selectedMovement?.name)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {isAdmin && showPlayerDropdown && (
          <Modal
            transparent
            animationType="fade"
            onRequestClose={() => setShowPlayerDropdown(false)}
          >
            <Pressable
              style={styles.playerDropdownOverlay}
              onPress={() => setShowPlayerDropdown(false)}
            >
              <Pressable
                style={styles.playerDropdownMenu}
                onPress={() => {}}
              >
                {[
                  { id: "all", name: "All" },
                  ...userList.map((u) => ({ id: u.id, name: getPlayerDisplayName(u) })),
                ].map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setSelectedPlayerId(option.id);
                      setShowPlayerDropdown(false);
                    }}
                    style={[
                      styles.playerDropdownItem,
                      option.id === selectedPlayerId && {
                        backgroundColor: `${sc.primary}18`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.playerDropdownItemText,
                        option.id === selectedPlayerId && { color: sc.primary },
                      ]}
                    >
                      {option.name}
                    </Text>
                    {option.id === selectedPlayerId ? (
                      <Ionicons name="checkmark" size={15} color={sc.primary} />
                    ) : null}
                  </Pressable>
                ))}
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#6C5CE7" />
          </View>
        ) : (
          <>
            {(discrepancyLoading || discrepancyIsError || !!discrepancy) && (
              <View style={styles.discrepancyCard}>
                <View style={styles.discrepancyHeader}>
                  <Text style={styles.discrepancyTitle}>Discrepancy Report</Text>
                  {!discrepancyLoading && !discrepancyIsError && discrepancy && (
                    <Text style={[styles.discrepancyRate, { color: sc.primary }]}> 
                      {discrepancy.summary.mismatchRatePct.toFixed(1)}%
                    </Text>
                  )}
                </View>

                {discrepancyLoading && (
                  <Text style={styles.discrepancyStateText}>Loading discrepancy data…</Text>
                )}

                {discrepancyIsError && (
                  <Text style={styles.discrepancyStateText}>
                    Could not load discrepancy data yet. Pull to refresh after backend restart.
                  </Text>
                )}

                {!discrepancyLoading && !discrepancyIsError && discrepancy && discrepancy.summary.videosAnnotated === 0 && (
                  <Text style={styles.discrepancyStateText}>
                    No annotated videos found for this sport/movement selection yet.
                  </Text>
                )}

                {!discrepancyLoading && !discrepancyIsError && discrepancy && discrepancy.summary.videosAnnotated > 0 && (
                  <>
                    {discrepancy.trend7d.length > 0 && (
                      <View style={styles.discrepancyTrendCard}>
                        <View style={styles.discrepancyTrendHeader}>
                          <Text style={styles.discrepancyTrendTitle}>Last 7 Days</Text>
                          <Text style={[styles.discrepancyTrendValue, { color: sc.primary }]}> 
                            {discrepancy.trend7d[discrepancy.trend7d.length - 1]?.mismatchRatePct.toFixed(1)}%
                          </Text>
                        </View>
                        <View style={styles.discrepancyTrendBars}>
                          {(() => {
                            const maxRate = Math.max(
                              ...discrepancy.trend7d.map((point) => point.mismatchRatePct),
                              1,
                            );
                            return discrepancy.trend7d.map((point) => {
                              const barHeight = Math.max(
                                6,
                                Math.round((point.mismatchRatePct / maxRate) * 28),
                              );
                              return (
                                <View key={point.day} style={styles.discrepancyTrendBarItem}>
                                  <View
                                    style={[
                                      styles.discrepancyTrendBar,
                                      {
                                        height: barHeight,
                                        backgroundColor:
                                          point.mismatchRatePct > 0
                                            ? `${sc.primary}CC`
                                            : "#334155",
                                      },
                                    ]}
                                  />
                                </View>
                              );
                            });
                          })()}
                        </View>
                        <View style={styles.discrepancyTrendLabels}>
                          {discrepancy.trend7d.map((point) => (
                            <Text key={`label-${point.day}`} style={styles.discrepancyTrendLabelText}>
                              {toWeekdayInitial(point.day)}
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}

                    <View style={styles.discrepancyList}>
                      {discrepancy.topVideos.filter((item) => item.mismatches > 0).map((item) => (
                        <View key={item.analysisId} style={styles.discrepancyRow}>
                          <View style={styles.discrepancyRowLeft}>
                            <View style={styles.discrepancyTopLine}>
                              <Text style={styles.discrepancyVideoName} numberOfLines={1}>
                                {String(item.userName || "Player")}
                              </Text>
                            </View>
                            <Text style={styles.discrepancyMeta} numberOfLines={1}>
                              {`${String(item.sportName || "Sport")} • ${formatLabel(item.movementName)}`}
                            </Text>
                            <Text style={styles.discrepancyMetaSecondary}>
                              {formatDateTime(item.createdAt)}
                            </Text>
                            <Text style={styles.discrepancyMetaSecondary}>
                              {`${item.mismatches}/${item.manualShots} shots mismatched`}
                            </Text>
                          </View>
                          <View style={styles.discrepancyRowRight}>
                            {(() => {
                              const palette = getMismatchPalette(item.mismatchRatePct);
                              return (
                                <View
                                  style={[
                                    styles.discrepancyRateBadge,
                                    { backgroundColor: palette.bg, borderColor: palette.border },
                                  ]}
                                >
                                  <Text style={[styles.discrepancyRateText, { color: palette.text }]}> 
                                    {item.mismatchRatePct.toFixed(1)}%
                                  </Text>
                                </View>
                              );
                            })()}
                            <Pressable
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push({
                                  pathname: "/analysis/[id]",
                                  params: { id: item.analysisId },
                                });
                              }}
                              style={({ pressed }) => [
                                styles.discrepancyReviewButton,
                                { borderColor: `${sc.primary}66` },
                                { opacity: pressed ? 0.75 : 1 },
                              ]}
                            >
                              <Text style={[styles.discrepancyReviewText, { color: sc.primary }]}>Review</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>

                    {discrepancy.topVideos.filter((item) => item.mismatches > 0).length === 0 && (
                      <Text style={styles.discrepancyStateText}>
                        No discrepancy videos found for this selection.
                      </Text>
                    )}

                    {discrepancy.labelConfusions.length > 0 && (
                      <Text style={styles.discrepancyConfusionText}>
                        Top confusion{selectedMovement?.name ? ` (involving ${formatLabel(selectedMovement.name)})` : ""}: {formatLabel(discrepancy.labelConfusions[0].from)} → {formatLabel(discrepancy.labelConfusions[0].to)} ({discrepancy.labelConfusions[0].count})
                      </Text>
                    )}
                  </>
                )}
              </View>
            )}

            {filteredAnalyses.length === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name={(selectedSport?.icon as any) || "fitness-outline"}
                    size={36}
                    color="#475569"
                  />
                </View>
                <Text style={styles.emptyTitle}>No analyses yet</Text>
                <Text style={styles.emptyText}>
                  Upload a {selectedSport?.name?.toLowerCase() || "sport"} video
                  to get started
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  greetingSection: { marginTop: 20, marginBottom: 28 },
  greeting: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  greetingSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    color: "#94A3B8",
  },
  sportLineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  sportLine: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  movementBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#34D39912",
    borderWidth: 1,
    borderColor: "#34D39930",
  },
  movementBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#34D399",
  },
  playerDropdown: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: "55%",
  },
  playerDropdownText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    maxWidth: 140,
  },
  playerDropdownReadonly: {
    justifyContent: "flex-start",
  },
  playerDropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    paddingTop: 170,
    paddingHorizontal: 20,
  },
  playerDropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    maxHeight: 260,
    overflow: "hidden",
  },
  playerDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerDropdownItemText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#CBD5E1",
  },
  loadingWrap: { paddingTop: 60, alignItems: "center" },
  discrepancyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
    padding: 14,
    gap: 12,
    marginBottom: 24,
  },
  discrepancyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  discrepancyTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  discrepancyRate: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  discrepancyStateText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  discrepancyTrendCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5035",
    backgroundColor: "#0A0A1A90",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  discrepancyTrendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  discrepancyTrendTitle: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  discrepancyTrendValue: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  discrepancyTrendBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    height: 32,
  },
  discrepancyTrendBarItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  discrepancyTrendBar: {
    width: "100%",
    borderRadius: 6,
  },
  discrepancyTrendLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  discrepancyTrendLabelText: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
  },
  discrepancyList: {
    gap: 8,
  },
  discrepancyRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2A5035",
    backgroundColor: "#0A0A1A80",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  discrepancyRowLeft: {
    flex: 1,
    gap: 2,
  },
  discrepancyRowRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 64,
  },
  discrepancyTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  discrepancyVideoName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#E2E8F0",
    flex: 1,
  },
  discrepancyMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  discrepancyMetaSecondary: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#CBD5E1",
  },
  discrepancyUploader: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#A29BFE",
  },
  discrepancyRateBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discrepancyRateText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  discrepancyReviewButton: {
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#101025",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  discrepancyReviewText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  discrepancyConfusionText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#CBD5E1",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 20,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#15152D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2A2A5060",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center" as const,
    lineHeight: 21,
    paddingHorizontal: 20,
    color: "#64748B",
  },
});
