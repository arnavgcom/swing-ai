import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { apiRequest } from "@/lib/query-client";
import { fetchSportConfig } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import {
  buildMetricOptionsWithCatalog,
  getCanonical25MetricOptions,
  normalizeMetricSelectionKey,
} from "@/lib/metrics-catalog";

const SCORE_SECTION_OPTIONS = [
  "Technical (Biomechanics)",
  "Tactical",
  "Movement",
];

const DEFAULT_SELECTED_METRIC_KEYS = [
  "ballSpeed",
  "shoulderRotation",
  "spinRate",
  "kneeBendAngle",
].map((key) => normalizeMetricSelectionKey(key));

const LEGACY_SECTION_LABEL_MAP: Record<string, string> = {
  "performance breakdown": "Tactical",
  biomechanics: "Technical (Biomechanics)",
};

const mapLegacySectionLabel = (value: string): string => {
  const normalized = String(value || "").trim().toLowerCase();
  return LEGACY_SECTION_LABEL_MAP[normalized] || value;
};

type SelectionOption = {
  key: string;
  label: string;
};

type SportOption = {
  id: string;
  name: string;
};

const formatMetricLabelFromKey = (metricKey: string): string => {
  if (!metricKey) return metricKey;
  const spaced = metricKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const FALLBACK_METRIC_OPTIONS: SelectionOption[] = getCanonical25MetricOptions().map((metric) => ({
  key: metric.key,
  label: metric.label || formatMetricLabelFromKey(metric.key),
}));

const DEFAULT_MOVEMENT_BY_SPORT: Record<string, string> = {
  tennis: "forehand",
  golf: "drive",
  pickleball: "dink",
  paddle: "forehand",
  badminton: "clear",
  tabletennis: "forehand",
};

const MOVEMENT_ALIASES: Record<string, string> = {
  "iron-shot": "iron",
};

const toConfigToken = (value?: string | null): string => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const buildConfigKey = (sportName?: string | null, movementName?: string | null): string | null => {
  const sportToken = toConfigToken(sportName).replace(/-/g, "");
  if (!sportToken) return null;

  const movementToken = toConfigToken(movementName);
  const resolvedMovement = movementToken || DEFAULT_MOVEMENT_BY_SPORT[sportToken];
  if (!resolvedMovement) return null;

  return `${sportToken}-${MOVEMENT_ALIASES[resolvedMovement] ?? resolvedMovement}`;
};

const toSportPreferenceKey = (sportName?: string | null): string =>
  toConfigToken(sportName).replace(/-/g, "");

export default function ScoreMetricsSelectionScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { selectedSport } = useSport();

  const [showScoreSectionPicker, setShowScoreSectionPicker] = useState(false);
  const [showMetricPicker, setShowMetricPicker] = useState(false);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [selectedScoreSections, setSelectedScoreSections] = useState<string[]>([]);
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<string[]>([]);
  const [metricOptions, setMetricOptions] = useState<SelectionOption[]>(FALLBACK_METRIC_OPTIONS);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [selectedSportName, setSelectedSportName] = useState<string>(selectedSport?.name || "");
  const [saving, setSaving] = useState(false);

  const activeConfigKey = useMemo(
    () => buildConfigKey(selectedSportName, null),
    [selectedSportName],
  );

  const selectedSportKey = useMemo(
    () => toSportPreferenceKey(selectedSportName),
    [selectedSportName],
  );

  const metricLabelByKey = useMemo(() => {
    return metricOptions.reduce<Record<string, string>>((acc, item) => {
      acc[item.key] = item.label;
      return acc;
    }, {});
  }, [metricOptions]);

  const sortedSelectedMetricKeys = useMemo(() => {
    return [...selectedMetricKeys].sort((a, b) => {
      const labelA = metricLabelByKey[a] || formatMetricLabelFromKey(a);
      const labelB = metricLabelByKey[b] || formatMetricLabelFromKey(b);
      return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
    });
  }, [metricLabelByKey, selectedMetricKeys]);

  useEffect(() => {
    let cancelled = false;

    const loadSports = async () => {
      try {
        const res = await apiRequest("GET", "/api/sports");
        const list = await res.json();
        if (cancelled || !Array.isArray(list)) return;

        const options = list
          .map((item) => ({ id: String(item.id || ""), name: String(item.name || "").trim() }))
          .filter((item) => item.id && item.name)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        setSports(options);

        if (!selectedSportName && options.length > 0) {
          setSelectedSportName(selectedSport?.name || options[0].name);
        }
      } catch {
        if (!cancelled && !selectedSportName && selectedSport?.name) {
          setSelectedSportName(selectedSport.name);
        }
      }
    };

    loadSports();
    return () => {
      cancelled = true;
    };
  }, [selectedSport?.name, selectedSportName]);

  useEffect(() => {
    let cancelled = false;

    const loadMetricOptions = async () => {
      if (!activeConfigKey) {
        setMetricOptions(FALLBACK_METRIC_OPTIONS);
        return;
      }

      try {
        const config = await fetchSportConfig(activeConfigKey);
        if (cancelled) return;

        const options = buildMetricOptionsWithCatalog(config.metrics || [])
          .map((metric) => ({
            key: metric.key,
            label: String(metric.label || "").trim() || formatMetricLabelFromKey(String(metric.key || "")),
          }))
          .filter((metric) => metric.key.length > 0)
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

        setMetricOptions(options.length > 0 ? options : FALLBACK_METRIC_OPTIONS);
      } catch {
        if (!cancelled) {
          setMetricOptions(FALLBACK_METRIC_OPTIONS);
        }
      }
    };

    loadMetricOptions();
    return () => {
      cancelled = true;
    };
  }, [activeConfigKey]);

  useEffect(() => {
    const scoreMap =
      user?.selectedScoreSectionsBySport && typeof user.selectedScoreSectionsBySport === "object"
        ? user.selectedScoreSectionsBySport
        : {};
    const metricMap =
      user?.selectedMetricKeysBySport && typeof user.selectedMetricKeysBySport === "object"
        ? user.selectedMetricKeysBySport
        : {};

    const scopedSections = selectedSportKey ? scoreMap[selectedSportKey] : null;
    const fallbackSections = Array.isArray(user?.selectedScoreSections) ? user.selectedScoreSections : [];
    const baseSections = Array.isArray(scopedSections) && scopedSections.length > 0
      ? scopedSections
      : fallbackSections;

    setSelectedScoreSections(
      baseSections.length > 0
        ? Array.from(new Set(baseSections.map(mapLegacySectionLabel)))
        : SCORE_SECTION_OPTIONS,
    );

    const scopedMetrics = selectedSportKey ? metricMap[selectedSportKey] : null;
    const fallbackMetrics = Array.isArray(user?.selectedMetricKeys) ? user.selectedMetricKeys : [];
    const baseMetrics = Array.isArray(scopedMetrics) ? scopedMetrics : fallbackMetrics;

    setSelectedMetricKeys(
      baseMetrics.length > 0
        ? Array.from(
            new Set(
              baseMetrics
                .map((item) => normalizeMetricSelectionKey(item))
                .filter((item) => item.length > 0),
            ),
          )
        : DEFAULT_SELECTED_METRIC_KEYS,
    );
  }, [selectedSportKey, user]);

  const toggleScoreSection = (label: string) => {
    setSelectedScoreSections((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const toggleMetricKey = (key: string) => {
    setSelectedMetricKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const saveSelection = async () => {
    if (!user) {
      Alert.alert("Error", "User session not found.");
      return;
    }
    if (!selectedSportKey) {
      Alert.alert("Select sport", "Please select a sport first.");
      return;
    }
    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const scoreSectionsToPersist = Array.from(
        new Set(selectedScoreSections.filter((item) => SCORE_SECTION_OPTIONS.includes(item))),
      );
      const allowedMetricKeys = new Set(metricOptions.map((item) => item.key));
      const metricKeysToPersist = Array.from(
        new Set(
          selectedMetricKeys
            .map((item) => normalizeMetricSelectionKey(item))
            .filter((item) => item.length > 0)
            .filter((item) => allowedMetricKeys.has(item)),
        ),
      );

      const dominantProfileValue =
        typeof user.dominantProfile === "string" && user.dominantProfile.trim().length > 0
          ? user.dominantProfile.trim()
          : "";

      await apiRequest("PUT", "/api/profile", {
        name: user.name,
        phone: user.phone ?? "",
        country: user.country ?? "",
        dominantProfile: dominantProfileValue,
        role: String(user.role || "").trim().toLowerCase() === "admin" ? "admin" : "player",
        selectedSportKey,
        selectedScoreSections: scoreSectionsToPersist,
        selectedMetricKeys: metricKeysToPersist,
      });
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Failed to save score and metric selection.";
      Alert.alert("Error", reason);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.backButton}
          testID="score-metrics-back"
        >
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle}>Score/Metrics Selection</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Sport</Text>
          <Pressable
            onPress={() => setShowSportPicker(true)}
            style={styles.fieldInput}
            testID="field-selected-sport"
          >
            <Ionicons name="football-outline" size={18} color="#6C5CE7" />
            <Text style={[styles.dropdownText, !selectedSportName && styles.dropdownPlaceholder]}>
              {selectedSportName || "Select sport"}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748B" />
          </Pressable>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Performance Score Sections</Text>
          <Pressable
            onPress={() => setShowScoreSectionPicker(true)}
            style={styles.fieldInput}
            testID="field-score-sections"
          >
            <Ionicons name="layers-outline" size={18} color="#6C5CE7" />
            <Text style={[styles.dropdownText, selectedScoreSections.length === 0 && styles.dropdownPlaceholder]}>
              {selectedScoreSections.length > 0
                ? `${selectedScoreSections.length} selected`
                : "Select score sections"}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748B" />
          </Pressable>
          {selectedScoreSections.length > 0 ? (
            <View style={styles.chipRow}>
              {selectedScoreSections.map((item) => (
                <View key={item} style={styles.chip}>
                  <Text style={styles.chipText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Selected Metrics</Text>
          <Text style={styles.fieldHint}>
            {activeConfigKey
              ? `Using ${activeConfigKey} metrics`
              : "Using default metric list"}
          </Text>
          <Pressable
            onPress={() => setShowMetricPicker(true)}
            style={styles.fieldInput}
            testID="field-selected-metrics"
          >
            <Ionicons name="options-outline" size={18} color="#6C5CE7" />
            <Text style={[styles.dropdownText, selectedMetricKeys.length === 0 && styles.dropdownPlaceholder]}>
              {selectedMetricKeys.length > 0
                ? `${selectedMetricKeys.length} selected`
                : `Select metrics (${metricOptions.length} available)`}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#64748B" />
          </Pressable>
          {sortedSelectedMetricKeys.length > 0 ? (
            <View style={styles.chipRow}>
              {sortedSelectedMetricKeys.map((item) => (
                <View key={item} style={styles.chip}>
                  <Text style={styles.chipText}>{metricLabelByKey[item] || formatMetricLabelFromKey(item)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={saveSelection}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: saving ? 0.7 : 1 },
          ]}
          testID="save-score-metrics-selection"
        >
          <View style={styles.saveContent}>
            {saving ? (
              <ActivityIndicator size="small" color="#6C5CE7" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#6C5CE7" />
                <Text style={styles.saveText}>Save</Text>
              </>
            )}
          </View>
        </Pressable>
      </ScrollView>

      <PickerModal
        visible={showSportPicker}
        title="Select Sport"
        items={sports.map((sport) => ({ key: sport.name, label: sport.name }))}
        selectedItems={selectedSportName ? [selectedSportName] : []}
        multiSelect={false}
        onSelect={(sportName) => {
          setSelectedSportName(sportName);
          setShowSportPicker(false);
        }}
        onClose={() => setShowSportPicker(false)}
      />

      <PickerModal
        visible={showScoreSectionPicker}
        title="Select Score Sections"
        items={SCORE_SECTION_OPTIONS.map((section) => ({ key: section, label: section }))}
        selectedItems={selectedScoreSections}
        multiSelect
        onSelect={toggleScoreSection}
        onClose={() => setShowScoreSectionPicker(false)}
      />

      <PickerModal
        visible={showMetricPicker}
        title="Select Metrics"
        items={metricOptions}
        selectedItems={selectedMetricKeys}
        multiSelect
        onSelect={toggleMetricKey}
        onClose={() => setShowMetricPicker(false)}
      />
    </View>
  );
}

function PickerModal({
  visible,
  title,
  items,
  selectedItems,
  multiSelect,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: SelectionOption[];
  selectedItems: string[];
  multiSelect: boolean;
  onSelect: (item: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}
          onPress={() => {}}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            {multiSelect && (
              <Pressable onPress={onClose} style={styles.modalDoneButton}>
                <Text style={styles.modalDoneText}>Done</Text>
              </Pressable>
            )}
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            scrollEnabled={items.length > 6}
            style={styles.modalList}
            renderItem={({ item }) => {
              const isSelected = selectedItems.includes(item.key);
              return (
                <Pressable
                  onPress={() => onSelect(item.key)}
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {item.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#6C5CE7" />
                  )}
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
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
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
  fieldWrapper: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#131328",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A50",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 14 : 12,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#F8FAFC",
  },
  dropdownPlaceholder: {
    color: "#4A4A6A",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6C5CE720",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#6C5CE740",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#A29BFE",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#6C5CE740",
    backgroundColor: "#6C5CE720",
    borderRadius: 14,
    marginTop: 10,
  },
  saveContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  saveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#131328",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: "84%",
    minHeight: 430,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4A4A6A",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A50",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  modalDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#6C5CE720",
  },
  modalDoneText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#6C5CE7",
  },
  modalList: {
    paddingHorizontal: 12,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  modalItemSelected: {
    backgroundColor: "#6C5CE715",
  },
  modalItemText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  modalItemTextSelected: {
    color: "#F8FAFC",
    fontFamily: "Inter_600SemiBold",
  },
});
