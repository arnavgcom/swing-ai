import React from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  useColorScheme,
  Platform,
  Pressable,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { fetchAnalyses, deleteAnalysis } from "@/lib/api";
import { AnalysisCard } from "@/components/AnalysisCard";

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["analyses"],
    queryFn: fetchAnalyses,
    refetchInterval: 5000,
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16 + webTopInset }]}>
        <Text style={[styles.title, { color: colors.text }]}>History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {analyses?.length || 0} analyses
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={analyses || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 100 },
          ]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          scrollEnabled={!!(analyses && analyses.length > 0)}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="folder-open-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No analysis history
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Upload and analyze forehand videos to see them here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 20,
    gap: 10,
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
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
