import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  fetchModelRegistryConfig,
  fetchTennisDatasetInsights,
  fetchTennisModelTrainingStatus,
  saveTennisModelVersion,
  triggerTennisModelTraining,
  updateModelRegistryConfig,
  validateModelRegistryManifest,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ds } from "@/constants/design-system";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatDateTimeInTimeZone, resolveUserTimeZone } from "@/lib/timezone";

const SECTION_ORDER = ["models", "data", "mismatches"] as const;

type SectionKey = (typeof SECTION_ORDER)[number];

type AdminDashboardWorkspaceProps = {
  scrollRef: React.RefObject<ScrollView | null>;
  scrollY: number;
  mismatchSectionOffset?: number | null;
  onBack?: () => void;
};

const LABEL_COLORS: Record<string, string> = {
  forehand: "#38BDF8",
  backhand: "#A78BFA",
  serve: "#F97316",
  volley: "#34D399",
  practice: "#38BDF8",
  "match-play": "#F59E0B",
};

function formatPercent(value?: number | null, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatCompactNumber(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDateLabel(value?: string | null, timeZone?: string): string {
  if (!value) return "Not available";
  return formatDateTimeInTimeZone(value, timeZone, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    year: undefined,
  });
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return "No recent run";
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return "No recent run";
  const deltaMinutes = Math.max(Math.round((Date.now() - parsed) / 60000), 0);
  if (deltaMinutes < 1) return "Just now";
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 48) return `${deltaHours}h ago`;
  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function formatStatusLabel(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLabel(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMovementList(values: string[]): string {
  if (!values.length) return "No movement labels yet";
  return values.map((value) => formatStatusLabel(value)).join(" • ");
}

function formatVersionLabel(value?: string | null): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  return normalized.toLowerCase().startsWith("v") ? normalized : `v${normalized}`;
}

function MetricTile({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  accent: string;
}) {
  return (
    <GlassCard style={styles.metricTile}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </GlassCard>
  );
}

function SectionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sectionChip, selected && styles.sectionChipActive, { opacity: pressed ? 0.82 : 1 }]}
    >
      <Text style={[styles.sectionChipText, selected && styles.sectionChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function InlineAction({
  icon,
  label,
  onPress,
  disabled,
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.inlineAction,
        disabled && styles.inlineActionDisabled,
        { opacity: pressed || busy ? 0.8 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={ds.color.textPrimary} />
      ) : (
        <Ionicons name={icon} size={16} color={ds.color.textPrimary} />
      )}
      <Text style={styles.inlineActionText}>{label}</Text>
    </Pressable>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyValueLabel}>{label}</Text>
      <Text style={styles.keyValueValue}>{value}</Text>
    </View>
  );
}

function DistributionBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number; pct: number }>;
}) {
  return (
    <GlassCard style={styles.summaryCard}>
      <Text style={styles.cardTitle}>{title}</Text>
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
    </GlassCard>
  );
}

export default function AdminDashboardWorkspace({
  scrollRef,
  scrollY,
  mismatchSectionOffset,
  onBack,
}: AdminDashboardWorkspaceProps) {
  const queryClient = useQueryClient();
  const sectionOffsets = React.useRef<Record<SectionKey, number>>({ models: 0, data: 0, mismatches: 0 });
  const [activeSection, setActiveSection] = React.useState<SectionKey>("models");
  const { user } = useAuth();
  const profileTimeZone = resolveUserTimeZone(user);
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";
  const [activeModelVersion, setActiveModelVersion] = React.useState("");
  const [modelVersionChangeDescription, setModelVersionChangeDescription] = React.useState("");

  const trainingQuery = useQuery({
    queryKey: ["tennis-model-training-status"],
    queryFn: fetchTennisModelTrainingStatus,
    enabled: isAdmin,
    retry: false,
  });

  const datasetQuery = useQuery({
    queryKey: ["tennis-dataset-insights", "admin-dashboard"],
    queryFn: () => fetchTennisDatasetInsights(),
    enabled: isAdmin,
    retry: false,
  });

  const registryQuery = useQuery({
    queryKey: ["model-registry-config"],
    queryFn: fetchModelRegistryConfig,
    enabled: isAdmin,
    retry: false,
  });

  const refreshAll = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tennis-model-training-status"] }),
      queryClient.invalidateQueries({ queryKey: ["tennis-dataset-insights"] }),
      queryClient.invalidateQueries({ queryKey: ["model-registry-config"] }),
    ]);
  }, [queryClient]);

  React.useEffect(() => {
    if (!registryQuery.data) return;
    setActiveModelVersion(registryQuery.data.activeModelVersion || "");
    setModelVersionChangeDescription(registryQuery.data.modelVersionChangeDescription || "");
  }, [registryQuery.data]);

  React.useEffect(() => {
    if (typeof mismatchSectionOffset === "number") {
      sectionOffsets.current.mismatches = mismatchSectionOffset;
    }
  }, [mismatchSectionOffset]);

  React.useEffect(() => {
    let nextSection: SectionKey = "models";
    if (scrollY >= sectionOffsets.current.mismatches - 140) nextSection = "mismatches";
    else if (scrollY >= sectionOffsets.current.data - 140) nextSection = "data";
    else if (scrollY >= sectionOffsets.current.models - 140) nextSection = "models";
    setActiveSection((current) => (current === nextSection ? current : nextSection));
  }, [scrollY]);

  const trainMutation = useMutation({
    mutationFn: triggerTennisModelTraining,
    onSuccess: async () => {
      await refreshAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert("Training failed", error.message || "Unable to start tennis model training.");
    },
  });

  const saveVersionMutation = useMutation({
    mutationFn: () =>
      saveTennisModelVersion({
        modelVersion: trainingQuery.data?.draftVersion,
        description: trainingQuery.data?.draftVersion
          ? `Tennis classifier ${trainingQuery.data.draftVersion}`
          : undefined,
      }),
    onSuccess: async (result) => {
      await refreshAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Production updated",
        result.activeVersion
          ? `Saved tennis model version ${result.activeVersion}.`
          : "The latest trained tennis model was saved and promoted to the active version.",
      );
    },
    onError: (error: Error) => {
      Alert.alert("Save failed", error.message || "Unable to save the current tennis model version.");
    },
  });

  const saveRegistryMutation = useMutation({
    mutationFn: () =>
      updateModelRegistryConfig({
        activeModelVersion: activeModelVersion.trim(),
        modelVersionChangeDescription: modelVersionChangeDescription.trim(),
        evaluationDatasetManifestPath:
          registryQuery.data?.evaluationDatasetManifestPath || "database://model-registry",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["model-registry-config"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to update model registry");
    },
  });

  const validateRegistryMutation = useMutation({
    mutationFn: validateModelRegistryManifest,
    onSuccess: (result) => {
      const issues = [
        ...(result.validation.errors || []).map((line) => `Error: ${line}`),
        ...(result.validation.warnings || []).map((line) => `Warning: ${line}`),
      ];
      const status = result.validation.valid ? "Registry data looks healthy" : "Registry data needs attention";
      Alert.alert(status, issues.length ? issues.join("\n") : "No issues found.");
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to validate registry data");
    },
  });

  const datasetDistributions = datasetQuery.data?.currentDataset;
  const latestTraining = trainingQuery.data?.latestTraining;
  const currentJob = trainingQuery.data?.currentJob;
  const currentDraftTrendWidth = currentJob
    ? 100
    : Math.max(18, Math.min(100, Number(latestTraining?.macroF1 || 0) * 100));
  const recentDraftRuns = (trainingQuery.data?.history || [])
    .filter((entry) => entry.status === "succeeded" && typeof entry.macroF1 === "number")
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.completedAt || left.savedAt || left.requestedAt || 0).getTime();
      const rightTime = new Date(right.completedAt || right.savedAt || right.requestedAt || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 3);
  const recentTrainingTrend = (trainingQuery.data?.history || [])
    .filter(
      (entry) => entry.status === "succeeded"
        && typeof entry.macroF1 === "number"
        && Boolean(String(entry.savedModelVersion || "").trim()),
    )
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.savedAt || left.completedAt || left.requestedAt || 0).getTime();
      const rightTime = new Date(right.savedAt || right.completedAt || right.requestedAt || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 3);
  const activeModelConfusionMatrix = datasetQuery.data?.activeModel?.confusionMatrix;
  const activeModelConfusionMax = Math.max(
    0,
    ...(activeModelConfusionMatrix?.rows.flatMap((row) => row.counts.map((cell) => cell.count)) || []),
  );

  const isInitialLoading =
    trainingQuery.isLoading || datasetQuery.isLoading || registryQuery.isLoading;

  const jumpToSection = (section: SectionKey) => {
    setActiveSection(section);
    scrollRef.current?.scrollTo({
      y: Math.max(sectionOffsets.current[section] - 110, 0),
      animated: true,
    });
  };

  const canTrainModel = !currentJob && (trainingQuery.data?.eligibleShotCount ?? 0) >= 20;
  const canPromoteLatestRun = !currentJob && Boolean(trainingQuery.data?.trainedModelAvailable);

  if (!isAdmin) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.title}>Admin only</Text>
        <Text style={styles.subtitle}>This workspace is available only when the profile role is admin.</Text>
      </View>
    );
  }

  if (isInitialLoading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={ds.color.success} />
        <Text style={styles.loadingText}>Loading model, queue, and dataset health</Text>
      </View>
    );
  }

  const blockingError = trainingQuery.error || datasetQuery.error || registryQuery.error;
  if (!trainingQuery.data && !datasetQuery.data && !registryQuery.data && blockingError) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.errorTitle}>Unable to load admin workspace</Text>
        <Text style={styles.errorText}>{blockingError instanceof Error ? blockingError.message : "Try again"}</Text>
        <Pressable onPress={() => void refreshAll()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <View style={[styles.topRow, !onBack && styles.topRowEmbedded]}>
        {onBack ? (
          <Pressable onPress={onBack} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.76 : 1 }]}>
            <Ionicons name="chevron-back" size={22} color={ds.color.textPrimary} />
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <View style={styles.sectionChipRow}>
        <SectionChip label="Models" selected={activeSection === "models"} onPress={() => jumpToSection("models")} />
        <SectionChip label="Data" selected={activeSection === "data"} onPress={() => jumpToSection("data")} />
        <SectionChip label="Mismatches" selected={activeSection === "mismatches"} onPress={() => jumpToSection("mismatches")} />
      </View>

      <View
        onLayout={(event) => {
          sectionOffsets.current.models = event.nativeEvent.layout.y;
        }}
        style={styles.sectionBlock}
      >
        <Text style={styles.sectionEyebrow}>Models</Text>

        <View style={styles.metricGrid}>
          <MetricTile
            label="Macro F1"
            value={formatPercent(datasetQuery.data?.activeModel?.macroF1 ?? trainingQuery.data?.latestTraining?.macroF1 ?? null, 0)}
            helper={latestTraining ? `Latest run ${formatRelativeTime(latestTraining.trainedAt)}` : "No saved run yet"}
            accent={ds.color.success}
          />
          <MetricTile
            label="Accuracy"
            value={formatPercent(datasetQuery.data?.activeModel?.accuracy)}
            helper="Classification accuracy"
            accent="#38BDF8"
          />
        </View>

        {datasetQuery.data?.activeModel && activeModelConfusionMatrix?.labels.length ? (
          <GlassCard style={styles.summaryCard}>
            <View style={styles.confusionMatrixBlock}>
              <View style={styles.confusionMatrixHeader}>
                <Text style={styles.cardTitle}>Confusion matrix</Text>
                <Text style={styles.metaHint}>Actual rows, predicted columns</Text>
              </View>
              <View style={styles.confusionMatrixTable}>
                <View style={styles.confusionMatrixRow}>
                  <View style={[styles.confusionMatrixCell, styles.confusionMatrixCornerCell]}>
                    <Text style={styles.confusionMatrixAxisText}>Actual</Text>
                  </View>
                  {activeModelConfusionMatrix.labels.map((label) => (
                    <View key={`header-${label}`} style={[styles.confusionMatrixCell, styles.confusionMatrixHeaderCell]}>
                      <Text style={styles.confusionMatrixHeaderText}>{formatLabel(label)}</Text>
                    </View>
                  ))}
                </View>
                {activeModelConfusionMatrix.rows.map((row) => (
                  <View key={row.actual} style={styles.confusionMatrixRow}>
                    <View style={[styles.confusionMatrixCell, styles.confusionMatrixRowLabelCell]}>
                      <Text style={styles.confusionMatrixRowLabel}>{formatLabel(row.actual)}</Text>
                    </View>
                    {row.counts.map((cell) => {
                      const intensity = activeModelConfusionMax > 0 ? cell.count / activeModelConfusionMax : 0;
                      const isCorrect = cell.predicted === row.actual;
                      return (
                        <View
                          key={`${row.actual}-${cell.predicted}`}
                          style={[
                            styles.confusionMatrixCell,
                            styles.confusionMatrixValueCell,
                            {
                              backgroundColor: isCorrect
                                ? `rgba(34, 197, 94, ${0.16 + intensity * 0.42})`
                                : `rgba(56, 189, 248, ${0.08 + intensity * 0.24})`,
                              borderColor: isCorrect ? "rgba(34, 197, 94, 0.22)" : "rgba(148, 163, 184, 0.12)",
                            },
                          ]}
                        >
                          <Text style={styles.confusionMatrixValueText}>{cell.count}</Text>
                          <Text style={styles.confusionMatrixPctText}>{cell.pct.toFixed(0)}%</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </GlassCard>
        ) : null}

        {datasetQuery.data?.activeModel ? (
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Precision recall F1</Text>
            <View style={styles.metricsList}>
              {datasetQuery.data.activeModel.perLabel.map((item) => (
                <View key={item.label} style={styles.metricRow}>
                  <View style={styles.metricLabelWrap}>
                    <View style={[styles.metricDot, { backgroundColor: LABEL_COLORS[item.label] || ds.color.success }]} />
                    <Text style={styles.metricRowLabel}>{formatLabel(item.label)}</Text>
                  </View>
                  <Text style={styles.metricRowValue}>P {formatPercent(item.precision, 0)}</Text>
                  <Text style={styles.metricRowValue}>R {formatPercent(item.recall, 0)}</Text>
                  <Text style={styles.metricRowValue}>F1 {formatPercent(item.f1, 0)}</Text>
                  <Text style={styles.metricSupport}>{item.support}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.summaryCard}>
          <View style={styles.inlineActionRowHeader}>
            <View style={styles.flexFill}>
              <Text style={styles.cardTitle}>Model actions</Text>
            </View>
          </View>
          <View style={styles.inlineActionRow}>
            <InlineAction
              icon="sparkles-outline"
              label="Train model"
              onPress={() => {
                void trainMutation.mutateAsync();
              }}
              busy={trainMutation.isPending}
              disabled={!canTrainModel}
            />
            <InlineAction
              icon="rocket-outline"
              label="Promote latest run"
              onPress={() => {
                void saveVersionMutation.mutateAsync();
              }}
              busy={saveVersionMutation.isPending}
              disabled={!canPromoteLatestRun}
            />
          </View>
          <View style={styles.modelActionsTrendBlock}>
            <View style={styles.trainingTrendHeaderCard}>
              <View style={styles.trainingTrendHeaderRow}>
                <Text style={styles.trainingTrendDraftVersion}>{formatVersionLabel(trainingQuery.data?.draftVersion || "0.0")}</Text>
                <Text style={styles.trainingTrendDraftLabel}>Draft version (last 3 runs)</Text>
              </View>
              {currentJob ? (
                <Text style={styles.trainingTrendDraftHint}>
                  Started {formatDateLabel(currentJob.startedAt || currentJob.createdAt || null, profileTimeZone)}
                </Text>
              ) : null}
              <View style={styles.trainingTrendBarTrack}>
                <View
                  style={[
                    styles.trainingTrendBarFill,
                    styles.trainingTrendDraftBarFill,
                    { width: `${currentDraftTrendWidth}%` },
                  ]}
                />
              </View>
              {recentDraftRuns.length ? (
                <View style={styles.trainingTrendDraftRunsList}>
                  {recentDraftRuns.map((entry) => (
                    <View key={`draft-${entry.jobId}`} style={styles.trainingTrendDraftRunRow}>
                      <View style={styles.trainingTrendDraftRunHeader}>
                        <Text style={styles.trainingTrendDraftRunText}>
                          {formatDateLabel(entry.completedAt || entry.savedAt || entry.requestedAt, profileTimeZone)}
                          {typeof entry.trainRows === "number" && typeof entry.testRows === "number"
                            ? ` • ${entry.trainRows}/${entry.testRows}`
                            : " • Split unavailable"}
                        </Text>
                        <Text style={styles.trainingTrendDraftRunValueText}>
                          {typeof entry.macroF1 === "number" ? formatPercent(entry.macroF1, 1) : "--"}
                        </Text>
                      </View>
                      <View style={styles.trainingTrendBarTrack}>
                        <View
                          style={[
                            styles.trainingTrendBarFill,
                            styles.trainingTrendDraftRunBarFill,
                            { width: `${Math.max(4, Math.min(100, Number(entry.macroF1 || 0) * 100))}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            {recentTrainingTrend.length ? (
              <View style={styles.trainingTrendList}>
                {recentTrainingTrend.map((entry) => (
                  <View key={entry.jobId} style={styles.trainingTrendRow}>
                    <View style={styles.trainingTrendRowHeader}>
                      <Text style={styles.trainingTrendHistoryVersionText}>{formatVersionLabel(entry.savedModelVersion)}</Text>
                      <Text style={styles.trainingTrendHistoryValueText}>{formatPercent(entry.macroF1, 1)}</Text>
                    </View>
                    <View style={styles.trainingTrendBarTrack}>
                      <View
                        style={[
                          styles.trainingTrendBarFill,
                          styles.trainingTrendHistoryBarFill,
                          { width: `${Math.max(4, Math.min(100, Number(entry.macroF1 || 0) * 100))}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.trainingTrendMetaText}>
                      {formatDateLabel(entry.completedAt || entry.savedAt || entry.requestedAt, profileTimeZone)}
                      {typeof entry.trainRows === "number" && typeof entry.testRows === "number"
                        ? ` • ${entry.trainRows}/${entry.testRows}`
                        : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          {currentJob ? (
            <View style={styles.jobStatusBox}>
              <Text style={styles.jobStatusTitle}>Current job</Text>
              <Text style={styles.jobStatusText}>{String(currentJob.status || "running").toUpperCase()}</Text>
              <Text style={styles.jobStatusHint}>Started {formatDateLabel(currentJob.startedAt || currentJob.createdAt || null, profileTimeZone)}</Text>
            </View>
          ) : null}
        </GlassCard>
      </View>

      <View
        onLayout={(event) => {
          sectionOffsets.current.data = event.nativeEvent.layout.y;
        }}
        style={styles.sectionBlock}
      >
        <Text style={styles.sectionEyebrow}>Data</Text>

        <View style={styles.metricGrid}>
          <MetricTile
            label="Eligible videos"
            value={formatCompactNumber(datasetDistributions?.eligibleVideoCount)}
            helper={`${formatCompactNumber(datasetDistributions?.eligibleShotCount)} labeled shots available`}
            accent="#F59E0B"
          />
          <MetricTile
            label="Labeled shots"
            value={formatCompactNumber(datasetDistributions?.eligibleShotCount)}
            helper={`${datasetDistributions?.shotDistribution.length || 0} shot labels represented`}
            accent="#22C55E"
          />
        </View>

        <DistributionBlock title="Video Distribution" items={datasetQuery.data?.currentDataset.videoDistribution || []} />
        <DistributionBlock title="Shot Distribution" items={datasetQuery.data?.currentDataset.shotDistribution || []} />
        <DistributionBlock title="Session Type Distribution" items={datasetQuery.data?.currentDataset.sessionTypeDistribution || []} />

        <GlassCard style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Data quality next steps</Text>
          {datasetQuery.data?.suggestions.length ? (
            <View style={styles.suggestionList}>
              {datasetQuery.data.suggestions.slice(0, 4).map((suggestion) => (
                <View key={suggestion} style={styles.suggestionRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={ds.color.success} />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No immediate dataset coverage suggestions were returned.</Text>
          )}
        </GlassCard>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
  },
  centerWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    color: ds.color.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  errorTitle: {
    color: ds.color.textPrimary,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  errorText: {
    color: ds.color.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.color.accent,
  },
  retryButtonText: {
    color: ds.color.textPrimary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRowEmbedded: {
    justifyContent: "flex-end",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  sectionChipRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  sectionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  sectionChipActive: {
    backgroundColor: "rgba(52, 211, 153, 0.16)",
    borderColor: "rgba(52, 211, 153, 0.35)",
  },
  sectionChipText: {
    color: ds.color.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sectionChipTextActive: {
    color: ds.color.textPrimary,
  },
  sectionBlock: {
    gap: 14,
  },
  sectionEyebrow: {
    color: "#93C5FD",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: ds.color.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Inter_700Bold",
  },
  sectionCopy: {
    color: ds.color.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricTile: {
    minWidth: 154,
    flexGrow: 1,
    flexBasis: 0,
    padding: 16,
    gap: 8,
  },
  metricAccent: {
    width: 34,
    height: 4,
    borderRadius: 999,
  },
  metricLabel: {
    color: ds.color.textTertiary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  metricValue: {
    color: ds.color.textPrimary,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
  },
  metricHelper: {
    color: ds.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  summaryCard: {
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    color: ds.color.textPrimary,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  cardSubtext: {
    color: ds.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  queueRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  queuePill: {
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: ds.radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    alignItems: "center",
  },
  queuePillValue: {
    color: ds.color.textPrimary,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  queuePillLabel: {
    marginTop: 4,
    color: ds.color.textTertiary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  dualColumnRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  formBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: ds.color.bgElevated,
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: ds.color.textPrimary,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  validationCard: {
    borderRadius: ds.radius.md,
    padding: 12,
    gap: 4,
  },
  validationTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
  },
  validationText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  validationHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  featureCard: {
    minWidth: 220,
    flexGrow: 1,
    flexBasis: 0,
    padding: 18,
    gap: 12,
  },
  featureValue: {
    color: ds.color.textPrimary,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: "Inter_700Bold",
  },
  featureText: {
    color: ds.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  keyValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  keyValueLabel: {
    color: ds.color.textTertiary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  keyValueValue: {
    color: ds.color.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    textAlign: "right",
  },
  inlineActionRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flexFill: {
    flex: 1,
  },
  inlineActionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  modelActionsTrendBlock: {
    gap: 10,
  },
  trainingTrendHeaderCard: {
    gap: 6,
    padding: 12,
    borderRadius: ds.radius.md,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
  },
  trainingTrendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  trainingTrendDraftVersion: {
    color: ds.color.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  trainingTrendDraftLabel: {
    color: ds.color.textPrimary,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  trainingTrendDraftHint: {
    color: ds.color.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  trainingTrendDraftRunsList: {
    gap: 6,
    marginTop: 2,
  },
  trainingTrendDraftRunRow: {
    gap: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.14)",
  },
  trainingTrendDraftRunHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trainingTrendDraftRunText: {
    flex: 1,
    color: "#7DD3FC",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    lineHeight: 16,
  },
  trainingTrendDraftRunValueText: {
    color: "#7DD3FC",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  trainingTrendDraftRunBarFill: {
    backgroundColor: "#38BDF8",
  },
  trainingTrendList: {
    gap: 10,
  },
  trainingTrendRow: {
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: ds.color.glassBorder,
  },
  trainingTrendRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trainingTrendVersionText: {
    color: ds.color.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  trainingTrendBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1E293B",
    overflow: "hidden",
  },
  trainingTrendBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#38BDF8",
  },
  trainingTrendDraftBarFill: {
    opacity: 0.95,
  },
  trainingTrendHistoryBarFill: {
    backgroundColor: "#22C55E",
  },
  trainingTrendValueText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  trainingTrendHistoryValueText: {
    color: "#4ADE80",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  trainingTrendHistoryVersionText: {
    color: "#86EFAC",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  trainingTrendMetaText: {
    color: ds.color.textTertiary,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.color.accent,
  },
  inlineActionDisabled: {
    backgroundColor: "rgba(71, 85, 105, 0.55)",
  },
  inlineActionText: {
    color: ds.color.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  jobStatusBox: {
    padding: 14,
    borderRadius: ds.radius.md,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.22)",
    gap: 4,
  },
  jobStatusTitle: {
    color: "#93C5FD",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  jobStatusText: {
    color: ds.color.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  jobStatusHint: {
    color: ds.color.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  versionList: {
    gap: 10,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: ds.radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  versionRowActive: {
    borderColor: "rgba(52, 211, 153, 0.28)",
    backgroundColor: "rgba(52, 211, 153, 0.08)",
  },
  versionMeta: {
    flex: 1,
    gap: 4,
  },
  versionTitle: {
    color: ds.color.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  versionDescription: {
    color: ds.color.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  versionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: ds.radius.pill,
    backgroundColor: "rgba(148, 163, 184, 0.14)",
  },
  versionBadgeActive: {
    backgroundColor: "rgba(52, 211, 153, 0.18)",
  },
  versionBadgeText: {
    color: ds.color.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  versionBadgeTextActive: {
    color: ds.color.textPrimary,
  },
  suggestionList: {
    gap: 10,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  suggestionText: {
    flex: 1,
    color: ds.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  emptyText: {
    color: ds.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  datasetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ds.color.glassBorder,
    paddingTop: 10,
  },
  datasetRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  datasetBody: {
    flex: 1,
    gap: 4,
  },
  datasetName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  datasetMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  datasetMetaSecondary: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  datasetCountPill: {
    minWidth: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#0E2F22",
    borderWidth: 1,
    borderColor: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  datasetCountText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
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
  confusionMatrixBlock: {
    gap: 10,
  },
  confusionMatrixHeader: {
    gap: 2,
  },
  confusionMatrixTable: {
    gap: 8,
    width: "100%",
  },
  confusionMatrixRow: {
    flexDirection: "row",
    gap: 4,
  },
  confusionMatrixCell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: ds.radius.md,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
    justifyContent: "center",
  },
  confusionMatrixCornerCell: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  confusionMatrixHeaderCell: {
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  confusionMatrixRowLabelCell: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  confusionMatrixAxisText: {
    color: ds.color.textTertiary,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  confusionMatrixHeaderText: {
    color: ds.color.textPrimary,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  confusionMatrixRowLabel: {
    color: ds.color.textPrimary,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  confusionMatrixValueCell: {
    alignItems: "center",
  },
  confusionMatrixValueText: {
    color: ds.color.textPrimary,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  confusionMatrixPctText: {
    color: ds.color.textSecondary,
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
  metaSectionLabel: {
    color: ds.color.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  metricsList: {
    gap: 10,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: ds.color.glassBorder,
    paddingTop: 10,
  },
  metricLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 130,
    flexGrow: 1,
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  metricRowLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textPrimary,
  },
  metricRowValue: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: ds.color.textSecondary,
    minWidth: 58,
  },
  metricSupport: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textTertiary,
  },
  trendList: {
    gap: 12,
  },
  trendRow: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: ds.color.glassBorder,
    paddingTop: 12,
  },
  trendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trendVersionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendVersionText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: ds.color.textPrimary,
  },
  trendActiveBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#052E1A",
    borderWidth: 1,
    borderColor: "#166534",
  },
  trendActiveBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#34D399",
    textTransform: "uppercase",
  },
  trendMetricText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: ds.color.success,
  },
  trendBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#0E1022",
    overflow: "hidden",
  },
  trendBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ds.color.success,
  },
  trendMetaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: ds.color.textSecondary,
  },
  trendMetaSubText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: ds.color.textTertiary,
  },
  title: {
    color: ds.color.textPrimary,
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    color: ds.color.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});