import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  Polyline,
  Stop,
} from "react-native-svg";
import { sportColors } from "@/constants/colors";
import {
  fetchAnalysesSummary,
  fetchDiscrepancySummary,
  fetchScoringModelDashboard,
  fetchScoringModelRegistry,
  saveScoringModelRegistrySnapshot,
} from "@/lib/api";
import type { AnalysisSummary } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTimeInTimeZone, formatMonthDayInTimeZone, parseApiDate, resolveUserTimeZone } from "@/lib/timezone";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";
import { ds } from "@/constants/design-system";

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

function formatDateTime(value: string, timeZone?: string): string {
  return formatDateTimeInTimeZone(value, timeZone, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMismatchPalette(rate: number): { bg: string; border: string; text: string } {
  if (rate < 10) {
    return { bg: "#052E1A", border: "#166534", text: ds.color.success };
  }
  if (rate <= 25) {
    return { bg: "#3F2A07", border: "#92400E", text: ds.color.warning };
  }
  return { bg: "#3F1114", border: "#7F1D1D", text: ds.color.danger };
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

function getGreetingFirstName(name?: string | null): string {
  const fullName = String(name || "").trim();
  if (fullName) {
    return fullName.split(/\s+/)[0];
  }

  return "Player";
}

const PLAYER_METRICS = [
  { key: "technical", label: "Technical", icon: "construct", color: "#60A5FA" },
  { key: "tactical", label: "Tactical", icon: "analytics", color: "#A78BFA" },
  { key: "movement", label: "Movement", icon: "body", color: ds.color.success },
] as const;

const PLAYER_TREND_FILTERS = [
  { key: "overall", label: "Overall", icon: "stats-chart", color: ds.color.accent },
  ...PLAYER_METRICS,
] as const;

const PLAN_DURATIONS = [10, 20, 30] as const;
type PlanDuration = (typeof PLAN_DURATIONS)[number];
const TREND_SESSION_FILTERS = [
  { key: 5, label: "5S" },
  { key: 10, label: "10S" },
  { key: 25, label: "25S" },
  { key: "all", label: "All" },
] as const;
type TrendSessionWindow = (typeof TREND_SESSION_FILTERS)[number]["key"];

function getImprovementDrill(
  metricKey: string,
  sportName?: string,
  movementName?: string,
): string {
  if (metricKey === "technical") {
    return "3 x 12 technical checkpoints with finish hold";
  }

  if (metricKey === "tactical") {
    return "4 x 30s decision-and-recovery pattern reps";
  }

  if (metricKey === "movement") {
    return "3 x 20s footwork, balance, and reposition drills";
  }

  const sport = String(sportName || "").toLowerCase();
  const movement = String(movementName || "").toLowerCase();

  if (sport.includes("tennis")) {
    if (movement.includes("serve")) {
      if (metricKey === "timing") return "3 x 12 toss-to-contact sequencing reps";
      if (metricKey === "control") return "4 x 20s balanced trophy-stance holds";
      if (metricKey === "technique") return "3 x 12 technical shadow serves with finish hold";
      return "3 x 10 medicine-ball style overhead drive motions";
    }
    if (movement.includes("backhand")) {
      if (metricKey === "timing") return "3 x 15 backhand contact-point marker reps";
      if (metricKey === "control") return "4 x 30s split-step plus crossover recovery";
      if (metricKey === "technique") return "3 x 12 backhand shape-and-finish repetitions";
      return "3 x 12 loaded backhand acceleration swings";
    }
    if (movement.includes("forehand")) {
      if (metricKey === "timing") return "3 x 15 forehand early-prep to contact reps";
      if (metricKey === "control") return "4 x 30s open-stance recovery footwork";
      if (metricKey === "technique") return "3 x 12 forehand shape-and-finish repetitions";
      return "3 x 12 forehand kinetic-chain acceleration reps";
    }

    if (metricKey === "timing") return "3 x 15 unit-turn to contact timing reps";
    if (metricKey === "control") return "4 x 30s split-step and recovery drill";
    if (metricKey === "technique") return "3 x 12 swing-path and finish checkpoints";
    return "3 x 12 explosive shadow swings";
  }

  if (sport.includes("golf")) {
    if (metricKey === "timing") return "3 x 10 takeaway-to-impact tempo reps";
    if (metricKey === "control") return "4 x 20s single-leg balance with club set-up";
    if (metricKey === "technique") return "3 x 10 setup-posture and impact-position checkpoints";
    return "3 x 10 resisted hip-turn power reps";
  }

  if (sport.includes("badminton")) {
    if (metricKey === "timing") return "3 x 15 split-step to shuttle contact reps";
    if (metricKey === "control") return "4 x 25s lunge-recover footwork";
    if (metricKey === "technique") return "3 x 12 racket-path and contact-height checkpoints";
    return "3 x 12 jump-smash loading motions";
  }

  if (metricKey === "timing") return "3 x 15 contact timing reps";
  if (metricKey === "control") return "4 x 30s balance and recovery drill";
  if (metricKey === "technique") return "3 x 12 movement-shape and finish checkpoints";
  return "3 x 12 explosive movement reps";
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToTenths(value: number): number {
  return Math.round(value * 10) / 10;
}

function computeDisplayDelta(
  current: number | null,
  previous: number | null,
): number | null {
  if (current == null || previous == null) return null;
  if (Math.abs(previous) < 1e-6) return null;
  const delta = Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
  return delta === 0 ? null : delta;
}

function stdDeviation(values: number[]): number | null {
  if (!values.length) return null;
  const avg = average(values);
  if (avg === null) return null;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function getPlayerMetricValue(item: AnalysisSummary | undefined, metricKey: string): number | null {
  if (!item) return null;
  if (metricKey === "technical" || metricKey === "tactical" || metricKey === "movement") {
    const sectionScore = Number(item.sectionScores?.[metricKey]);
    return Number.isFinite(sectionScore) ? sectionScore : null;
  }

  const subs = item.subScores;
  if (!subs) return null;
  for (const key of Object.keys(subs)) {
    if (key.toLowerCase() === metricKey.toLowerCase()) {
      return Number(subs[key]);
    }
  }

  return null;
}

function getMovementFromAnalysis(item: AnalysisSummary): string {
  if (item.detectedMovement) return formatLabel(String(item.detectedMovement));
  const config = String(item.configKey || "").trim();
  if (!config) return "General";
  const parts = config.split("-").filter(Boolean);
  if (parts.length <= 1) return "General";
  return formatLabel(parts.slice(1).join("-"));
}

function getMovementTarget(metricKey: string): number {
  if (metricKey === "technical") return 8.2;
  if (metricKey === "tactical") return 8.0;
  if (metricKey === "movement") return 8.1;
  if (metricKey === "timing") return 82;
  if (metricKey === "control") return 80;
  if (metricKey === "technique") return 81;
  return 78;
}

function scaleDrillForDuration(baseDrill: string, minutes: PlanDuration): string {
  if (minutes === 20) return baseDrill;

  if (minutes === 10) {
    if (baseDrill.startsWith("4 x ")) return baseDrill.replace("4 x ", "3 x ");
    if (baseDrill.startsWith("3 x ")) return baseDrill.replace("3 x ", "2 x ");
    if (baseDrill.startsWith("3 rounds of ")) {
      return baseDrill.replace("3 rounds of ", "2 rounds of ");
    }
    return `Quick block: ${baseDrill}`;
  }

  if (baseDrill.startsWith("4 x ")) return baseDrill.replace("4 x ", "5 x ");
  if (baseDrill.startsWith("3 x ")) return baseDrill.replace("3 x ", "4 x ");
  if (baseDrill.startsWith("3 rounds of ")) {
    return baseDrill.replace("3 rounds of ", "4 rounds of ");
  }
  return `Extended block: ${baseDrill}`;
}

function getExpectedGain(metricKey: string, minutes: PlanDuration): number {
  if (metricKey === "technical" || metricKey === "tactical" || metricKey === "movement") {
    const baseGain = metricKey === "movement" ? 0.5 : 0.4;
    const multiplier = minutes === 10 ? 0.75 : minutes === 30 ? 1.35 : 1;
    return Number(Math.max(0.2, baseGain * multiplier).toFixed(1));
  }

  const baseGain =
    metricKey === "timing"
        ? 4
        : metricKey === "control"
          ? 3
          : 3;

  const multiplier = minutes === 10 ? 0.7 : minutes === 30 ? 1.4 : 1;
  return Math.max(1, Math.round(baseGain * multiplier));
}

function formatScoreDelta(delta: number | null): string {
  if (delta === null) return "No prior session";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function formatMetricDelta(delta: number | null): string | null {
  if (delta === null) return null;
  return `${Math.abs(delta).toFixed(1)}%`;
}

function metricDeltaIcon(delta: number | null): "caret-up" | "caret-down" | "remove" {
  if (delta === null || Math.abs(delta) < 1e-6) return "remove";
  return delta > 0 ? "caret-up" : "caret-down";
}

function getDeltaColor(delta: number | null): string {
  if (delta === null) return ds.color.textTertiary;
  if (Math.abs(delta) < 1e-6) return "#94A3B8";
  if (delta >= 0) return ds.color.success;
  return ds.color.danger;
}

function deltaTrendIcon(delta: number | null): "trending-up" | "trending-down" | "remove" {
  if (delta === null || Math.abs(delta) < 1e-6) return "remove";
  return delta > 0 ? "trending-up" : "trending-down";
}

function PlayerMetricTrendChart({
  labels,
  series,
  activeKey,
}: {
  labels: string[];
  series: Array<{
    key: string;
    label: string;
    color: string;
    values: Array<number | null>;
    displayValues?: Array<number | null>;
  }>;
  activeKey: string;
}) {
  if (!labels.length) return null;

  const activeSeries = series.find((item) => item.key === activeKey) || series[0];
  if (!activeSeries) return null;

  const contextSeries = series.filter((item) => item.key !== activeSeries.key);

  const chartWidth = 320;
  const chartHeight = 136;
  const leftPadding = 12;
  const rightPadding = 8;
  const topPadding = 10;
  const bottomPadding = 22;
  const innerWidth = chartWidth - leftPadding - rightPadding;
  const innerHeight = chartHeight - topPadding - bottomPadding;
  const stepX = labels.length > 1 ? innerWidth / (labels.length - 1) : innerWidth;

  const toX = (index: number) => leftPadding + stepX * index;
  const toY = (value: number) => topPadding + (1 - value / 100) * innerHeight;

  const toPoints = (values: Array<number | null>) =>
    values
      .map((value, index) => {
        if (value === null) return null;
        return {
          x: toX(index),
          y: toY(Math.max(0, Math.min(100, value))),
          value,
          index,
        };
      })
      .filter((point): point is { x: number; y: number; value: number; index: number } => point !== null);

  const activePoints = toPoints(activeSeries.values);
  if (!activePoints.length) return null;

  const latestPoint = activePoints[activePoints.length - 1];
  const prevPoint = activePoints.length > 1 ? activePoints[activePoints.length - 2] : null;
  const latestDelta = prevPoint ? computeDisplayDelta(latestPoint.value, prevPoint.value) : null;
  const latestDisplayValue = activeSeries.displayValues?.[latestPoint.index] ?? latestPoint.value;
  const formattedLatestValue =
    activeSeries.key === "overall"
      ? String(roundScore(Number(latestDisplayValue)))
      : Number(latestDisplayValue).toFixed(1);

  const activePolylinePoints = activePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = [
    `M ${activePoints[0].x} ${innerHeight + topPadding}`,
    ...activePoints.map((point) => `L ${point.x} ${point.y}`),
    `L ${activePoints[activePoints.length - 1].x} ${innerHeight + topPadding}`,
    "Z",
  ].join(" ");

  const shouldShowLabel = (index: number): boolean => {
    if (labels.length <= 7) return true;
    if (labels.length <= 15) return index === 0 || index === labels.length - 1 || index % 2 === 0;
    return index === 0 || index === labels.length - 1 || index % 4 === 0;
  };

  return (
    <View>
      <View style={styles.playerTrendTopRow}>
        <View style={styles.playerTrendMetricPill}>
          <View
            style={[
              styles.playerTrendMetricDot,
              { backgroundColor: activeSeries.color },
            ]}
          />
          <Text style={styles.playerTrendMetricLabel}>{activeSeries.label}</Text>
        </View>
        <Text style={[styles.playerTrendMetricValue, { color: activeSeries.color }]}>
          {formattedLatestValue}
          {latestDelta !== null ? ` (${latestDelta >= 0 ? "+" : ""}${latestDelta}%)` : ""}
        </Text>
      </View>

      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient id="activeAreaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={activeSeries.color} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={activeSeries.color} stopOpacity={0.03} />
          </SvgLinearGradient>
        </Defs>

        {[25, 50, 75].map((value) => {
          const y = toY(value);
          return (
            <Line
              key={`grid-${value}`}
              x1={leftPadding}
              y1={y}
              x2={chartWidth - rightPadding}
              y2={y}
              stroke="#33415544"
              strokeWidth={1}
            />
          );
        })}

        {contextSeries.map((line) => {
          const points = toPoints(line.values).map((point) => `${point.x},${point.y}`);
          return (
            <Polyline
              key={`context-${line.key}`}
              points={points.join(" ")}
              fill="none"
              stroke={line.color}
              strokeOpacity={0.18}
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        <Path d={areaPath} fill="url(#activeAreaFill)" />

        <Polyline
          points={activePolylinePoints}
          fill="none"
          stroke={activeSeries.color}
          strokeOpacity={0.2}
          strokeWidth={8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <Polyline
          points={activePolylinePoints}
          fill="none"
          stroke={activeSeries.color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <Line
          x1={latestPoint.x}
          y1={topPadding}
          x2={latestPoint.x}
          y2={innerHeight + topPadding}
          stroke={activeSeries.color}
          strokeOpacity={0.28}
          strokeWidth={1}
        />

        {activePoints.map((point, index) => {
          const isLatest = index === activePoints.length - 1;
          return (
            <Circle
              key={`active-dot-${point.index}`}
              cx={point.x}
              cy={point.y}
              r={isLatest ? 4.2 : 2.4}
              fill={isLatest ? "#F8FAFC" : activeSeries.color}
              stroke={activeSeries.color}
              strokeWidth={isLatest ? 2 : 0}
            />
          );
        })}
      </Svg>

      <View style={styles.playerTrendLabelsRow}>
        {labels.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={[
              styles.playerTrendAxisLabel,
              index === 0 ? { textAlign: "left" as const } : undefined,
              index === labels.length - 1 ? { textAlign: "right" as const } : undefined,
            ]}
            numberOfLines={1}
          >
            {shouldShowLabel(index) ? label : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ModelRegistryTrendLineChart({
  points,
}: {
  points: Array<{
    modelVersion: string;
    mismatchRatePct: number;
    movementDetectionAccuracyPct: number;
    scoringAccuracyPct: number;
  }>;
}) {
  if (!points.length) return null;

  const chartWidth = 320;
  const chartHeight = 170;
  const leftPadding = 14;
  const rightPadding = 10;
  const topPadding = 14;
  const bottomPadding = 30;
  const innerWidth = chartWidth - leftPadding - rightPadding;
  const innerHeight = chartHeight - topPadding - bottomPadding;
  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth;

  const toX = (index: number) => leftPadding + stepX * index;
  const toY = (value: number) => topPadding + (1 - Math.max(0, Math.min(100, value)) / 100) * innerHeight;

  const toPolyline = (values: number[]) =>
    values.map((value, index) => `${toX(index)},${toY(value)}`).join(" ");

  const mismatch = points.map((point) => Number(point.mismatchRatePct || 0));
  const mismatchPolyline = toPolyline(mismatch);
  const areaPoints = `${leftPadding},${toY(0)} ${mismatchPolyline} ${chartWidth - rightPadding},${toY(0)}`;
  const latestMismatch = mismatch[mismatch.length - 1] ?? 0;

  return (
    <View>
      <View style={styles.registryTrendLegendRow}>
        <View style={styles.registryLegendItem}>
          <View style={[styles.registryLegendDot, { backgroundColor: ds.color.danger }]} />
          <Text style={styles.registryLegendText}>Mismatch</Text>
        </View>
        <Text style={[styles.registryTrendValueText, { color: ds.color.danger }]}>
          Latest {latestMismatch.toFixed(1)}%
        </Text>
      </View>

      <Svg width={chartWidth} height={chartHeight}>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = toY(tick);
          return (
            <Line
              key={`registry-grid-${tick}`}
              x1={leftPadding}
              y1={y}
              x2={chartWidth - rightPadding}
              y2={y}
              stroke="#33415555"
              strokeWidth={1}
            />
          );
        })}

        <Polygon points={areaPoints} fill={`${ds.color.danger}22`} />

        <Polyline
          points={mismatchPolyline}
          fill="none"
          stroke={ds.color.danger}
          strokeWidth={2.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point, index) => (
          <Circle
            key={`mismatch-dot-${point.modelVersion}`}
            cx={toX(index)}
            cy={toY(mismatch[index])}
            r={index === points.length - 1 ? 4 : 2.5}
            fill={index === points.length - 1 ? ds.color.textPrimary : ds.color.danger}
            stroke={ds.color.danger}
            strokeWidth={index === points.length - 1 ? 2 : 0}
          />
        ))}
      </Svg>

      <View style={styles.registryXAxisLabels}>
        {points.map((point) => (
          <Text key={`version-${point.modelVersion}`} style={styles.registryXAxisLabel} numberOfLines={1}>
            {point.modelVersion}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const profileTimeZone = resolveUserTimeZone(user);
  const { selectedSport, selectedMovement } = useSport();
  const isAdmin = user?.role === "admin";
  const greetingFirstName = getGreetingFirstName(user?.name);
  const [selectedTrendMetric, setSelectedTrendMetric] = React.useState<string>(PLAYER_TREND_FILTERS[0].key);
  const [selectedTrendSessions, setSelectedTrendSessions] = React.useState<TrendSessionWindow>(10);
  const [selectedPlanMinutes, setSelectedPlanMinutes] = React.useState<PlanDuration>(20);
  const [showAllRegistryEntries, setShowAllRegistryEntries] = React.useState(false);
  const [userList, setUserList] = React.useState<Array<{id:string,name:string,email:string,role:string}>>([]);
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string>("all");
  const [showPlayerDropdown, setShowPlayerDropdown] = React.useState(false);
  const [registrySaveToast, setRegistrySaveToast] = React.useState<{
    visible: boolean;
    message: string;
    tone: "info" | "success" | "error";
  }>({ visible: false, message: "", tone: "info" });
  const registryToastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (registryToastTimerRef.current) {
        clearTimeout(registryToastTimerRef.current);
      }
    };
  }, []);

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
    enabled: !!user && isAdmin,
    retry: false,
  });

  const {
    data: scoringModel,
    isLoading: scoringModelLoading,
    refetch: refetchScoringModelDashboard,
  } = useQuery({
    queryKey: [
      "scoring-model-dashboard",
      selectedSport?.name || "all",
      selectedMovement?.name || "auto-detect",
      isAdmin ? selectedPlayerId : user?.id || "self",
    ],
    queryFn: () =>
      fetchScoringModelDashboard(
        selectedMovement?.name,
        isAdmin ? selectedPlayerId : user?.id,
      ),
    enabled: !!user && isAdmin,
    retry: false,
  });

  const {
    data: scoringModelRegistry,
    isLoading: scoringModelRegistryLoading,
    isError: scoringModelRegistryIsError,
    refetch: refetchScoringModelRegistry,
    isRefetching: scoringModelRegistryRefetching,
  } = useQuery({
    queryKey: ["scoring-model-registry"],
    queryFn: fetchScoringModelRegistry,
    enabled: !!user && isAdmin,
    retry: false,
  });

  const scoringModelRegistryTrend = React.useMemo(() => {
    const source = scoringModelRegistry || [];
    const bucket = new Map<string, { md: number; sc: number; mismatch: number; count: number }>();
    for (const entry of source) {
      const key = entry.modelVersion;
      const current = bucket.get(key) || { md: 0, sc: 0, mismatch: 0, count: 0 };
      current.md += Number(entry.movementDetectionAccuracyPct || 0);
      current.sc += Number(entry.scoringAccuracyPct || 0);
      current.mismatch += Number(entry.mismatchRatePct || 0);
      current.count += 1;
      bucket.set(key, current);
    }

    return Array.from(bucket.entries())
      .map(([modelVersion, values]) => ({
        modelVersion,
        movementDetectionAccuracyPct: values.count ? Number((values.md / values.count).toFixed(1)) : 0,
        scoringAccuracyPct: values.count ? Number((values.sc / values.count).toFixed(1)) : 0,
        mismatchRatePct: values.count ? Number((values.mismatch / values.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.modelVersion.localeCompare(b.modelVersion, undefined, { numeric: true }));
  }, [scoringModelRegistry]);

  const saveRegistryMutation = useMutation({
    onMutate: () => {
      if (registryToastTimerRef.current) {
        clearTimeout(registryToastTimerRef.current);
      }
      setRegistrySaveToast({ visible: true, message: "Saving...", tone: "info" });
    },
    mutationFn: () =>
      saveScoringModelRegistrySnapshot(
        selectedMovement?.name,
        isAdmin ? selectedPlayerId : user?.id,
      ),
    onSuccess: async () => {
      await Promise.all([
        refetchScoringModelDashboard(),
        refetchScoringModelRegistry(),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRegistrySaveToast({ visible: true, message: "Saved", tone: "success" });
      registryToastTimerRef.current = setTimeout(() => {
        setRegistrySaveToast((prev) => ({ ...prev, visible: false }));
      }, 1600);
    },
    onError: (error: Error) => {
      setRegistrySaveToast({
        visible: true,
        message: error.message || "Failed to save",
        tone: "error",
      });
      registryToastTimerRef.current = setTimeout(() => {
        setRegistrySaveToast((prev) => ({ ...prev, visible: false }));
      }, 2200);
    },
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

  const playerDashboard = React.useMemo(() => {
    const scoredAnalyses = filteredAnalyses
      .map((analysis) => {
        const score = typeof analysis.overallScore === "number" ? analysis.overallScore : null;
        const timestamp = parseApiDate(analysis.capturedAt || analysis.createdAt)?.getTime() || 0;
        return {
          analysis,
          score,
          timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
        };
      })
      .filter((entry) => entry.score !== null)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (!scoredAnalyses.length) return null;

    const latestScore = Number(scoredAnalyses[0].score);
    const previousScore = scoredAnalyses.length > 1 ? Number(scoredAnalyses[1].score) : null;
    const overallDelta = computeDisplayDelta(latestScore, previousScore);

    const metricCards = PLAYER_METRICS.map((metric) => {
      const latestMetricScore = getPlayerMetricValue(scoredAnalyses[0].analysis, metric.key);
      const previousMetricScore =
        scoredAnalyses.length > 1
          ? getPlayerMetricValue(scoredAnalyses[1].analysis, metric.key)
          : null;
      const delta = computeDisplayDelta(latestMetricScore, previousMetricScore);

      return {
        ...metric,
        score: latestMetricScore !== null ? Number(latestMetricScore.toFixed(1)) : null,
        delta,
      };
    });

    const trendSliceCount = selectedTrendSessions === "all" ? scoredAnalyses.length : selectedTrendSessions;
    const trendEntries = scoredAnalyses
      .slice(0, trendSliceCount)
      .reverse();

    const trendPoints = trendEntries
      .slice(0, trendSliceCount)
      .map((entry) => {
        const dateLabel = formatMonthDayInTimeZone(
          entry.analysis.capturedAt || entry.analysis.createdAt,
          profileTimeZone,
        );
        return {
          label: dateLabel,
          score: roundScore(Number(entry.score)),
        };
      });

    const metricTrendSeries = PLAYER_TREND_FILTERS.map((metric) => ({
      key: metric.key,
      label: metric.label,
      color: metric.color,
      values: trendEntries.map((entry) => {
        if (metric.key === "overall") {
          return roundScore(Number(entry.score));
        }
        const value = getPlayerMetricValue(entry.analysis, metric.key);
        return value === null ? null : Number((value * 10).toFixed(1));
      }),
      displayValues: trendEntries.map((entry) => {
        if (metric.key === "overall") {
          return roundScore(Number(entry.score));
        }
        const value = getPlayerMetricValue(entry.analysis, metric.key);
        return value === null ? null : Number(value.toFixed(1));
      }),
    }));

    const movementBuckets = new Map<string, number[]>();
    for (const entry of scoredAnalyses) {
      const movement = getMovementFromAnalysis(entry.analysis);
      const values = movementBuckets.get(movement) || [];
      values.push(Number(entry.score));
      movementBuckets.set(movement, values);
    }

    const movementCards = Array.from(movementBuckets.entries())
      .map(([movement, scores]) => {
        const recent = average(scores.slice(0, 2));
        const previous = average(scores.slice(2, 4));
        const delta = computeDisplayDelta(recent, previous);
        return {
          movement,
          score: roundScore(average(scores) || 0),
          delta,
          sessions: scores.length,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const focusAreas = metricCards
      .filter((metric) => metric.score !== null)
      .sort((a, b) => Number(a.score) - Number(b.score))
      .slice(0, 2)
      .map((metric) => {
        const current = Number(metric.score || 0);
        const target = getMovementTarget(metric.key);
        return {
          key: metric.key,
          label: metric.label,
          current,
          target,
          drill: scaleDrillForDuration(
            getImprovementDrill(metric.key, selectedSport?.name, selectedMovement?.name) ||
              "Focused technical reps",
            selectedPlanMinutes,
          ),
          expectedGain: getExpectedGain(metric.key, selectedPlanMinutes),
        };
      });

    return {
      latestScore: roundScore(Number(scoredAnalyses[0].score)),
      scoreCount: scoredAnalyses.length,
      overallDelta,
      metricCards,
      trendPoints,
      metricTrendSeries,
      movementCards,
      focusAreas,
    };
  }, [
    filteredAnalyses,
    selectedSport?.name,
    selectedMovement?.name,
    selectedPlanMinutes,
    selectedTrendSessions,
  ]);

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
            refreshing={isRefetching || discrepancyRefetching || scoringModelRegistryRefetching}
            onRefresh={() => {
              refetch();
              if (isAdmin) {
                refetchDiscrepancy();
                refetchScoringModelRegistry();
              }
            }}
            tintColor="#6C5CE7"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{`Hi ${greetingFirstName},`}</Text>
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
            animationType="none"
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
            {isAdmin && (discrepancyLoading || discrepancyIsError || !!discrepancy) && (
              <View style={styles.discrepancyCard}>
                <View style={styles.discrepancyHeader}>
                  <Text style={styles.discrepancyTitle}>
                    Model {scoringModel?.modelVersion ? scoringModel.modelVersion : ""}
                  </Text>
                  {!discrepancyLoading && !discrepancyIsError && discrepancy && (() => {
                    const palette = getMismatchPalette(discrepancy.summary.mismatchRatePct);
                    return (
                      <View
                        style={[
                          styles.discrepancyRateBadge,
                          { backgroundColor: palette.bg, borderColor: palette.border },
                        ]}
                      >
                        <Text style={[styles.discrepancyRateText, { color: palette.text }]}>
                          Mismatch {discrepancy.summary.mismatchRatePct.toFixed(1)}%
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                {!scoringModelLoading && scoringModel && String(selectedMovement?.name || scoringModel.movementType || "")
                  .trim()
                  .toLowerCase() !== "all" ? (
                  <View style={styles.modelMetaCard}>
                    <Text style={styles.modelMetaText}>
                      Movement: {formatMovementBadgeLabel(selectedMovement?.name || scoringModel.movementType)}
                    </Text>
                  </View>
                ) : null}

                {isAdmin && scoringModel?.modelEvaluationMode ? (
                  <Pressable
                    onPress={() => saveRegistryMutation.mutate()}
                    disabled={saveRegistryMutation.isPending}
                    style={({ pressed }) => [
                      styles.scoringSaveButton,
                      { borderColor: `${sc.primary}55` },
                      {
                        opacity: pressed || saveRegistryMutation.isPending ? 0.6 : 1,
                      },
                    ]}
                  >
                    {saveRegistryMutation.isPending ? (
                      <ActivityIndicator size="small" color={sc.primary} />
                    ) : (
                      <Ionicons name="save-outline" size={16} color={sc.primary} />
                    )}
                    <Text style={[styles.scoringSaveText, { color: sc.primary }]}>Save To Scoring Model Registry</Text>
                  </Pressable>
                ) : null}

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
                    <View style={styles.discrepancyList}>
                      {discrepancy.topVideos.filter((item) => item.mismatches > 0).map((item) => (
                        <Pressable
                          key={item.analysisId}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push({
                              pathname: "/analysis/[id]",
                              params: { id: item.analysisId },
                            });
                          }}
                          style={({ pressed }) => [styles.discrepancyRow, { opacity: pressed ? 0.82 : 1 }]}
                        >
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
                              {formatDateTime(item.createdAt, profileTimeZone)}
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
                          </View>
                        </Pressable>
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

            {isAdmin && (
              <View style={styles.registryCard}>
                <Text style={styles.registryTitle}>Model History</Text>
                {scoringModelRegistryLoading && (
                  <Text style={styles.discrepancyStateText}>Loading registry snapshots…</Text>
                )}

                {scoringModelRegistryIsError && (
                  <Text style={styles.discrepancyStateText}>Failed to load registry snapshots. Pull to refresh.</Text>
                )}

                {!scoringModelRegistryLoading && !scoringModelRegistryIsError && (scoringModelRegistry || []).length === 0 && (
                  <Text style={styles.discrepancyStateText}>No registry snapshots saved yet.</Text>
                )}

                {scoringModelRegistryTrend.length > 0 && (
                  <View style={styles.registryTrendCard}>
                    <Text style={styles.registryTrendTitle}>Version Trend</Text>
                    <ModelRegistryTrendLineChart points={scoringModelRegistryTrend} />
                  </View>
                )}

                {(showAllRegistryEntries ? (scoringModelRegistry || []) : (scoringModelRegistry || []).slice(0, 5)).map((entry) => (
                  <Pressable
                    key={entry.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({ pathname: "/model-version/[id]", params: { id: entry.id } });
                    }}
                    style={({ pressed }) => [styles.registryEntryCard, { opacity: pressed ? 0.78 : 1 }]}
                  >
                    <View style={styles.registryEntryHeader}>
                      <Text style={styles.registryEntryVersionText}>Model {entry.modelVersion}</Text>
                      {(() => {
                        const palette = getMismatchPalette(Number(entry.mismatchRatePct || 0));
                        return (
                          <View
                            style={[
                              styles.discrepancyRateBadge,
                              { backgroundColor: palette.bg, borderColor: palette.border },
                            ]}
                          >
                            <Text style={[styles.discrepancyRateText, { color: palette.text }]}> 
                              Mismatch {Number(entry.mismatchRatePct || 0).toFixed(1)}%
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    <Text style={styles.registryEntryDateText}>{formatDateTime(entry.createdAt, profileTimeZone)}</Text>
                    {String(entry.movementType || "").trim().toLowerCase() !== "all" ? (
                      <Text style={styles.registryEntryMetaText}>Movement: {entry.movementType}</Text>
                    ) : null}
                  </Pressable>
                ))}

                {!showAllRegistryEntries && (scoringModelRegistry || []).length > 5 ? (
                  <Pressable
                    onPress={() => setShowAllRegistryEntries(true)}
                    style={({ pressed }) => [styles.registryMoreButton, { opacity: pressed ? 0.78 : 1 }]}
                  >
                    <Text style={styles.registryMoreText}>.. More ..</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {!isAdmin && playerDashboard && (
              <>
                <LinearGradient
                  colors={["#121B3A", "#14243B", "#121A34"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playerHeroCard}
                >
                  <Text style={styles.playerHeroLabel}>Overall performance</Text>
                  <View style={styles.playerHeroTopRow}>
                    {playerDashboard.overallDelta !== null ? (
                      <View style={styles.playerHeroDeltaWrap}>
                        <Ionicons
                          name={metricDeltaIcon(playerDashboard.overallDelta)}
                          size={12}
                          color={getDeltaColor(playerDashboard.overallDelta)}
                        />
                        <Text
                          style={[
                            styles.playerHeroDelta,
                            { color: getDeltaColor(playerDashboard.overallDelta) },
                          ]}
                        >
                          {formatMetricDelta(playerDashboard.overallDelta)}
                        </Text>
                      </View>
                    ) : (
                      <View />
                    )}
                    <Text style={styles.playerHeroScore}>{playerDashboard.latestScore}</Text>
                  </View>
                  <View style={styles.playerHeroMetaRow}>
                    <Text style={styles.playerHeroMetaText}>
                      Sessions tracked: {playerDashboard.scoreCount}
                    </Text>
                  </View>
                </LinearGradient>

                <View style={styles.playerMetricGrid}>
                  {playerDashboard.metricCards.map((metric) => (
                    <View key={metric.key} style={styles.playerMetricCard}>
                      <View style={styles.playerMetricHeader}>
                        <View
                          style={[
                            styles.playerMetricIconWrap,
                            { backgroundColor: `${metric.color}20` },
                          ]}
                        >
                          <Ionicons name={metric.icon as any} size={13} color={metric.color} />
                        </View>
                        <Text style={styles.playerMetricLabel}>{metric.label}</Text>
                      </View>
                      <View style={styles.playerMetricScoreRow}>
                        <Text style={styles.playerMetricValue}>
                          {metric.score === null ? "--" : metric.score.toFixed(1)}
                        </Text>
                        {metric.delta !== null ? (
                          <View style={styles.playerMetricDeltaWrap}>
                            <Ionicons
                              name={metricDeltaIcon(metric.delta)}
                              size={10}
                              color={getDeltaColor(metric.delta)}
                            />
                            <Text
                              style={[
                                styles.playerMetricDelta,
                                { color: getDeltaColor(metric.delta) },
                              ]}
                            >
                              {formatMetricDelta(metric.delta)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.playerSectionCard}>
                  <View style={styles.playerTrendHeaderRow}>
                    <View>
                      <Text style={styles.playerSectionTitle}>Trend</Text>
                      <Text style={styles.playerTrendSubtitle}>
                        Showing {selectedTrendSessions === "all" ? playerDashboard.scoreCount : Math.min(selectedTrendSessions, playerDashboard.scoreCount)} of {playerDashboard.scoreCount} sessions
                      </Text>
                    </View>
                    <View style={styles.playerTrendSessionTabs}>
                      {TREND_SESSION_FILTERS.map((option) => (
                        <Pressable
                          key={String(option.key)}
                          onPress={() => setSelectedTrendSessions(option.key)}
                          style={({ pressed }) => [
                            styles.playerTrendSessionTab,
                            {
                              borderColor:
                                selectedTrendSessions === option.key ? `${sc.primary}80` : "#2A2A5060",
                              backgroundColor:
                                selectedTrendSessions === option.key ? `${sc.primary}20` : "#0A0A1A80",
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.playerTrendSessionTabText,
                              { color: selectedTrendSessions === option.key ? sc.primary : "#94A3B8" },
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={styles.playerTrendMetricTabs}>
                    {PLAYER_TREND_FILTERS.map((metric) => (
                      <Pressable
                        key={metric.key}
                        onPress={() => setSelectedTrendMetric(metric.key)}
                        style={({ pressed }) => [
                          styles.playerTrendMetricTab,
                          {
                            borderColor:
                              selectedTrendMetric === metric.key
                                ? `${metric.color}80`
                                : "#2A2A5060",
                            backgroundColor:
                              selectedTrendMetric === metric.key
                                ? `${metric.color}1F`
                                : "#0A0A1A80",
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.playerTrendMetricTabText,
                            {
                              color:
                                selectedTrendMetric === metric.key ? metric.color : "#94A3B8",
                            },
                          ]}
                        >
                          {metric.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <LinearGradient
                    colors={["#0E1835", "#0B132B", "#0A1126"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.playerTrendGlassCard}
                  >
                  <PlayerMetricTrendChart
                    labels={playerDashboard.trendPoints.map((point) => point.label)}
                    series={playerDashboard.metricTrendSeries}
                    activeKey={selectedTrendMetric}
                  />
                  </LinearGradient>
                </View>

                <View style={styles.playerSectionCard}>
                  <Text style={styles.playerSectionTitle}>Stroke performance</Text>
                  {playerDashboard.movementCards.map((movement) => (
                    <View key={movement.movement} style={styles.playerMovementRow}>
                      <View>
                        <Text style={styles.playerMovementName}>{movement.movement}</Text>
                        <Text style={styles.playerMovementMeta}>{movement.sessions} sessions</Text>
                      </View>
                      <View style={styles.playerMovementRight}>
                        <Text style={styles.playerMovementScore}>{movement.score}</Text>
                        <Text
                          style={[
                            styles.playerMovementDelta,
                            { color: getDeltaColor(movement.delta) },
                          ]}
                        >
                          {movement.delta === null
                            ? "No trend"
                            : `${movement.delta >= 0 ? "+" : ""}${movement.delta.toFixed(1)}`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.playerSectionCard}>
                  <Text style={styles.playerSectionTitle}>Improvement plan</Text>
                  <View style={styles.playerPlanDurationRow}>
                    {PLAN_DURATIONS.map((minutes) => (
                      <Pressable
                        key={minutes}
                        onPress={() => setSelectedPlanMinutes(minutes)}
                        style={({ pressed }) => [
                          styles.playerPlanDurationChip,
                          {
                            borderColor:
                              selectedPlanMinutes === minutes ? `${sc.primary}80` : "#2A2A5060",
                            backgroundColor:
                              selectedPlanMinutes === minutes ? `${sc.primary}20` : "#0A0A1A80",
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.playerPlanDurationText,
                            { color: selectedPlanMinutes === minutes ? sc.primary : "#94A3B8" },
                          ]}
                        >
                          {minutes} min
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {playerDashboard.focusAreas.map((area, index) => (
                    <View key={area.key} style={styles.playerPlanRow}>
                      <View style={styles.playerPlanIndexWrap}>
                        <Text style={styles.playerPlanIndex}>{index + 1}</Text>
                      </View>
                      <View style={styles.playerPlanContent}>
                        <Text style={styles.playerPlanTitle}>{area.label}</Text>
                        <Text style={styles.playerPlanMeta}>
                          {area.current.toFixed(1)} now to target {area.target.toFixed(1)}
                        </Text>
                        <Text style={styles.playerPlanGain}>Expected gain: +{area.expectedGain.toFixed(1)}</Text>
                        <Text style={styles.playerPlanDrill}>{area.drill}</Text>
                      </View>
                    </View>
                  ))}
                </View>

              </>
            )}


            {!isAdmin && filteredAnalyses.length > 0 && !playerDashboard && (
              <View style={styles.playerPendingCard}>
                <Text style={styles.playerPendingTitle}>Analysis in progress</Text>
                <Text style={styles.playerPendingText}>
                  We found your uploaded videos. Performance metrics will appear after scoring completes.
                </Text>
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

      {registrySaveToast.visible ? (
        <View style={styles.registryToastContainer} pointerEvents="none">
          <View
            style={[
              styles.registryToast,
              registrySaveToast.tone === "success" && styles.registryToastSuccess,
              registrySaveToast.tone === "error" && styles.registryToastError,
            ]}
          >
            <Ionicons
              name={
                registrySaveToast.tone === "success"
                  ? "checkmark-circle"
                  : registrySaveToast.tone === "error"
                    ? "alert-circle"
                    : "time-outline"
              }
              size={14}
              color={
                registrySaveToast.tone === "success"
                  ? "#34D399"
                  : registrySaveToast.tone === "error"
                    ? "#F87171"
                    : "#94A3B8"
              }
            />
            <Text style={styles.registryToastText}>{registrySaveToast.message}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ds.color.bg },
  scroll: { paddingHorizontal: ds.space.xl, paddingBottom: 100 },
  registryToastContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
    zIndex: 30,
  },
  registryToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  registryToastSuccess: {
    borderColor: "#166534",
    backgroundColor: "#052E1A",
  },
  registryToastError: {
    borderColor: "#7F1D1D",
    backgroundColor: "#3F1114",
  },
  registryToastText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  greetingSection: { marginTop: 20, marginBottom: 28 },
  greeting: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  greetingSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    color: ds.color.textTertiary,
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
    color: ds.color.textTertiary,
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
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
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
    color: ds.color.textSecondary,
  },
  loadingWrap: { paddingTop: 60, alignItems: "center" },
  discrepancyCard: {
    borderRadius: ds.radius.lg,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
    padding: ds.space.lg,
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
    color: ds.color.textPrimary,
  },
  discrepancyRate: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  discrepancyStateText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  modelMetaCard: {
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  modelMetaText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  modelMetaSubText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    marginTop: 2,
  },
  scoringSaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 9,
    backgroundColor: "#0A0A1A80",
  },
  scoringSaveText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  scoringSaveHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    marginTop: -4,
  },
  discrepancyTrendCard: {
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
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
    color: ds.color.textTertiary,
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
    color: ds.color.textTertiary,
  },
  discrepancyList: {
    gap: 8,
  },
  discrepancyRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
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
    color: ds.color.textSecondary,
    flex: 1,
  },
  discrepancyMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  discrepancyMetaSecondary: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  discrepancyUploader: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.accent,
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
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    backgroundColor: ds.color.bg,
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
    color: ds.color.textSecondary,
  },
  registryCard: {
    borderRadius: ds.radius.lg,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
    padding: ds.space.lg,
    gap: 10,
    marginBottom: 24,
  },
  registryTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  registrySubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  registryMoreButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: -2,
  },
  registryMoreText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.accent,
  },
  registryTrendCard: {
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 7,
  },
  registryTrendTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  registryTrendLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  registryLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  registryLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  registryLegendText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  registryXAxisLabels: {
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
  },
  registryXAxisLabel: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
    textAlign: "center",
  },
  registryTrendRow: {
    gap: 5,
    paddingVertical: 3,
  },
  registryTrendVersionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  registryTrendBarsWrap: {
    gap: 5,
  },
  registryTrendBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    overflow: "hidden",
  },
  registryTrendBarFillMovement: {
    height: "100%",
    backgroundColor: "#22C55E",
    borderRadius: 999,
  },
  registryTrendBarFillScoring: {
    height: "100%",
    backgroundColor: "#38BDF8",
    borderRadius: 999,
  },
  registryTrendValueText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  registryEntryCard: {
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  registryEntryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  registryEntryVersionText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  registryEntryDateText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  registryEntryMetaText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  registryEntrySubText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    marginTop: 2,
  },
  registryDetailOverlay: {
    flex: 1,
    backgroundColor: "#020617B0",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  registryDetailCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#0B1228",
    maxHeight: "82%",
    padding: 14,
    gap: 8,
  },
  registryDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  registryDetailTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  registryDetailSectionTitle: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#93C5FD",
  },
  registryDetailMeta: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#CBD5E1",
  },
  registryDetailDatasetBlock: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#33415580",
    backgroundColor: "#0A1023",
    padding: 8,
    gap: 3,
  },
  registryDetailDatasetName: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#E2E8F0",
  },
  registryDetailVideoMeta: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  playerHeroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    padding: 14,
    gap: 8,
    marginBottom: 14,
  },
  playerHeroLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#93C5FD",
    letterSpacing: 0.2,
  },
  playerHeroTopRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  playerHeroScore: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: "Inter_800ExtraBold",
    color: "#F8FAFC",
  },
  playerHeroDeltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 7,
  },
  playerHeroDelta: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  playerHeroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerHeroMetaText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#BFDBFE",
  },
  playerMetricGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  playerMetricCard: {
    width: "31%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#131A35",
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 8,
    minWidth: 0,
  },
  playerMetricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  playerMetricIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  playerMetricLabel: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#CBD5E1",
  },
  playerMetricScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  playerMetricValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  playerMetricDeltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  playerMetricDelta: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  playerSectionCard: {
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
    padding: ds.space.md,
    gap: 10,
    marginBottom: 12,
  },
  playerSectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  playerTrendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  playerTrendSubtitle: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  playerTrendLabelsRow: {
    flexDirection: "row",
    marginTop: 6,
    gap: 4,
  },
  playerTrendTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  playerTrendMetricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#2A2A5055",
    backgroundColor: "#0A0F22A0",
  },
  playerTrendMetricDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  playerTrendMetricLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  playerTrendMetricValue: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  playerTrendAxisLabel: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    textAlign: "center" as const,
  },
  playerTrendSessionTabs: {
    flexDirection: "row",
    gap: 8,
  },
  playerTrendSessionTab: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  playerTrendSessionTabText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  playerTrendMetricTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  playerTrendMetricTab: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  playerTrendMetricTabText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  playerTrendGlassCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    padding: 10,
  },
  playerMovementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  playerMovementName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  playerMovementMeta: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    marginTop: 2,
  },
  playerMovementRight: {
    alignItems: "flex-end",
  },
  playerMovementScore: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  playerMovementDelta: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  playerPlanRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  playerPlanDurationRow: {
    flexDirection: "row",
    gap: 8,
  },
  playerPlanDurationChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  playerPlanDurationText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  playerPlanIndexWrap: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
    marginTop: 1,
  },
  playerPlanIndex: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#93C5FD",
  },
  playerPlanContent: {
    flex: 1,
    gap: 2,
  },
  playerPlanTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  playerPlanMeta: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  playerPlanGain: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#34D399",
  },
  playerPlanDrill: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textSecondary,
  },
  playerPendingCard: {
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
    padding: ds.space.md,
    marginBottom: 14,
    gap: 5,
  },
  playerPendingTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  playerPendingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 20,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: ds.radius.xl,
    backgroundColor: ds.color.glass,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center" as const,
    lineHeight: 21,
    paddingHorizontal: 20,
    color: ds.color.textTertiary,
  },
});
