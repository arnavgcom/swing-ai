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
import { useQuery } from "@tanstack/react-query";
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
  fetchMyShotAnnotations,
  fetchScoringModelDashboard,
} from "@/lib/api";
import type { AnalysisSummary } from "@/lib/api";
import {
  DEFAULT_SESSION_TYPE_FILTERS,
  filterAnalysesBySessionAndStroke,
  filterAnalysesBySport,
  SESSION_TYPE_FILTER_OPTIONS,
  STROKE_FILTER_OPTIONS,
  type SessionTypeFilter,
  type StrokeTypeFilter,
} from "@/lib/analysis-filters";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTimeInTimeZone, formatMonthDayInTimeZone, parseApiDate, resolveUserTimeZone } from "@/lib/timezone";
import { useSport } from "@/lib/sport-context";
import { TabHeader } from "@/components/TabHeader";
import { TabScreenFilterGroup, TabScreenFilterRow, TabScreenIntro } from "@/components/TabScreenIntro";
import AdminDashboardWorkspace from "@/components/AdminDashboardWorkspace";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";

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

const TREND_SESSION_FILTERS = [
  { key: 5, label: "5S" },
  { key: 10, label: "10S" },
  { key: 25, label: "25S" },
  { key: "all", label: "All" },
] as const;
type TrendSessionWindow = (typeof TREND_SESSION_FILTERS)[number]["key"];

const PLAYER_TREND_FILTERS = [
  { key: "overall", label: "Overall", color: "#F59E0B" },
  { key: "technical", label: "Technical", color: "#60A5FA" },
  { key: "tactical", label: "Tactical", color: "#A78BFA" },
  { key: "movement", label: "Movement", color: "#34D399" },
] as const;

const PLAYER_METRICS = [
  { key: "technical", label: "Technical", icon: "construct", color: "#60A5FA" },
  { key: "tactical", label: "Tactical", icon: "analytics", color: "#A78BFA" },
  { key: "movement", label: "Movement", icon: "body", color: ds.color.success },
] as const;

const PLAN_DURATIONS = [10, 20, 30] as const;
type PlanDuration = (typeof PLAN_DURATIONS)[number];

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

function getDashboardOverallScore10(item: AnalysisSummary): number | null {
  const rawOverall = Number(item.overallScore);
  if (!Number.isFinite(rawOverall)) return null;
  return Number((rawOverall / 10).toFixed(1));
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
  const formattedLatestValue = Number(latestDisplayValue).toFixed(1);

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
  const scrollRef = React.useRef<ScrollView | null>(null);
  const [dashboardScrollY, setDashboardScrollY] = React.useState(0);
  const [mismatchSectionOffset, setMismatchSectionOffset] = React.useState<number | null>(null);
  const greetingFirstName = getGreetingFirstName(user?.name);
  const [selectedTrendMetric, setSelectedTrendMetric] = React.useState<string>(PLAYER_TREND_FILTERS[0].key);
  const [selectedTrendSessions, setSelectedTrendSessions] = React.useState<TrendSessionWindow>(10);
  const [selectedPlanMinutes, setSelectedPlanMinutes] = React.useState<PlanDuration>(20);
  const [userList, setUserList] = React.useState<Array<{id:string,name:string,email:string,role:string}>>([]);
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string>("all");
  const [showPlayerDropdown, setShowPlayerDropdown] = React.useState(false);
  const [selectedSessionTypes, setSelectedSessionTypes] = React.useState<SessionTypeFilter[]>(
    DEFAULT_SESSION_TYPE_FILTERS,
  );
  const [selectedStroke, setSelectedStroke] = React.useState<StrokeTypeFilter | null>(null);

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
  const areAllSessionTypesSelected = selectedSessionTypes.length === DEFAULT_SESSION_TYPE_FILTERS.length;
  const hasDashboardFilters = !areAllSessionTypesSelected || selectedStroke !== null;
  const isUserScopedDashboard = !isAdmin || selectedPlayerId !== "all";

  const toggleSessionType = React.useCallback((sessionType: SessionTypeFilter) => {
    setSelectedSessionTypes((current) => {
      if (current.includes(sessionType)) {
        if (current.length === 1) return current;
        const next = current.filter((value) => value !== sessionType);
        return DEFAULT_SESSION_TYPE_FILTERS.filter((value) => next.includes(value));
      }

      const next = [...current, sessionType];
      return DEFAULT_SESSION_TYPE_FILTERS.filter((value) => next.includes(value));
    });
  }, []);

  const toggleStroke = React.useCallback((strokeType: StrokeTypeFilter) => {
    setSelectedStroke((current) => (current === strokeType ? null : strokeType));
  }, []);

  const clearDashboardFilters = React.useCallback(() => {
    setSelectedSessionTypes(DEFAULT_SESSION_TYPE_FILTERS);
    setSelectedStroke(null);
  }, []);

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
    data: shotAnnotations,
    isLoading: shotAnnotationsLoading,
    refetch: refetchShotAnnotations,
    isRefetching: shotAnnotationsRefetching,
  } = useQuery({
    queryKey: ["shot-annotations", isAdmin ? selectedPlayerId : user?.id || "self"],
    queryFn: fetchMyShotAnnotations,
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

  const filteredAnalyses = React.useMemo(() => {
    let result = filterAnalysesBySport(
      allAnalyses || [],
      selectedSport?.name,
      selectedMovement?.name,
    );

    if (isAdmin && selectedPlayerId !== "all") {
      result = result.filter((analysis) => analysis.userId === selectedPlayerId);
    } else if (!isAdmin && user?.id) {
      result = result.filter((analysis) => analysis.userId === user.id);
    }

    return filterAnalysesBySessionAndStroke(result, selectedSessionTypes, selectedStroke);
  }, [
    allAnalyses,
    isAdmin,
    selectedMovement?.name,
    selectedPlayerId,
    selectedSessionTypes,
    selectedSport?.name,
    selectedStroke,
    user?.id,
  ]);

  const playerDashboard = React.useMemo(() => {
    const scoredAnalyses = filteredAnalyses
      .map((analysis) => {
        const score = getDashboardOverallScore10(analysis);
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
          score: Number(Number(entry.score).toFixed(1)),
        };
      });

    const metricTrendSeries = PLAYER_TREND_FILTERS.map((metric) => ({
      key: metric.key,
      label: metric.label,
      color: metric.color,
      values: trendEntries.map((entry) => {
        if (metric.key === "overall") {
          return Number((entry.score * 10).toFixed(1));
        }
        const value = getPlayerMetricValue(entry.analysis, metric.key);
        return value === null ? null : Number((value * 10).toFixed(1));
      }),
      displayValues: trendEntries.map((entry) => {
        if (metric.key === "overall") {
          return Number(Number(entry.score).toFixed(1));
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
      latestScore: Number(Number(scoredAnalyses[0].score).toFixed(1)),
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

  const missingAnnotationAnalyses = React.useMemo(() => {
    if (!isAdmin) return [];

    const annotatedAnalysisIds = new Set((shotAnnotations || []).map((item) => item.analysisId));

    return filteredAnalyses
      .filter((analysis) => analysis.status === "completed" && !annotatedAnalysisIds.has(analysis.id))
      .slice()
      .sort((a, b) => {
        const aTime = parseApiDate(a.capturedAt || a.createdAt)?.getTime() || 0;
        const bTime = parseApiDate(b.capturedAt || b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });
  }, [filteredAnalyses, isAdmin, shotAnnotations]);

  const adminCompletedUploadCount = React.useMemo(
    () => filteredAnalyses.filter((analysis) => analysis.status === "completed").length,
    [filteredAnalyses],
  );

  const adminAnnotatedUploadCount = React.useMemo(
    () => Math.max(0, adminCompletedUploadCount - missingAnnotationAnalyses.length),
    [adminCompletedUploadCount, missingAnnotationAnalyses.length],
  );

  const showMismatchSection = isAdmin
    && (
      shotAnnotationsLoading
      || missingAnnotationAnalyses.length > 0
      || discrepancyLoading
      || discrepancyIsError
      || !!discrepancy
    );

  const selectedPlayerLabel =
    selectedPlayerId === "all"
      ? "All"
      : (() => {
          const selected = userList.find((u) => u.id === selectedPlayerId);
          return selected ? getPlayerDisplayName(selected) : "All";
        })();
  const playerFilterLabel = isAdmin ? selectedPlayerLabel : user?.name || "Player";
  const dashboardControls = isAdmin || selectedMovement?.name ? (
    <>
      {isAdmin && isUserScopedDashboard ? (
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
      ) : null}
      {selectedMovement?.name ? (
        <View style={styles.movementBadge}>
          <Ionicons name="flash-outline" size={11} color="#34D399" />
          <Text style={styles.movementBadgeText}>
            {formatMovementBadgeLabel(selectedMovement?.name)}
          </Text>
        </View>
      ) : null}
    </>
  ) : null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <TabHeader />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || discrepancyRefetching || shotAnnotationsRefetching}
            onRefresh={() => {
              refetch();
              if (isAdmin) {
                refetchDiscrepancy();
                refetchShotAnnotations();
              }
            }}
            tintColor="#6C5CE7"
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          setDashboardScrollY(event.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
      >
        <TabScreenIntro
          title={`Hi ${greetingFirstName},`}
          subtitle="Monitor model performance and training data insights"
          controls={dashboardControls}
          titleColor={ds.color.textPrimary}
          subtitleColor={ds.color.textTertiary}
        >
          {isUserScopedDashboard ? (
            <>
              <TabScreenFilterGroup
                label="SESSION TYPE"
                action={hasDashboardFilters ? (
                  <Pressable
                    onPress={clearDashboardFilters}
                    style={({ pressed }) => [
                      styles.filterResetButton,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={[styles.filterResetText, { color: sc.primary }]}>Clear filters</Text>
                  </Pressable>
                ) : null}
              >
                <TabScreenFilterRow>
                  {SESSION_TYPE_FILTER_OPTIONS.map((option) => {
                    const selected = selectedSessionTypes.includes(option.key);
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => toggleSessionType(option.key)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          {
                            borderColor: selected ? `${sc.primary}75` : "#2A2A5060",
                            backgroundColor: selected ? `${sc.primary}1C` : "#0A0A1A80",
                            opacity: pressed ? 0.82 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            { color: selected ? sc.primary : "#94A3B8" },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </TabScreenFilterRow>
              </TabScreenFilterGroup>

              <TabScreenFilterGroup label="FOCUS">
                <TabScreenFilterRow>
                  {STROKE_FILTER_OPTIONS.map((option) => {
                    const selected = selectedStroke === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => toggleStroke(option.key)}
                        style={({ pressed }) => [
                          styles.filterChip,
                          {
                            borderColor: selected ? "#34D39966" : "#2A2A5060",
                            backgroundColor: selected ? "#34D39918" : "#0A0A1A80",
                            opacity: pressed ? 0.82 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            { color: selected ? "#34D399" : "#94A3B8" },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </TabScreenFilterRow>
              </TabScreenFilterGroup>
            </>
          ) : null}
        </TabScreenIntro>

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
            {isAdmin && !isUserScopedDashboard ? (
              <>
                <AdminDashboardWorkspace
                  scrollRef={scrollRef}
                  scrollY={dashboardScrollY}
                  mismatchSectionOffset={mismatchSectionOffset}
                />
              </>
            ) : null}

            {showMismatchSection ? (
              <View
                onLayout={(event) => {
                  setMismatchSectionOffset(event.nativeEvent.layout.y);
                }}
              >
            {isAdmin && (shotAnnotationsLoading || missingAnnotationAnalyses.length > 0) && (
              <View style={styles.discrepancyCard}>
                <View style={styles.discrepancyHeader}>
                  <Text style={styles.discrepancyTitle}>Completed Uploads Missing Manual Labels</Text>
                  {!shotAnnotationsLoading && missingAnnotationAnalyses.length > 0 ? (
                    <View
                      style={[
                        styles.discrepancyRateBadge,
                        { backgroundColor: "#3F2A07", borderColor: "#92400E" },
                      ]}
                    >
                      <Text style={[styles.discrepancyRateText, { color: ds.color.warning }]}> 
                        {missingAnnotationAnalyses.length} pending
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.discrepancyStateText}>
                  These completed uploads are excluded from discrepancy review until a manual shot annotation is saved.
                </Text>

                {shotAnnotationsLoading ? (
                  <Text style={styles.discrepancyStateText}>Checking annotation coverage…</Text>
                ) : (
                  <View style={styles.discrepancyList}>
                    {missingAnnotationAnalyses.slice(0, 10).map((analysis) => (
                      <Pressable
                        key={analysis.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push({
                            pathname: "/analysis/[id]",
                            params: { id: analysis.id },
                          });
                        }}
                        style={({ pressed }) => [styles.discrepancyRow, { opacity: pressed ? 0.82 : 1 }]}
                      >
                        <View style={styles.discrepancyRowLeft}>
                          <View style={styles.discrepancyTopLine}>
                            <Text style={styles.discrepancyVideoName} numberOfLines={1}>
                              {analysis.userName || "Player"}
                            </Text>
                          </View>
                          <Text style={styles.discrepancyMeta} numberOfLines={1}>
                            {`${String(analysis.sportName || "Sport")} • ${formatLabel(analysis.detectedMovement || analysis.movementName || "general")}`}
                          </Text>
                          <Text style={styles.discrepancyMetaSecondary} numberOfLines={1}>
                            {analysis.videoFilename}
                          </Text>
                          <Text style={styles.discrepancyMetaSecondary}>
                            {`Session • ${formatDateTime(analysis.capturedAt || analysis.createdAt, profileTimeZone)}`}
                          </Text>
                          <Text style={styles.registryEntrySubText}>
                            Analysis ID: {analysis.id}
                          </Text>
                        </View>
                        <View style={styles.discrepancyRowRight}>
                          <View
                            style={[
                              styles.discrepancyRateBadge,
                              { backgroundColor: "#3F2A07", borderColor: "#92400E" },
                            ]}
                          >
                            <Text style={[styles.discrepancyRateText, { color: ds.color.warning }]}>Needs labels</Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            {isAdmin && (discrepancyLoading || discrepancyIsError || !!discrepancy) && (
              <View style={styles.discrepancySectionBlock}>
                <Text style={styles.discrepancySectionEyebrow}>Mismatches</Text>
                <Pressable
                  onPress={() => setShowPlayerDropdown((prev) => !prev)}
                  style={[
                    styles.playerDropdown,
                    styles.discrepancySectionFilter,
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
                <View style={styles.discrepancyCard}>
                <View style={styles.discrepancyHeader}>
                  <Text style={styles.discrepancyTitle}>Current Model</Text>
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
              </View>
            )}
              </View>
            ) : null}

            {isUserScopedDashboard && playerDashboard && (
              <>
                <View style={styles.playerSummaryCard}>
                  <View style={[styles.playerSummaryAccentBar, { backgroundColor: sc.primary }]} />
                  <View style={styles.playerSummaryTop}>
                    <View style={styles.playerSummaryTopLeft}>
                      <Text style={styles.playerSummaryEyebrow}>Overall performance</Text>
                      <View style={styles.playerSummaryMetaRow}>
                        <View style={[styles.playerSummaryMetaBadge, styles.playerSummarySessionBadge]}>
                          <Text style={[styles.playerSummaryMetaBadgeText, styles.playerSummarySessionBadgeText]}>
                            {playerDashboard.scoreCount} sessions tracked
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.playerSummaryTopRight}>
                      <View style={styles.playerSummaryScoreWrap}>
                        <Text style={styles.playerSummaryScoreLabel}>Score</Text>
                        <View style={styles.playerSummaryScoreValueRow}>
                          {playerDashboard.overallDelta !== null ? (
                            <View style={styles.playerSummaryDeltaWrap}>
                              <Ionicons
                                name={metricDeltaIcon(playerDashboard.overallDelta)}
                                size={12}
                                color={getDeltaColor(playerDashboard.overallDelta)}
                              />
                              <Text
                                style={[
                                  styles.playerSummaryDeltaText,
                                  { color: getDeltaColor(playerDashboard.overallDelta) },
                                ]}
                              >
                                {formatMetricDelta(playerDashboard.overallDelta)}
                              </Text>
                            </View>
                          ) : null}
                          <Text style={styles.playerSummaryScoreText}>{playerDashboard.latestScore}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.playerSummaryMetricsRow}>
                    {playerDashboard.metricCards.map((metric) => (
                      <View key={metric.key} style={styles.playerSummaryMetricItem}>
                        <Text style={styles.playerSummaryMetricLabel} numberOfLines={1}>
                          {metric.label}
                        </Text>
                        <View style={styles.playerSummaryMetricValueRow}>
                          <Text style={styles.playerSummaryMetricValue}>
                            {metric.score == null ? "--" : metric.score.toFixed(1)}
                          </Text>
                          {metric.delta !== null ? (
                            <View style={styles.playerSummaryMetricDeltaWrap}>
                              <Ionicons
                                name={metricDeltaIcon(metric.delta)}
                                size={10}
                                color={getDeltaColor(metric.delta)}
                              />
                              <Text
                                style={[
                                  styles.playerSummaryMetricDeltaText,
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
                </View>

                <GlassCard style={styles.playerSectionCard}>
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
                              color: selectedTrendMetric === metric.key ? metric.color : "#94A3B8",
                            },
                          ]}
                        >
                          {metric.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <GlassCard style={styles.playerTrendGlassCard}>
                    <PlayerMetricTrendChart
                      labels={playerDashboard.trendPoints.map((point) => point.label)}
                      series={playerDashboard.metricTrendSeries}
                      activeKey={selectedTrendMetric}
                    />
                  </GlassCard>

                </GlassCard>

                <GlassCard style={styles.playerSectionCard}>
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
                </GlassCard>

                <GlassCard style={styles.playerSectionCard}>
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
                </GlassCard>

              </>
            )}


            {isUserScopedDashboard && filteredAnalyses.length > 0 && !playerDashboard && (
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
                  {hasDashboardFilters
                    ? "No videos match the selected session and stroke filters"
                    : `Upload a ${selectedSport?.name?.toLowerCase() || "sport"} video to get started`}
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
  greetingSection: { marginTop: 20, marginBottom: 14 },
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
  filterSection: {
    gap: 12,
    marginBottom: 20,
  },
  filterGroup: {
    gap: 8,
  },
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 34,
    justifyContent: "center",
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  filterResetButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  filterResetText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
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
  discrepancySectionBlock: {
    gap: 8,
    marginTop: 12,
  },
  discrepancySectionFilter: {
    alignSelf: "flex-start",
    minWidth: 132,
  },
  discrepancyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  discrepancySectionEyebrow: {
    color: "#93C5FD",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 8,
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
  trainingFormLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  trainingFormInput: {
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bg,
    color: ds.color.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  trainingFormInputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
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
  trainingStatsRow: {
    flexDirection: "row",
    gap: 12,
  },
  trainingActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  trainingActionButton: {
    flex: 1,
  },
  trainingStatCard: {
    flex: 1,
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  trainingStatValue: {
    fontSize: 24,
    fontFamily: "Inter_800ExtraBold",
    color: ds.color.textPrimary,
  },
  trainingStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
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
  playerSummaryCard: {
    backgroundColor: "#15152D",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5040",
    padding: 16,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },
  playerSummaryAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  playerSummaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  playerSummaryTopLeft: {
    flex: 1,
    gap: 2,
  },
  playerSummaryTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playerSummaryEyebrow: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  playerSummaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  playerSummaryMetaBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "70%",
  },
  playerSummaryMetaBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  playerSummarySessionBadge: {
    backgroundColor: "#93C5FD12",
    borderColor: "#93C5FD30",
  },
  playerSummarySessionBadgeText: {
    color: "#93C5FD",
  },
  playerSummaryScoreWrap: {
    alignItems: "flex-end",
  },
  playerSummaryScoreLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  playerSummaryScoreValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  playerSummaryScoreText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  playerSummaryDeltaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 4,
  },
  playerSummaryDeltaText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  playerSummaryMetricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 6,
  },
  playerSummaryMetricItem: {
    minWidth: "31%" as const,
    flexGrow: 1,
    flexBasis: "31%" as const,
    backgroundColor: "#0A0A1A50",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: "#2A2A5020",
  },
  playerSummaryMetricLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  playerSummaryMetricValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  playerSummaryMetricValueRow: {
    width: "100%",
    minHeight: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  playerSummaryMetricDeltaWrap: {
    position: "absolute",
    right: "50%",
    marginRight: 16,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  playerSummaryMetricDeltaText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 10,
  },
  playerSectionCard: {
    padding: ds.space.lg,
    gap: 10,
    marginBottom: 14,
  },
  playerSectionTitle: {
    fontSize: 15,
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
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  playerTrendSessionTab: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    padding: 12,
  },
  playerMovementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  playerMovementName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  playerMovementMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
    marginTop: 2,
  },
  playerMovementRight: {
    alignItems: "flex-end",
  },
  playerMovementScore: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
  },
  playerMovementDelta: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  playerPlanRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: ds.color.glass,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  playerPlanDurationRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
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
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
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
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textSecondary,
    lineHeight: 18,
  },
  playerPendingCard: {
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
