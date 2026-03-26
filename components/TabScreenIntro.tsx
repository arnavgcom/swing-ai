import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ds } from "@/constants/design-system";

type TabScreenIntroProps = {
  title: string;
  subtitle: string;
  titleColor?: string;
  subtitleColor?: string;
  subtitleMaxWidth?: number;
  controls?: React.ReactNode;
  children?: React.ReactNode;
};

type TabScreenFilterGroupProps = {
  label: string;
  labelColor?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

type TabScreenFilterRowProps = {
  children: React.ReactNode;
};

export function TabScreenIntro({
  title,
  subtitle,
  titleColor = ds.color.textPrimary,
  subtitleColor = ds.color.textTertiary,
  subtitleMaxWidth = 620,
  controls,
  children,
}: TabScreenIntroProps) {
  const hasControls = React.Children.toArray(controls).length > 0;
  const hasFilters = React.Children.toArray(children).length > 0;

  return (
    <View>
      <View style={styles.headerSection}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: subtitleColor, maxWidth: subtitleMaxWidth }]}>
          {subtitle}
        </Text>
        {hasControls ? <View style={styles.controlsRow}>{controls}</View> : null}
      </View>

      {hasFilters ? <View style={styles.filterSection}>{children}</View> : null}
    </View>
  );
}

export function TabScreenFilterGroup({
  label,
  labelColor = ds.color.textSecondary,
  action,
  children,
}: TabScreenFilterGroupProps) {
  const hasAction = React.Children.toArray(action).length > 0;

  return (
    <View style={styles.filterGroup}>
      <View style={hasAction ? styles.filterHeaderRow : undefined}>
        <Text style={[styles.filterLabel, { color: labelColor }]}>{label}</Text>
        {hasAction ? action : null}
      </View>
      {children}
    </View>
  );
}

export function TabScreenFilterRow({ children }: TabScreenFilterRowProps) {
  return <View style={styles.filterChipRow}>{children}</View>;
}

const styles = StyleSheet.create({
  headerSection: {
    marginTop: ds.space.xl,
    marginBottom: ds.space.lg,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  filterSection: {
    gap: ds.space.md,
    marginBottom: ds.space.xl,
  },
  filterGroup: {
    gap: ds.space.sm,
  },
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ds.space.md,
  },
  filterLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: ds.space.sm,
  },
});