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
          minimumTrackTintColor="#60A5FA"
          maximumTrackTintColor="rgba(255,255,255,0.2)"
          thumbTintColor="#60A5FA"
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
    paddingVertical: 12,
  },
  scrubberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  slider: {
    flex: 1,
    height: 40,
  },
  frameLabel: {
    color: ds.color.textTertiary,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    minWidth: 52,
    textAlign: "right",
  },
  speedRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  speedButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: ds.radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  speedButtonActive: {
    backgroundColor: "rgba(96,165,250,0.15)",
    borderColor: "#60A5FA",
  },
  speedText: {
    color: ds.color.textTertiary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  speedTextActive: {
    color: "#60A5FA",
  },
});
