import React from "react";
import { StyleSheet, Text, View, Pressable, Image, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { useSport } from "@/lib/sport-context";
import { sportColors } from "@/constants/colors";
import { resolveClientMediaUrl } from "@/lib/media";
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
  label?: string;
  labelColor?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

type TabScreenFilterRowProps = {
  children: React.ReactNode;
};

function hasRenderableContent(node: React.ReactNode): boolean {
  return React.Children.toArray(node).some((child) => {
    if (child == null || typeof child === "boolean") return false;
    if (typeof child === "string") return child.trim().length > 0;
    if (typeof child === "number") return true;

    if (React.isValidElement(child) && child.type === React.Fragment) {
      return hasRenderableContent((child.props as { children?: React.ReactNode }).children);
    }

    return true;
  });
}

export function TabScreenIntro({
  title,
  subtitle,
  titleColor = ds.color.textPrimary,
  subtitleColor = ds.color.textTertiary,
  subtitleMaxWidth = 620,
  controls,
  children,
}: TabScreenIntroProps) {
  const hasControls = hasRenderableContent(controls);
  const hasFilters = hasRenderableContent(children);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useAuth();
  const { selectedSport } = useSport();
  const sc = sportColors[selectedSport?.name || ""] || { primary: "#0A84FF", gradient: "#5A4BD1" };
  const avatarUrl = resolveClientMediaUrl(user?.avatarUrl);
  const avatarSource = avatarUrl ? { uri: avatarUrl } : null;
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View>
      <View style={[styles.headerSection, { paddingTop: insets.top + 8 + webTopInset }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: titleColor, flex: 1 }]}>{title}</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: "/profile",
                params: pathname ? { returnTo: pathname } : undefined,
              });
            }}
            style={[
              styles.iconCircle,
              avatarSource && {
                borderColor: sc.primary,
                borderWidth: 2,
              },
            ]}
          >
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={16} color={sc.primary} />
            )}
          </Pressable>
        </View>
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
  const hasHeader = label || hasAction;

  return (
    <View style={styles.filterGroup}>
      {hasHeader ? (
        <View style={hasAction ? styles.filterHeaderRow : undefined}>
          {label ? <Text style={[styles.filterLabel, { color: labelColor }]}>{label}</Text> : null}
          {hasAction ? action : null}
        </View>
      ) : hasAction ? (
        <View style={styles.filterHeaderRow}>
          <View />
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function TabScreenFilterRow({ children }: TabScreenFilterRowProps) {
  return <View style={styles.filterChipRow}>{children}</View>;
}

const styles = StyleSheet.create({
  headerSection: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ds.space.md,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: ds.radius.pill,
    backgroundColor: ds.color.glass,
    borderWidth: 1,
    borderColor: ds.color.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...ds.shadow.subtle,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: ds.radius.pill,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
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
    fontWeight: "600",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: ds.space.sm,
  },
});