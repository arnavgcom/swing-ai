import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface CoachingCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  content: string;
  color: string;
}

export function CoachingCard({ icon, title, content, color }: CoachingCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [canExpand, setCanExpand] = React.useState(false);

  React.useEffect(() => {
    setExpanded(false);
    setCanExpand(false);
  }, [content]);

  return (
    <View style={styles.card}>
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
        {content}
      </Text>
      {canExpand ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          style={({ pressed }) => [styles.moreButton, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.moreText, { color }]}>{expanded ? ".. less .." : ".. more .."}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A5060",
    backgroundColor: "#15152D",
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
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  content: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    color: "#CBD5E1",
  },
  moreButton: {
    alignSelf: "flex-start",
    marginTop: -2,
  },
  moreText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
