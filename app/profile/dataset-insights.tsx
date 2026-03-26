import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { fetchTennisDatasetInsights } from "@/lib/api";
import { formatDateTimeInTimeZone, resolveUserTimeZone } from "@/lib/timezone";
import { ds } from "@/constants/design-system";
import { getApiUrl } from "@/lib/query-client";

const LABEL_COLORS: Record<string, string> = {
  forehand: "#38BDF8",
  backhand: "#A78BFA",
  serve: "#F97316",
  volley: "#34D399",
  practice: "#38BDF8",
  "match-play": "#F59E0B",
};

const DATE_WINDOW_OPTIONS = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "365d", label: "1Y", days: 365 },
  { key: "all", label: "All", days: null },
] as const;

type DateWindowKey = (typeof DATE_WINDOW_OPTIONS)[number]["key"];

type AdminUserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function formatLabel(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDateTime(value: string, timeZone?: string): string {
  return formatDateTimeInTimeZone(value, timeZone, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPlayerDisplayName(user: AdminUserOption): string {
  const fullName = String(user.name || "").trim();
  return fullName || String(user.email || "").trim() || "Unknown";
}

function getWindowStartDate(key: DateWindowKey): string | null {
  const option = DATE_WINDOW_OPTIONS.find((item) => item.key === key);
  if (!option || option.days == null) return null;
  const next = new Date();
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() - option.days + 1);
  return next.toISOString();
}

function DistributionBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number; pct: number }>;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionCardTitle}>{title}</Text>
      <View style={styles.distributionList}>
        {items.map((item) => (
          <View key={item.label} style={styles.distributionRow}>
            <View style={styles.distributionHeader}>
              <Text style={styles.distributionLabel}>{formatLabel(item.label)}</Text>
              <Text style={styles.distributionValue}>{item.pct.toFixed(1)}% · {item.count}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(item.pct, item.count > 0 ? 4 : 0)}%`,
                    backgroundColor: LABEL_COLORS[item.label] || ds.color.success,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function DatasetInsightsScreen() {
  const insets = useSafeAreaInsets();
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { user } = useAuth();
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const profileTimeZone = resolveUserTimeZone(user);
  const isAdmin = user?.role?.trim().toLowerCase() === "admin";
  const [userList, setUserList] = React.useState<AdminUserOption[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string>("all");
  const [showPlayerDropdown, setShowPlayerDropdown] = React.useState(false);
  const [selectedDateWindow, setSelectedDateWindow] = React.useState<DateWindowKey>("90d");

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/profile");
    }
  }, [isAdmin]);

  useEffect(() => {
    let active = true;

    if (!isAdmin || !user) {
      setUserList([]);
      setSelectedPlayerId("all");
      setShowPlayerDropdown(false);
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const baseUrl = getApiUrl();
        const res = await fetch(`${baseUrl}api/users`, { credentials: "include" });
        if (!active) return;
        if (res.ok) {
          const users = await res.json();
          if (Array.isArray(users)) {
            setUserList(users);
            return;
          }
        }
      } catch {
        if (!active) return;
      }

      setUserList([
        {
          id: user.id,
          name: user.name || "",
          email: user.email || "",
          role: user.role || "player",
        },
      ]);
    })();

    return () => {
      active = false;
    };
  }, [isAdmin, user]);

  const selectedPlayerLabel = React.useMemo(() => {
    if (selectedPlayerId === "all") return "All players";
    const selected = userList.find((item) => item.id === selectedPlayerId);
    return selected ? getPlayerDisplayName(selected) : "All players";
  }, [selectedPlayerId, userList]);

  const selectedDateStart = React.useMemo(
    () => getWindowStartDate(selectedDateWindow),
    [selectedDateWindow],
  );

  const selectedDateLabel = React.useMemo(
    () => DATE_WINDOW_OPTIONS.find((item) => item.key === selectedDateWindow)?.label || "All",
    [selectedDateWindow],
  );

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["tennis-dataset-insights", selectedPlayerId, selectedDateWindow, selectedDateStart],
    queryFn: () => fetchTennisDatasetInsights({
      playerId: selectedPlayerId === "all" ? null : selectedPlayerId,
      startDate: selectedDateStart,
      endDate: null,
    }),
    enabled: isAdmin,
    retry: false,
  });

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

      <View style={[styles.header, { paddingTop: insets.top + 10 + webTopInset }]}> 
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle}>Dataset Insights</Text>
        <Pressable
          onPress={() => refetch()}
          style={styles.backButton}
          disabled={isLoading || isRefetching}
        >
          {isRefetching ? (
            <ActivityIndicator size="small" color="#F8FAFC" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#F8FAFC" />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={ds.color.success} />
        </View>
      ) : isError || !data ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorTitle}>Unable to load dataset insights</Text>
          <Text style={styles.errorText}>{error instanceof Error ? error.message : "Try again"}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.heroCard}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.versionPill}>
                <Text style={styles.versionPillText}>Model {data.currentVersion}</Text>
              </View>
              <View style={styles.livePill}>
                <Text style={styles.livePillText}>Live dataset</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Training coverage and model quality in one view</Text>
            <Text style={styles.heroText}>{data.currentVersionDescription || "Active tennis classifier snapshot"}</Text>
            <Text style={styles.heroSubText}>Scope: {selectedPlayerLabel} · {selectedDateLabel === "All" ? "All time" : `Last ${selectedDateLabel}`}</Text>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Filters</Text>
            <View style={styles.sectionCard}>
              <View style={styles.filterHeaderRow}>
                <Text style={styles.filterLabel}>Player</Text>
                <Pressable
                  onPress={() => setShowPlayerDropdown((prev) => !prev)}
                  style={styles.playerDropdown}
                >
                  <Ionicons name="people-outline" size={15} color="#38BDF8" />
                  <Text style={styles.playerDropdownText} numberOfLines={1}>{selectedPlayerLabel}</Text>
                  <Ionicons name={showPlayerDropdown ? "chevron-up" : "chevron-down"} size={14} color="#38BDF8" />
                </Pressable>
              </View>

              <View style={styles.filterHeaderRow}>
                <Text style={styles.filterLabel}>Date Range</Text>
                <View style={styles.dateChipRow}>
                  {DATE_WINDOW_OPTIONS.map((option) => {
                    const selected = option.key === selectedDateWindow;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedDateWindow(option.key);
                        }}
                        style={[
                          styles.dateChip,
                          selected && styles.dateChipSelected,
                        ]}
                      >
                        <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Current Dataset</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{data.currentDataset.eligibleVideoCount}</Text>
                <Text style={styles.statLabel}>Eligible videos</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{data.currentDataset.eligibleShotCount}</Text>
                <Text style={styles.statLabel}>Labeled shots</Text>
              </View>
            </View>
            <DistributionBlock title="Video Distribution" items={data.currentDataset.videoDistribution} />
            <DistributionBlock title="Shot Distribution" items={data.currentDataset.shotDistribution} />
            <DistributionBlock title="Session Type Distribution" items={data.currentDataset.sessionTypeDistribution} />
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Active Model</Text>
            {!data.activeModel ? (
              <View style={styles.sectionCard}>
                <Text style={styles.emptyText}>No saved training run was found for the active model version yet.</Text>
              </View>
            ) : (
              <>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{formatPercent(data.activeModel.macroF1)}</Text>
                    <Text style={styles.statLabel}>Macro F1</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{formatPercent(data.activeModel.accuracy)}</Text>
                    <Text style={styles.statLabel}>Accuracy</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{data.activeModel.datasetAnalysisCount}</Text>
                    <Text style={styles.statLabel}>Dataset videos</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{data.activeModel.datasetShotCount}</Text>
                    <Text style={styles.statLabel}>Dataset shots</Text>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionCardTitle}>Saved Run</Text>
                  <Text style={styles.metaText}>Trained {formatDateTime(data.activeModel.trainedAt, profileTimeZone)}</Text>
                  <Text style={styles.metaText}>
                    Split: {data.activeModel.trainRows} train / {data.activeModel.testRows} test
                  </Text>
                  <Text style={styles.metaHint}>Saved-run metrics below are global to the active version and do not change with player/date filters.</Text>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionCardTitle}>Per-Label Metrics</Text>
                  <View style={styles.metricsList}>
                    {data.activeModel.perLabel.map((item) => (
                      <View key={item.label} style={styles.metricRow}>
                        <View style={styles.metricLabelWrap}>
                          <View style={[styles.metricDot, { backgroundColor: LABEL_COLORS[item.label] || ds.color.success }]} />
                          <Text style={styles.metricLabel}>{formatLabel(item.label)}</Text>
                        </View>
                        <Text style={styles.metricValue}>P {formatPercent(item.precision, 0)}</Text>
                        <Text style={styles.metricValue}>R {formatPercent(item.recall, 0)}</Text>
                        <Text style={styles.metricValue}>F1 {formatPercent(item.f1, 0)}</Text>
                        <Text style={styles.metricSupport}>{item.support}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionCardTitle}>Confusion Matrix</Text>
                  <View style={styles.confusionHeaderRow}>
                    <Text style={[styles.confusionHeaderCell, styles.confusionAxisCell]}>Actual</Text>
                    {data.activeModel.confusionMatrix.labels.map((label) => (
                      <Text key={label} style={styles.confusionHeaderCell}>{formatLabel(label)}</Text>
                    ))}
                  </View>
                  {data.activeModel.confusionMatrix.rows.map((row) => (
                    <View key={row.actual} style={styles.confusionRow}>
                      <Text style={[styles.confusionHeaderCell, styles.confusionAxisCell]}>{formatLabel(row.actual)}</Text>
                      {row.counts.map((cell) => (
                        <View
                          key={`${row.actual}-${cell.predicted}`}
                          style={[
                            styles.confusionCell,
                            {
                              backgroundColor: cell.count > 0 ? `${LABEL_COLORS[cell.predicted] || "#38BDF8"}22` : "#0E1022",
                              borderColor: cell.count > 0 ? `${LABEL_COLORS[cell.predicted] || "#38BDF8"}44` : "#1E293B",
                            },
                          ]}
                        >
                          <Text style={styles.confusionCellCount}>{cell.count}</Text>
                          <Text style={styles.confusionCellPct}>{cell.pct.toFixed(0)}%</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Version Trend</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.metaHint}>Saved versions across retrains, ordered oldest to newest.</Text>
              <View style={styles.trendList}>
                {data.modelTrend.map((entry) => (
                  <View key={`${entry.modelVersion}-${entry.trainedAt}`} style={styles.trendRow}>
                    <View style={styles.trendHeaderRow}>
                      <View style={styles.trendVersionWrap}>
                        <Text style={styles.trendVersionText}>v{entry.modelVersion}</Text>
                        {entry.isActiveModelVersion ? (
                          <View style={styles.trendActiveBadge}>
                            <Text style={styles.trendActiveBadgeText}>Active</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.trendMetricText}>{formatPercent(entry.macroF1)}</Text>
                    </View>
                    <View style={styles.trendBarTrack}>
                      <View
                        style={[
                          styles.trendBarFill,
                          { width: `${Math.max(4, Math.min(100, Number(entry.macroF1 || 0) * 100))}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.trendMetaText}>
                      {formatDateTime(entry.savedAt || entry.trainedAt, profileTimeZone)} · Accuracy {formatPercent(entry.accuracy)} · {entry.trainRows}/{entry.testRows}
                    </Text>
                    {entry.versionDescription ? (
                      <Text style={styles.trendMetaSubText}>{entry.versionDescription}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Suggestions</Text>
            <View style={styles.sectionCard}>
              {data.suggestions.map((item, index) => (
                <View key={`${index}-${item}`} style={styles.suggestionRow}>
                  <Ionicons name="sparkles-outline" size={16} color="#FBBF24" />
                  <Text style={styles.suggestionText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {isAdmin && showPlayerDropdown ? (
        <Modal
          transparent
          animationType="none"
          onRequestClose={() => setShowPlayerDropdown(false)}
        >
          <Pressable style={styles.playerDropdownOverlay} onPress={() => setShowPlayerDropdown(false)}>
            <Pressable style={styles.playerDropdownMenu} onPress={() => {}}>
              <Pressable
                onPress={() => {
                  setSelectedPlayerId("all");
                  setShowPlayerDropdown(false);
                }}
                style={[
                  styles.playerDropdownItem,
                  selectedPlayerId === "all" && styles.playerDropdownItemSelected,
                ]}
              >
                <Text style={styles.playerDropdownItemText}>All players</Text>
                {selectedPlayerId === "all" ? <Ionicons name="checkmark" size={15} color="#38BDF8" /> : null}
              </Pressable>
              {userList.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    setSelectedPlayerId(option.id);
                    setShowPlayerDropdown(false);
                  }}
                  style={[
                    styles.playerDropdownItem,
                    option.id === selectedPlayerId && styles.playerDropdownItemSelected,
                  ]}
                >
                  <Text style={styles.playerDropdownItemText}>{getPlayerDisplayName(option)}</Text>
                  {option.id === selectedPlayerId ? <Ionicons name="checkmark" size={15} color="#38BDF8" /> : null}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(10,10,26,0.94)",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A36",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A36",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    textAlign: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 18,
  },
  heroCard: {
    gap: 8,
    backgroundColor: "#131328",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A50",
    padding: 16,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  versionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#34D39966",
    backgroundColor: "#34D3991A",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  versionPillText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  livePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#38BDF866",
    backgroundColor: "#082F491A",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  livePillText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#38BDF8",
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  heroSubText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: "#131328",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A50",
    padding: 14,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  sectionCard: {
    gap: 10,
    backgroundColor: "#131328",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A50",
    padding: 14,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  filterHeaderRow: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: ds.color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  playerDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#38BDF855",
    backgroundColor: "#082F491A",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  playerDropdownText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#38BDF8",
  },
  dateChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#0E1022",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateChipSelected: {
    borderColor: "#34D39966",
    backgroundColor: "#052E1A",
  },
  dateChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  dateChipTextSelected: {
    color: "#34D399",
  },
  distributionList: {
    gap: 10,
  },
  distributionRow: {
    gap: 6,
  },
  distributionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  distributionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  distributionValue: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  barTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: "#0E1022",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: ds.color.textSecondary,
  },
  metaHint: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  metricsList: {
    gap: 8,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    borderRadius: 12,
    backgroundColor: "#0E1022",
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metricLabelWrap: {
    minWidth: 110,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  metricValue: {
    minWidth: 58,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  metricSupport: {
    marginLeft: "auto",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textTertiary,
  },
  confusionHeaderRow: {
    flexDirection: "row",
    gap: 6,
  },
  confusionRow: {
    flexDirection: "row",
    gap: 6,
  },
  confusionHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textTertiary,
    textAlign: "center",
  },
  confusionAxisCell: {
    flex: 1.2,
    textAlign: "left",
  },
  confusionCell: {
    flex: 1,
    minHeight: 54,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
  },
  confusionCellCount: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  confusionCellPct: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: ds.color.textSecondary,
  },
  trendList: {
    gap: 12,
  },
  trendRow: {
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#0E1022",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  trendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  trendVersionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendVersionText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  trendMetricText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  trendBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#131328",
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#34D399",
  },
  trendMetaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  trendMetaSubText: {
    fontSize: 11,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  trendActiveBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#166534",
    backgroundColor: "#052E1A",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trendActiveBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  playerDropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  playerDropdownMenu: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#131328",
    overflow: "hidden",
  },
  playerDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  playerDropdownItemSelected: {
    backgroundColor: "#082F491A",
  },
  playerDropdownItemText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: ds.color.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
});