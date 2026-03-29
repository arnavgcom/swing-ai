import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAnalysesSummary,
  fetchTennisModelTrainingStatus,
  startAnalysesRecalculation,
  type AnalysisSummary,
  type RecalculateAnalysesResponse,
  type TennisModelTrainingStatusResponse,
} from "@/lib/api";

const normalizeRole = (value?: string | null): "admin" | "player" => {
  return value?.trim().toLowerCase() === "admin" ? "admin" : "player";
};

const RECALC_RUN_STORAGE_KEY = "swingai_active_recalc_run";

type RecalcProgressSnapshot = {
  queuedAnalyses: AnalysisSummary[];
  queuedStatus: ReturnType<typeof summarizeStatus>;
  totalQueued: number;
  completedQueued: number;
  progressPct: number;
  updatedAt: string;
};

type PersistedRecalcState = {
  run: RecalculateAnalysesResponse;
  progress: RecalcProgressSnapshot | null;
};

type ModelPickerItem = {
  key: string;
  label: string;
  hint: string;
  badge?: string;
  modelVersion: string;
  useDraftModel: boolean;
  disabled?: boolean;
};

function buildModelPickerItems(status: TennisModelTrainingStatusResponse | undefined): ModelPickerItem[] {
  if (!status) return [];

  const items: ModelPickerItem[] = [
    {
      key: `saved:${status.activeVersion}`,
      label: `Saved v${status.activeVersion}`,
      hint: status.activeVersionDescription || "Current promoted model version",
      badge: "Active",
      modelVersion: status.activeVersion,
      useDraftModel: false,
    },
  ];

  const hasDraftCandidate = status.history.some((entry) => entry.status === "succeeded" && !entry.savedModelVersion);
  items.push({
    key: `draft:${status.draftVersion}`,
    label: `Draft v${status.draftVersion}`,
    hint: hasDraftCandidate
      ? "Latest trained unsaved model artifact"
      : "Train a new model to make the draft selectable",
    badge: "Draft",
    modelVersion: status.draftVersion,
    useDraftModel: true,
    disabled: !hasDraftCandidate,
  });

  const seenSavedVersions = new Set<string>([status.activeVersion]);
  for (const entry of status.history) {
    const version = String(entry.savedModelVersion || "").trim();
    if (!version || seenSavedVersions.has(version)) continue;
    seenSavedVersions.add(version);
    items.push({
      key: `saved:${version}`,
      label: `Saved v${version}`,
      hint: entry.versionDescription || "Archived promoted model version",
      badge: "Saved",
      modelVersion: version,
      useDraftModel: false,
    });
  }

  return items;
}

function getModelPickerKeyForRun(run: RecalculateAnalysesResponse | null): string | null {
  const modelVersion = String(run?.selectedModelVersion || "").trim();
  if (!modelVersion) return null;

  return run?.selectedModelSource === "draft"
    ? `draft:${modelVersion}`
    : `saved:${modelVersion}`;
}

function summarizeStatus(items: AnalysisSummary[]) {
  return items.reduce(
    (acc, item) => {
      const status = String(item.status || "").toLowerCase();
      if (status === "completed") acc.completed += 1;
      else if (status === "processing" || status === "pending") acc.inProgress += 1;
      else if (status === "failed" || status === "rejected") acc.failed += 1;
      else acc.other += 1;
      return acc;
    },
    { completed: 0, inProgress: 0, failed: 0, other: 0 },
  );
}

export default function RecalculateMetricsScreen() {
  const insets = useSafeAreaInsets();
  const { returnTo: rawReturnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const { user, isLoading: authLoading } = useAuth();
  const canUseAdminApis = !authLoading && normalizeRole(user?.role) === "admin";

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [recalcRun, setRecalcRun] = useState<RecalculateAnalysesResponse | null>(null);
  const [restoredProgress, setRestoredProgress] = useState<RecalcProgressSnapshot | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModelKey, setSelectedModelKey] = useState<string>("");
  const activeTraceId = recalcRun?.traceId;

  const queuedIdSet = useMemo(
    () => new Set((recalcRun?.queuedAnalysisIds || []).map((id) => String(id))),
    [recalcRun?.queuedAnalysisIds],
  );

  const analysesQuery = useQuery({
    queryKey: ["analyses-summary", "recalc-progress", "all", activeTraceId || "no-trace"],
    queryFn: () => fetchAnalysesSummary({ includeAll: true, traceId: activeTraceId }),
    enabled: canUseAdminApis,
    refetchInterval: recalcRun ? 5000 : false,
  });
  const refetchAnalysesSummary = analysesQuery.refetch;

  const trainingStatusQuery = useQuery({
    queryKey: ["tennis-model-training-status", "recalculate-screen"],
    queryFn: fetchTennisModelTrainingStatus,
    enabled: canUseAdminApis,
  });

  const hasRestoredPersistedStateRef = React.useRef(false);

  const modelOptions = useMemo(
    () => buildModelPickerItems(trainingStatusQuery.data),
    [trainingStatusQuery.data],
  );
  const activeRunModelKey = useMemo(() => getModelPickerKeyForRun(recalcRun), [recalcRun]);

  const defaultModelOption = useMemo(() => modelOptions[0] || null, [modelOptions]);
  const selectedModelOption = useMemo(
    () => modelOptions.find((item) => item.key === selectedModelKey) || defaultModelOption,
    [defaultModelOption, modelOptions, selectedModelKey],
  );

  const queuedAnalyses = useMemo(() => {
    const rows = analysesQuery.data || [];
    if (!queuedIdSet.size) return [] as AnalysisSummary[];
    return rows.filter((item) => queuedIdSet.has(String(item.id)));
  }, [analysesQuery.data, queuedIdSet]);

  const queuedStatus = useMemo(() => summarizeStatus(queuedAnalyses), [queuedAnalyses]);
  const totalQueued = recalcRun?.queuedAnalyses ?? 0;
  const completedQueued = queuedStatus.completed + queuedStatus.failed + queuedStatus.other;
  const progressPct = totalQueued > 0 ? Math.max(0, Math.min(100, Math.round((completedQueued / totalQueued) * 100))) : 0;
  const hasStarted = Boolean(recalcRun);

  const progressSnapshot = useMemo<RecalcProgressSnapshot | null>(() => {
    if (!recalcRun) return null;
    return {
      queuedAnalyses,
      queuedStatus,
      totalQueued,
      completedQueued,
      progressPct,
      updatedAt: new Date().toISOString(),
    };
  }, [completedQueued, progressPct, queuedAnalyses, queuedStatus, recalcRun, totalQueued]);

  const displayQueuedAnalyses = queuedAnalyses.length
    ? queuedAnalyses
    : (restoredProgress?.queuedAnalyses || []);
  const displayQueuedStatus = queuedAnalyses.length
    ? queuedStatus
    : (restoredProgress?.queuedStatus || { completed: 0, inProgress: 0, failed: 0, other: 0 });
  const displayTotalQueued = totalQueued || restoredProgress?.totalQueued || 0;
  const displayCompletedQueued = queuedAnalyses.length
    ? completedQueued
    : (restoredProgress?.completedQueued || 0);
  const displayProgressPct = queuedAnalyses.length
    ? progressPct
    : (restoredProgress?.progressPct || 0);
  const hasLiveProgressData = Boolean(analysesQuery.data);
  const isFinished = hasStarted && hasLiveProgressData && queuedStatus.inProgress === 0;
  const isDisplayFinished = hasStarted && (isFinished || (!hasLiveProgressData && displayQueuedStatus.inProgress === 0 && displayTotalQueued > 0));
  const isRunLocked = hasStarted && !isDisplayFinished;
  const canChangeModelSelection = Boolean(selectedModelOption) && !trainingStatusQuery.isLoading && !isRunLocked;
  const canStartRecalculation = Boolean(selectedModelOption) && !starting && !restoring && !isRunLocked;

  const restorePersistedState = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(RECALC_RUN_STORAGE_KEY);
      if (!raw) {
        setRecalcRun(null);
        setRestoredProgress(null);
        return;
      }

      const parsed = JSON.parse(raw) as PersistedRecalcState | RecalculateAnalysesResponse;
      const nextRun = "run" in parsed ? parsed.run : parsed;
      const nextProgress = "progress" in parsed ? parsed.progress : null;

      if (Array.isArray(nextRun?.queuedAnalysisIds) && nextRun.queuedAnalysisIds.length > 0) {
        setRecalcRun(nextRun);
        setRestoredProgress(nextProgress);
        await refetchAnalysesSummary();
        return;
      }

      setRecalcRun(null);
      setRestoredProgress(null);
      await AsyncStorage.removeItem(RECALC_RUN_STORAGE_KEY).catch(() => {});
    } catch {
      setRecalcRun(null);
      setRestoredProgress(null);
      await AsyncStorage.removeItem(RECALC_RUN_STORAGE_KEY).catch(() => {});
    }
  }, [refetchAnalysesSummary]);

  useEffect(() => {
    if (hasRestoredPersistedStateRef.current) {
      setRestoring(false);
      return;
    }

    hasRestoredPersistedStateRef.current = true;
    let active = true;
    (async () => {
      try {
        await restorePersistedState();
      } finally {
        if (active) setRestoring(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [restorePersistedState]);

  useFocusEffect(
    React.useCallback(() => {
      if (authLoading || !canUseAdminApis) return undefined;
      void restorePersistedState().finally(() => {
        setRestoring(false);
      });
      return undefined;
    }, [authLoading, canUseAdminApis, restorePersistedState]),
  );

  useEffect(() => {
    if (authLoading) return;
    if (!canUseAdminApis) {
      router.replace("/profile");
    }
  }, [authLoading, canUseAdminApis]);

  useEffect(() => {
    if (!recalcRun) {
      AsyncStorage.removeItem(RECALC_RUN_STORAGE_KEY).catch(() => {});
      return;
    }

    const persistedState: PersistedRecalcState = {
      run: recalcRun,
      progress: progressSnapshot || restoredProgress,
    };

    AsyncStorage.setItem(RECALC_RUN_STORAGE_KEY, JSON.stringify(persistedState)).catch(() => {});
  }, [progressSnapshot, recalcRun, restoredProgress]);

  useEffect(() => {
    if (!hasStarted || !isFinished) return;
    AsyncStorage.removeItem(RECALC_RUN_STORAGE_KEY).catch(() => {});
  }, [hasStarted, isFinished]);

  useEffect(() => {
    if (!defaultModelOption) return;

    if (
      isRunLocked
      && activeRunModelKey
      && modelOptions.some((item) => item.key === activeRunModelKey)
      && selectedModelKey !== activeRunModelKey
    ) {
      setSelectedModelKey(activeRunModelKey);
      return;
    }

    if (!selectedModelKey || !modelOptions.some((item) => item.key === selectedModelKey)) {
      setSelectedModelKey(defaultModelOption.key);
    }
  }, [activeRunModelKey, defaultModelOption, isRunLocked, modelOptions, selectedModelKey]);

  useEffect(() => {
    if (isRunLocked && showModelPicker) {
      setShowModelPicker(false);
    }
  }, [isRunLocked, showModelPicker]);

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
    router.replace("/profile/configure");
  };

  const handleStart = async () => {
    if (!canStartRecalculation) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStarting(true);
    setStartError(null);
    try {
      const result = await startAnalysesRecalculation(selectedModelOption
        ? {
            modelVersion: selectedModelOption.modelVersion,
            useDraftModel: selectedModelOption.useDraftModel,
          }
        : undefined);
      setRecalcRun(result);
      setRestoredProgress(null);
      await refetchAnalysesSummary();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start recalculation";
      setStartError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStarting(false);
    }
  };

  const latestQueuedRows = [...displayQueuedAnalyses]
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, 8);

  if (authLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />
        <View style={styles.authLoadingWrap}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.authLoadingText}>Loading admin access...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}> 
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle}>Recalculate Metrics</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Re-run performance scoring</Text>
          <Text style={styles.heroDescription}>
            Start a recalculation run for eligible analyses and monitor progress here until all queued videos finish.
          </Text>

          <View style={styles.modelCard}>
            <Text style={styles.modelCardLabel}>Model version</Text>
            <Pressable
              onPress={() => setShowModelPicker(true)}
              disabled={!canChangeModelSelection}
              style={({ pressed }) => [
                styles.modelPickerButton,
                !canChangeModelSelection && styles.modelPickerButtonDisabled,
                { opacity: pressed && canChangeModelSelection ? 0.88 : 1 },
              ]}
            >
              <View style={styles.modelPickerTextWrap}>
                <Text style={styles.modelPickerTitle}>{selectedModelOption?.label || "Loading versions..."}</Text>
                <Text style={styles.modelPickerHint}>{selectedModelOption?.hint || "Fetching saved and draft versions"}</Text>
              </View>
              <View style={styles.modelPickerTrailing}>
                {selectedModelOption?.badge ? (
                  <View style={styles.modelPickerBadge}>
                    <Text style={styles.modelPickerBadgeText}>{selectedModelOption.badge}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-down" size={18} color="#CBD5E1" />
              </View>
            </Pressable>
            <Text style={styles.modelCardFootnote}>
              Saved versions use archived model artifacts. Draft uses the latest trained unsaved artifact when available.
            </Text>
            {isRunLocked ? (
              <Text style={styles.modelCardLockNote}>Model selection is locked until the current recalculation finishes.</Text>
            ) : null}
            {trainingStatusQuery.isLoading ? (
              <View style={styles.inlineLoadingRow}>
                <ActivityIndicator size="small" color="#38BDF8" />
                <Text style={styles.inlineLoadingText}>Loading model versions...</Text>
              </View>
            ) : null}
            {trainingStatusQuery.isError ? (
              <Text style={styles.modelCardError}>Unable to load model versions right now.</Text>
            ) : null}
          </View>

          {restoring ? (
            <View style={styles.restoreStateWrap}>
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text style={styles.restoreStateText}>Restoring latest recalculation status...</Text>
            </View>
          ) : (
            <>
              {hasStarted ? (
                <View style={styles.runStatusWrap}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressTitle}>{isDisplayFinished ? "Recalculation complete" : "Recalculation in progress"}</Text>
                    <Text style={styles.progressValue}>{displayProgressPct}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${displayProgressPct}%` }]} />
                  </View>
                  <Text style={styles.progressMeta}>
                    {displayCompletedQueued} of {displayTotalQueued} queued analyses finished
                  </Text>
                </View>
              ) : null}

              {!isRunLocked ? (
                <Pressable
                  onPress={handleStart}
                  disabled={!canStartRecalculation}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !canStartRecalculation && styles.primaryButtonDisabled,
                    { opacity: pressed && canStartRecalculation ? 0.85 : 1 },
                  ]}
                >
                  {starting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>{hasStarted ? "Start Another Recalculation" : "Start Recalculation"}</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </>
          )}

          {startError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
              <Text style={styles.errorBannerText}>{startError}</Text>
            </View>
          ) : null}
        </View>

        {hasStarted ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{String(displayTotalQueued)}</Text>
                <Text style={styles.statLabel}>Queued</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#60A5FA" }]}>{String(displayQueuedStatus.inProgress)}</Text>
                <Text style={styles.statLabel}>Running</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#34D399" }]}>{String(displayQueuedStatus.completed)}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#F87171" }]}>{String(displayQueuedStatus.failed)}</Text>
                <Text style={styles.statLabel}>Failed</Text>
              </View>
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Run details</Text>
              <Text style={styles.panelText}>
                Model version: {recalcRun?.selectedModelVersion ? `v${recalcRun.selectedModelVersion}` : selectedModelOption ? `v${selectedModelOption.modelVersion}` : "Current active"}
              </Text>
              <Text style={styles.panelText}>
                Model source: {recalcRun?.selectedModelSource || (selectedModelOption?.useDraftModel ? "draft" : "active")}
              </Text>
              <Text style={styles.panelText}>Auto relinked: {recalcRun?.autoRelinkedAnalyses ?? 0}</Text>
              <Text style={styles.panelText}>Skipped: {recalcRun?.skippedAnalyses ?? 0}</Text>
              <Text style={styles.panelText}>Discrepancy snapshots queued: {recalcRun?.queuedDiscrepancySnapshots ?? 0}</Text>
              <Text style={styles.panelText}>Annotated analyses queued: {recalcRun?.analysesWithAnnotationsQueued ?? 0}</Text>
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Latest queued analyses</Text>
              {analysesQuery.isFetching && !latestQueuedRows.length ? (
                <ActivityIndicator size="small" color="#93C5FD" />
              ) : latestQueuedRows.length > 0 ? (
                <View style={styles.listWrap}>
                  {latestQueuedRows.map((analysis) => (
                    <View key={analysis.id} style={styles.listRow}>
                      <View style={styles.listRowTextWrap}>
                        <Text style={styles.listTitle} numberOfLines={1}>{analysis.videoFilename}</Text>
                        <Text style={styles.listMeta} numberOfLines={1}>{analysis.id}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          analysis.status === "completed"
                            ? styles.statusBadgeCompleted
                            : analysis.status === "processing" || analysis.status === "pending"
                              ? styles.statusBadgeRunning
                              : styles.statusBadgeFailed,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>{analysis.status}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.panelText}>Waiting for queued analyses to appear.</Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <ModelPickerModal
        visible={showModelPicker}
        items={modelOptions}
        selectedKey={selectedModelOption?.key || ""}
        onSelect={(item) => {
          if (item.disabled) return;
          setSelectedModelKey(item.key);
          setShowModelPicker(false);
        }}
        onClose={() => setShowModelPicker(false)}
      />
    </View>
  );
}

function ModelPickerModal({
  visible,
  items,
  selectedKey,
  onSelect,
  onClose,
}: {
  visible: boolean;
  items: ModelPickerItem[];
  selectedKey: string;
  onSelect: (item: ModelPickerItem) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose model version</Text>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            style={styles.modalList}
            renderItem={({ item }) => {
              const isSelected = item.key === selectedKey;
              return (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected, item.disabled && styles.modalItemDisabled]}
                >
                  <View style={styles.modalItemMeta}>
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected, item.disabled && styles.modalItemTextDisabled]}>
                      {item.label}
                    </Text>
                    <Text style={styles.modalItemHint}>{item.hint}</Text>
                  </View>
                  <View style={styles.modalItemTrailing}>
                    {item.badge ? (
                      <View style={styles.modalBadge}>
                        <Text style={styles.modalBadgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                    {isSelected ? <Ionicons name="checkmark-circle" size={22} color="#38BDF8" /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
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
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#131328",
    padding: 18,
    gap: 14,
  },
  authLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  authLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  heroDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  modelCard: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#0E1022",
  },
  modelCardLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#E2E8F0",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modelPickerButton: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#131328",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modelPickerButtonDisabled: {
    opacity: 0.6,
  },
  modelPickerTextWrap: {
    flex: 1,
    gap: 4,
  },
  modelPickerTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  modelPickerHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  modelPickerTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modelPickerBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#155E75",
    backgroundColor: "#082F49",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modelPickerBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#BAE6FD",
    textTransform: "uppercase",
  },
  modelCardFootnote: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  modelCardLockNote: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
    color: "#93C5FD",
  },
  modelCardError: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_500Medium",
    color: "#FCA5A5",
  },
  inlineLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineLoadingText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: "#25637F",
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  restoreStateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
  },
  restoreStateText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  runStatusWrap: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  progressValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#38BDF8",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#0E1022",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A50",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#38BDF8",
  },
  progressMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#7F1D1D",
    backgroundColor: "#3F1111",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_500Medium",
    color: "#FECACA",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#131328",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  panelCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#131328",
    padding: 16,
    gap: 10,
  },
  panelTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  panelText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  listWrap: {
    gap: 8,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    backgroundColor: "#0E1022",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listRowTextWrap: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  listMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeCompleted: {
    borderColor: "#166534",
    backgroundColor: "#052E1A",
  },
  statusBadgeRunning: {
    borderColor: "#1D4ED8",
    backgroundColor: "#0F1F4A",
  },
  statusBadgeFailed: {
    borderColor: "#7F1D1D",
    backgroundColor: "#3F1111",
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#E2E8F0",
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2, 6, 23, 0.66)",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#111827",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#334155",
  },
  modalHeader: {
    paddingTop: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  modalList: {
    maxHeight: 420,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  modalItemSelected: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  modalItemDisabled: {
    opacity: 0.45,
  },
  modalItemMeta: {
    flex: 1,
    gap: 4,
  },
  modalItemTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalItemText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  modalItemTextSelected: {
    color: "#BAE6FD",
  },
  modalItemTextDisabled: {
    color: "#94A3B8",
  },
  modalItemHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  modalBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#155E75",
    backgroundColor: "#082F49",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#BAE6FD",
    textTransform: "uppercase",
  },
});
