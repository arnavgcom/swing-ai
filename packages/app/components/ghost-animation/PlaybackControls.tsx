import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ds } from "@/constants/design-system";
import Slider from "@react-native-community/slider";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  speed: number;
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 1];

export function PlaybackControls({
  isPlaying,
  currentFrame,
  totalFrames,
  speed,
  onTogglePlay,
  onSeek,
  onSpeedChange,
}: PlaybackControlsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.scrubberRow}>
        <Pressable onPress={onTogglePlay} style={styles.playButton} testID="ghost-play-pause">
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={22}
            color={ds.color.textPrimary}
          />
        </Pressable>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={Math.max(totalFrames - 1, 1)}
          value={currentFrame}
          onValueChange={(v) => onSeek(Math.round(v))}
          minimumTrackTintColor="#6C5CE7"
          maximumTrackTintColor="rgba(255,255,255,0.2)"
          thumbTintColor="#6C5CE7"
          testID="ghost-scrubber"
        />

        <Text style={styles.frameLabel}>
          {currentFrame + 1}/{totalFrames}
        </Text>
      </View>

      <View style={styles.speedRow}>
        {SPEED_OPTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => onSpeedChange(s)}
            style={[styles.speedButton, speed === s && styles.speedButtonActive]}
            testID={`ghost-speed-${s}`}
          >
            <Text style={[styles.speedText, speed === s && styles.speedTextActive]}>
              {s}x
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  scrubberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  slider: {
    flex: 1,
    height: 40,
  },
  frameLabel: {
    color: "#AEAEB2",
    fontSize: 12,
    fontWeight: "500",
    minWidth: 52,
    textAlign: "right",
  },
  speedRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  speedButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: ds.radius.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  speedButtonActive: {
    backgroundColor: "rgba(125,211,252,0.2)",
    borderColor: "rgba(125,211,252,0.65)",
  },
  speedText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  speedTextActive: {
    color: "#E0F2FE",
  },
});
