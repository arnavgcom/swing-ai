import React from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { fetchAnalyses, deleteAnalysis } from "@/lib/api";
import { AnalysisCard } from "@/components/AnalysisCard";
import { useAuth } from "@/lib/auth-context";

export default function HistoryScreen() {
  const colors = Colors.dark;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: analyses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["analyses"],
    queryFn: fetchAnalyses,
    refetchInterval: 5000,
    enabled: !!user,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleDelete = (id: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Analysis", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const renderItem = ({ item }: { item: (typeof analyses)[0] }) => (
    <View style={styles.cardWrapper}>
      <AnalysisCard
        analysis={item}
        onPress={() =>
          router.push({
            pathname: "/analysis/[id]",
            params: { id: item.id },
          })
        }
      />
      <Pressable
        onPress={() => handleDelete(item.id, item.videoFilename)}
        style={({ pressed }) => [
          styles.deleteBtn,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="trash-outline" size={18} color={colors.red} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0F0F2E", "#0A0A1A"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.header, { paddingTop: insets.top + 16 + webTopInset }]}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          {analyses?.length || 0} analyses
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#6C5CE7" />
        </View>
      ) : (
        <FlatList
          data={analyses || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6C5CE7" />
          }
          scrollEnabled={!!(analyses && analyses.length > 0)}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="folder-open-outline" size={36} color="#475569" />
              </View>
              <Text style={styles.emptyTitle}>No analysis history</Text>
              <Text style={styles.emptyText}>
                Upload and analyze videos to see them here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A1A" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    color: "#94A3B8",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 20,
    gap: 14,
  },
  cardWrapper: {
    position: "relative",
  },
  deleteBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    padding: 6,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#15152D",
    borderWidth: 1,
    borderColor: "#2A2A5060",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#F8FAFC",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
    color: "#64748B",
  },
});
