import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui/GlassCard";
import { ds } from "@/constants/design-system";

interface CoachingCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  content: string;
  color: string;
}

export function CoachingCard({ icon, title, content, color }: CoachingCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [canExpand, setCanExpand] = React.useState(false);
  const contentText = String(content || "").trim();

  React.useEffect(() => {
    setExpanded(false);
    // Fallback for platforms where onTextLayout may not reveal truncation lines with numberOfLines.
    setCanExpand(contentText.length > 150);
  }, [contentText]);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: color + "14" }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={[styles.title, { color }]}>{title}</Text>
      </View>
      <Text
        style={styles.content}
        numberOfLines={expanded ? undefined : 4}
        onTextLayout={(event) => {
          if (!expanded) {
            const lineCount = event.nativeEvent.lines.length;
            if (lineCount > 4 && !canExpand) {
              setCanExpand(true);
            }
          }
        }}
      >
        {contentText}
      </Text>
      {canExpand ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          style={({ pressed }) => [styles.moreButton, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.moreText, { color }]}>{expanded ? ".. less .." : ".. more .."}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: ds.space.lg,
    borderRadius: ds.radius.lg,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  content: {
    fontSize: 14,
    lineHeight: 21,
    color: ds.color.textSecondary,
  },
  moreButton: {
    alignSelf: "flex-start",
    marginTop: -2,
  },
  moreText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
