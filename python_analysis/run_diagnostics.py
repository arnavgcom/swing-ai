#!/usr/bin/env python3
import argparse
import json
import os
import traceback
from collections import Counter
from typing import Any, Dict, List, Optional

import numpy as np
from python_analysis.analysis_artifact import load_analysis_artifact
from python_analysis.skeleton_store import build_skeleton_dataset


def _has_strong_backhand_evidence(reasons: List[str]) -> bool:
    strong = {
        "cross_body_motion",
        "opposite_side_contact_profile",
        "median_contact_opposite_side",
    }
    return any(str(r) in strong for r in reasons)


def _has_strong_forehand_evidence(reasons: List[str]) -> bool:
    strong = {
        "right_wrist_speed_dominant",
        "left_wrist_speed_dominant",
        "same_side_contact_profile",
        "median_contact_same_side",
    }
    return any(str(r) in strong for r in reasons)


def _apply_tennis_temporal_smoothing(shot_segments: List[Dict[str, Any]]) -> None:
    tennis_labels = {"forehand", "backhand"}
    n = len(shot_segments)
    if n < 3:
        return

    labels = [str(s.get("label", "unknown")) for s in shot_segments]

    def _confidence(i: int) -> float:
        return float(shot_segments[i].get("confidence", 0.0))

    def _reasons(i: int) -> List[str]:
        dbg = shot_segments[i].get("classificationDebug", {}) or {}
        return [str(r) for r in dbg.get("reasons", [])]

    def _try_flip(i: int, target_label: str, conf_limit: float) -> None:
        if labels[i] not in tennis_labels or target_label not in tennis_labels:
            return
        if labels[i] == target_label:
            return
        if _confidence(i) > conf_limit:
            return
        # Keep very high-confidence labels stable, but allow temporal cleanup
        # for medium-confidence outliers in repetitive drills.
        if _has_strong_backhand_evidence(_reasons(i)) and labels[i] == "backhand":
            if _confidence(i) >= 0.97:
                return
        if _has_strong_forehand_evidence(_reasons(i)) and labels[i] == "forehand":
            if _confidence(i) >= 0.97:
                return

        shot = shot_segments[i]
        shot["label"] = target_label
        dbg = shot.get("classificationDebug", {}) or {}
        reasons = list(dbg.get("reasons", []))
        reasons.append("temporal_consistency_normalized")
        dbg["reasons"] = reasons
        shot["classificationDebug"] = dbg
        labels[i] = target_label

    for i in range(1, n - 1):
        prev_label = labels[i - 1]
        next_label = labels[i + 1]
        cur_label = labels[i]
        if (
            prev_label in tennis_labels
            and next_label in tennis_labels
            and cur_label in tennis_labels
            and prev_label == next_label
            and cur_label != prev_label
        ):
            _try_flip(i, prev_label, 0.96)

    if labels[0] in tennis_labels and labels[1] in tennis_labels and labels[2] in tennis_labels:
        if labels[1] == labels[2] and labels[0] != labels[1]:
            _try_flip(0, labels[1], 0.82)

    if labels[-1] in tennis_labels and labels[-2] in tennis_labels and labels[-3] in tennis_labels:
        if labels[-2] == labels[-3] and labels[-1] != labels[-2]:
            _try_flip(n - 1, labels[-2], 0.82)


def _apply_tennis_auto_detect_majority_normalization(shot_segments: List[Dict[str, Any]]) -> None:
    tennis_labels = {"forehand", "backhand"}
    labeled = [
        s for s in shot_segments
        if str(s.get("label", "unknown")) in tennis_labels
    ]
    total = len(labeled)
    if total < 6:
        return

    forehands = [s for s in labeled if str(s.get("label")) == "forehand"]
    backhands = [s for s in labeled if str(s.get("label")) == "backhand"]

    if len(forehands) >= len(backhands):
        target_label = "forehand"
        opposite = backhands
    else:
        target_label = "backhand"
        opposite = forehands

    target_ratio = max(len(forehands), len(backhands)) / max(total, 1)
    if target_ratio < 0.66 or len(opposite) > 2:
        return

    opposite_strong = [
        s for s in opposite
        if float(s.get("confidence", 0.0)) >= 0.97
    ]
    if opposite_strong:
        return

    for s in opposite:
        s["label"] = target_label
        dbg = s.get("classificationDebug", {}) or {}
        reasons = list(dbg.get("reasons", []))
        reasons.append("auto_detect_majority_normalized")
        dbg["reasons"] = reasons
        s["classificationDebug"] = dbg


def _build_analysis_fps_snapshot(
    artifact: Optional[Dict[str, Any]],
    effective_fps: float,
) -> Optional[Dict[str, Any]]:
    if not artifact:
        return None

    raw_snapshot = artifact.get("analysisFpsSnapshot")
    if isinstance(raw_snapshot, dict):
        return {
            "effectiveStep": str(raw_snapshot.get("effectiveStep") or raw_snapshot.get("effectiveMode") or artifact.get("analysisFpsMode") or "step1"),
            "sampleStep": int(raw_snapshot.get("sampleStep") or 1),
            "effectiveFps": round(float(raw_snapshot.get("effectiveFps") or artifact.get("fps") or effective_fps), 2),
            "sourceFps": round(float(raw_snapshot.get("sourceFps") or artifact.get("sourceFps") or effective_fps), 2),
            "lowImpactStep": str(raw_snapshot.get("lowImpactStep")) if raw_snapshot.get("lowImpactStep") else None,
            "highImpactStep": str(raw_snapshot.get("highImpactStep")) if raw_snapshot.get("highImpactStep") else None,
            "tennisAutoDetectUsesHighImpact": raw_snapshot.get("tennisAutoDetectUsesHighImpact")
            if "tennisAutoDetectUsesHighImpact" in raw_snapshot
            else None,
            "tennisMatchPlayUsesHighImpact": raw_snapshot.get("tennisMatchPlayUsesHighImpact")
            if "tennisMatchPlayUsesHighImpact" in raw_snapshot
            else None,
            "routingReason": str(raw_snapshot.get("routingReason")) if raw_snapshot.get("routingReason") else None,
        }

    legacy_mode = artifact.get("analysisFpsMode")
    legacy_source_fps = artifact.get("sourceFps")
    if legacy_mode is not None or legacy_source_fps is not None:
        return {
            "effectiveStep": str(legacy_mode or "step1"),
            "sampleStep": 1,
            "effectiveFps": round(float(artifact.get("fps") or effective_fps), 2),
            "sourceFps": round(float(legacy_source_fps or effective_fps), 2),
            "lowImpactStep": None,
            "highImpactStep": None,
            "tennisAutoDetectUsesHighImpact": None,
            "tennisMatchPlayUsesHighImpact": None,
            "routingReason": None,
        }

    return None


def _estimate_quality(
    frame_width: int,
    frame_height: int,
    fps: float,
    avg_brightness: float,
    avg_blur: float,
) -> str:
    score = 0

    pixels = frame_width * frame_height
    if pixels >= 1920 * 1080:
        score += 2
    elif pixels >= 1280 * 720:
        score += 1

    if fps >= 50:
        score += 2
    elif fps >= 24:
        score += 1

    if 45 <= avg_brightness <= 200:
        score += 1

    if avg_blur >= 120:
        score += 2
    elif avg_blur >= 60:
        score += 1

    if score >= 6:
        return "Excellent"
    if score >= 4:
        return "Good"
    if score >= 2:
        return "Fair"
    return "Poor"


def _build_rationale(
    sport: str,
    detected_movement: str,
    movement_counts: Dict[str, int],
    features: Dict,
) -> str:
    reasons: List[str] = []

    if movement_counts:
        dominant_count = movement_counts.get(detected_movement, 0)
        total_segments = sum(movement_counts.values())
        if total_segments > 0:
            reasons.append(
                f"{detected_movement} was dominant in {dominant_count}/{total_segments} detected shot segments"
            )

    if features.get("is_serve"):
        reasons.append("serve-like toss and overhead motion pattern detected")

    if features.get("is_cross_body"):
        reasons.append("cross-body swing path detected")

    if features.get("is_compact_forward"):
        reasons.append("compact forward stroke signature detected")

    if features.get("is_overhead"):
        reasons.append("overhead contact pattern detected")

    if not reasons:
        return f"Classified as {detected_movement} based on shot pattern consistency for {sport}."

    return f"Classified as {detected_movement} because " + "; ".join(reasons) + "."


def _to_top_candidates(
    dominant_movement: str,
    movement_counts: Dict[str, int],
) -> List[Dict[str, Any]]:
    total = sum(movement_counts.values())
    if total <= 0:
      return [{"label": dominant_movement, "confidencePct": 100.0}]

    ranked = sorted(movement_counts.items(), key=lambda item: item[1], reverse=True)[:3]
    return [
        {
            "label": label,
            "confidencePct": round((count / total) * 100.0, 1),
        }
        for label, count in ranked
    ]


def _compute_ai_confidence_pct(
    validation_confidence: float,
    top_candidates: List[Dict[str, Any]],
    pose_coverage_pct: float,
    wrist_occlusion_pct: float,
    shoulder_occlusion_pct: float,
    shots_considered_for_scoring: int,
) -> float:
    validation_pct = max(0.0, min(100.0, validation_confidence * 100.0))

    top1 = top_candidates[0]["confidencePct"] if len(top_candidates) > 0 else 50.0
    top2 = top_candidates[1]["confidencePct"] if len(top_candidates) > 1 else 0.0
    separation = max(0.0, top1 - top2)

    occlusion_avg = (wrist_occlusion_pct + shoulder_occlusion_pct) / 2.0

    confidence = (
        validation_pct * 0.45
        + top1 * 0.30
        + separation * 0.10
        + pose_coverage_pct * 0.10
        + (100.0 - occlusion_avg) * 0.05
    )

    if shots_considered_for_scoring <= 1:
        confidence *= 0.90

    return round(max(0.0, min(99.5, confidence)), 1)


def _compute_hip_rotation_deg_per_sec(pose_data: List[Optional[Dict[str, Any]]], fps: float) -> Optional[float]:
    if fps <= 0:
        return None

    angular_velocities: List[float] = []
    prev_angle: Optional[float] = None

    for pose in pose_data:
        if pose is None:
            prev_angle = None
            continue

        left_hip = pose.get("left_hip")
        right_hip = pose.get("right_hip")
        if not left_hip or not right_hip:
            prev_angle = None
            continue

        # Use a relaxed threshold so partially occluded hips can still contribute.
        if left_hip.get("visibility", 0.0) <= 0.2 or right_hip.get("visibility", 0.0) <= 0.2:
            prev_angle = None
            continue

        dx = float(right_hip["x"]) - float(left_hip["x"])
        dy = float(right_hip["y"]) - float(left_hip["y"])
        angle = float(np.degrees(np.arctan2(dy, dx)))

        if prev_angle is not None:
            # Wrap to [-180, 180] to avoid artificial jumps at angle boundaries.
            delta = abs(((angle - prev_angle + 180.0) % 360.0) - 180.0)
            vel = delta * fps
            if 0.0 < vel < 2000.0:
                angular_velocities.append(float(vel))

        prev_angle = angle

    if not angular_velocities:
        return None

    value = float(np.percentile(angular_velocities, 85))
    return float(np.clip(value, 150.0, 1400.0))


def _wrist_point(pose: Dict[str, Any]) -> Optional[Dict[str, float]]:
    candidates = [pose.get("right_wrist"), pose.get("left_wrist")]
    visible = [w for w in candidates if w and float(w.get("visibility", 0.0)) > 0.2]
    if not visible:
        return None
    return max(visible, key=lambda w: float(w.get("visibility", 0.0)))


def _landmark_visible(pose: Dict[str, Any], key: str, threshold: float = 0.2) -> bool:
    point = pose.get(key)
    return bool(point and float(point.get("visibility", 0.0)) > threshold)


def _midpoint(a: Dict[str, float], b: Dict[str, float]) -> Dict[str, float]:
    return {
        "x": (float(a["x"]) + float(b["x"])) * 0.5,
        "y": (float(a["y"]) + float(b["y"])) * 0.5,
    }


def _distance(a: Dict[str, float], b: Dict[str, float]) -> float:
    dx = float(a["x"]) - float(b["x"])
    dy = float(a["y"]) - float(b["y"])
    return float(np.hypot(dx, dy))


def _angle_deg(a: Dict[str, float], b: Dict[str, float], c: Dict[str, float]) -> Optional[float]:
    # Returns angle ABC in degrees.
    bax = float(a["x"]) - float(b["x"])
    bay = float(a["y"]) - float(b["y"])
    bcx = float(c["x"]) - float(b["x"])
    bcy = float(c["y"]) - float(b["y"])

    mag_ba = float(np.hypot(bax, bay))
    mag_bc = float(np.hypot(bcx, bcy))
    if mag_ba <= 1e-6 or mag_bc <= 1e-6:
        return None

    dot = bax * bcx + bay * bcy
    cos_theta = float(np.clip(dot / (mag_ba * mag_bc), -1.0, 1.0))
    return float(np.degrees(np.arccos(cos_theta)))


def _dominant_side_from_pose_data(pose_data: List[Optional[Dict[str, Any]]]) -> str:
    right_scores: List[float] = []
    left_scores: List[float] = []

    prev_rw: Optional[Dict[str, float]] = None
    prev_lw: Optional[Dict[str, float]] = None

    for pose in pose_data:
        if pose is None:
            prev_rw = None
            prev_lw = None
            continue

        rw = pose.get("right_wrist")
        lw = pose.get("left_wrist")

        if rw and float(rw.get("visibility", 0.0)) > 0.2:
            if prev_rw is not None:
                right_scores.append(_distance(rw, prev_rw))
            prev_rw = rw
        else:
            prev_rw = None

        if lw and float(lw.get("visibility", 0.0)) > 0.2:
            if prev_lw is not None:
                left_scores.append(_distance(lw, prev_lw))
            prev_lw = lw
        else:
            prev_lw = None

    right_energy = float(np.percentile(right_scores, 80)) if right_scores else 0.0
    left_energy = float(np.percentile(left_scores, 80)) if left_scores else 0.0
    return "right" if right_energy >= left_energy else "left"


def _compute_contact_distance_ratio(
    pose_data: List[Optional[Dict[str, Any]]],
    shot_segments: List[Dict[str, Any]],
) -> Optional[float]:
    values: List[float] = []
    dominant = _dominant_side_from_pose_data(pose_data)
    wrist_key = "right_wrist" if dominant == "right" else "left_wrist"

    preferred_segments = [seg for seg in shot_segments if seg.get("includedForScoring")]
    candidate_segments = preferred_segments if preferred_segments else shot_segments

    for seg in candidate_segments:
        start = int(seg.get("startFrame", -1))
        end = int(seg.get("endFrame", -1))
        if start < 0 or end < 0 or end <= start:
            continue

        best_idx: Optional[int] = None
        best_speed = -1.0
        prev_wrist: Optional[Dict[str, float]] = None

        for idx in range(start, end + 1):
            pose = pose_data[idx] if 0 <= idx < len(pose_data) else None
            if pose is None or not _landmark_visible(pose, wrist_key):
                prev_wrist = None
                continue
            wrist = pose[wrist_key]
            if prev_wrist is not None:
                speed = _distance(wrist, prev_wrist)
                if speed > best_speed:
                    best_speed = speed
                    best_idx = idx
            prev_wrist = wrist

        if best_idx is None:
            continue

        pose = pose_data[best_idx]
        if pose is None:
            continue
        if not (_landmark_visible(pose, "left_shoulder") and _landmark_visible(pose, "right_shoulder") and _landmark_visible(pose, wrist_key)):
            continue

        left_shoulder = pose["left_shoulder"]
        right_shoulder = pose["right_shoulder"]
        shoulder_mid = _midpoint(left_shoulder, right_shoulder)
        shoulder_width = _distance(left_shoulder, right_shoulder)
        if shoulder_width <= 1e-6:
            continue

        ratio = _distance(pose[wrist_key], shoulder_mid) / shoulder_width
        if np.isfinite(ratio):
            values.append(float(ratio))

    if not values:
        return None
    return float(np.clip(float(np.median(values)), 0.2, 1.6))


def _compute_knee_bend_angle_deg(pose_data: List[Optional[Dict[str, Any]]]) -> Optional[float]:
    values: List[float] = []

    for pose in pose_data:
        if pose is None:
            continue

        for side in ("left", "right"):
            hip_key = f"{side}_hip"
            knee_key = f"{side}_knee"
            ankle_key = f"{side}_ankle"
            if not (_landmark_visible(pose, hip_key) and _landmark_visible(pose, knee_key) and _landmark_visible(pose, ankle_key)):
                continue
            angle = _angle_deg(pose[hip_key], pose[knee_key], pose[ankle_key])
            if angle is None:
                continue
            if 20.0 <= angle <= 180.0:
                values.append(float(angle))

    if not values:
        return None
    # Use lower percentile to capture loaded knee bend rather than upright frames.
    return float(np.clip(float(np.percentile(values, 35)), 25.0, 140.0))


def _compute_racket_lag_proxy_angle_deg(pose_data: List[Optional[Dict[str, Any]]]) -> Optional[float]:
    dominant = _dominant_side_from_pose_data(pose_data)
    side = "right" if dominant == "right" else "left"
    shoulder_key = f"{side}_shoulder"
    elbow_key = f"{side}_elbow"
    wrist_key = f"{side}_wrist"

    lag_values: List[float] = []
    for pose in pose_data:
        if pose is None:
            continue
        if not (_landmark_visible(pose, shoulder_key) and _landmark_visible(pose, elbow_key) and _landmark_visible(pose, wrist_key)):
            continue
        elbow_angle = _angle_deg(pose[shoulder_key], pose[elbow_key], pose[wrist_key])
        if elbow_angle is None:
            continue
        lag_proxy = 180.0 - elbow_angle
        if np.isfinite(lag_proxy):
            lag_values.append(float(lag_proxy))

    if not lag_values:
        return None
    return float(np.clip(float(np.percentile(lag_values, 75)), 8.0, 85.0))


def _compute_stance_angle_deg(
    pose_data: List[Optional[Dict[str, Any]]],
    shot_segments: List[Dict[str, Any]],
) -> Optional[float]:
    values: List[float] = []
    preferred_segments = [seg for seg in shot_segments if seg.get("includedForScoring")]
    candidate_segments = preferred_segments if preferred_segments else shot_segments

    def _append_from_idx(idx: int) -> None:
        pose = pose_data[idx] if 0 <= idx < len(pose_data) else None
        if pose is None:
            return
        if not (_landmark_visible(pose, "left_ankle") and _landmark_visible(pose, "right_ankle")):
            return
        left_ankle = pose["left_ankle"]
        right_ankle = pose["right_ankle"]
        dx = float(right_ankle["x"]) - float(left_ankle["x"])
        dy = float(right_ankle["y"]) - float(left_ankle["y"])
        if abs(dx) <= 1e-6 and abs(dy) <= 1e-6:
            return
        angle = abs(float(np.degrees(np.arctan2(dy, dx))))
        if angle > 90.0:
            angle = 180.0 - angle
        if np.isfinite(angle):
            values.append(float(angle))

    for seg in candidate_segments:
        start = int(seg.get("startFrame", -1))
        end = int(seg.get("endFrame", -1))
        if start < 0 or end < 0 or end < start:
            continue
        mid = int((start + end) * 0.5)
        _append_from_idx(mid)

    if not values:
        for idx in range(0, len(pose_data), max(1, len(pose_data) // 40 or 1)):
            _append_from_idx(idx)

    if not values:
        return None
    return float(np.clip(float(np.median(values)), 5.0, 80.0))


def _wrist_speeds_series(
    pose_data: List[Optional[Dict[str, Any]]],
    fps: float,
) -> List[Optional[float]]:
    dominant = _dominant_side_from_pose_data(pose_data)
    wrist_key = "right_wrist" if dominant == "right" else "left_wrist"
    speeds: List[Optional[float]] = [None] * len(pose_data)
    prev: Optional[Dict[str, float]] = None

    for idx, pose in enumerate(pose_data):
        if pose is None or not _landmark_visible(pose, wrist_key):
            prev = None
            continue
        wrist = pose[wrist_key]
        if prev is not None:
            speeds[idx] = _distance(wrist, prev) * max(fps, 1e-6)
        prev = wrist
    return speeds


def _compute_split_step_time_sec(
    pose_data: List[Optional[Dict[str, Any]]],
    shot_segments: List[Dict[str, Any]],
    fps: float,
) -> Optional[float]:
    if fps <= 0:
        return None

    left_prev: Optional[Dict[str, float]] = None
    right_prev: Optional[Dict[str, float]] = None
    ankle_speed: List[Optional[float]] = [None] * len(pose_data)

    for idx, pose in enumerate(pose_data):
        if pose is None:
            left_prev = None
            right_prev = None
            continue

        left_ok = _landmark_visible(pose, "left_ankle")
        right_ok = _landmark_visible(pose, "right_ankle")
        current_values: List[float] = []

        if left_ok:
            left_now = pose["left_ankle"]
            if left_prev is not None:
                current_values.append(_distance(left_now, left_prev) * fps)
            left_prev = left_now
        else:
            left_prev = None

        if right_ok:
            right_now = pose["right_ankle"]
            if right_prev is not None:
                current_values.append(_distance(right_now, right_prev) * fps)
            right_prev = right_now
        else:
            right_prev = None

        if current_values:
            ankle_speed[idx] = float(np.mean(current_values))

    valid_speeds = [s for s in ankle_speed if s is not None]
    if len(valid_speeds) < 6:
        return None

    baseline = float(np.percentile(valid_speeds, 35))
    trigger = max(0.03, baseline * 1.8)
    pre_window_frames = max(3, int(round(0.55 * fps)))

    values: List[float] = []
    preferred_segments = [seg for seg in shot_segments if seg.get("includedForScoring")]
    candidate_segments = preferred_segments if preferred_segments else shot_segments
    for seg in candidate_segments:
        start = int(seg.get("startFrame", -1))
        if start <= 0:
            continue
        win_start = max(1, start - pre_window_frames)
        hit_idx: Optional[int] = None
        for idx in range(start - 1, win_start - 1, -1):
            s = ankle_speed[idx]
            if s is None:
                continue
            if s >= trigger:
                hit_idx = idx
            else:
                if hit_idx is not None:
                    break

        if hit_idx is None:
            continue
        delta_sec = (start - hit_idx) / fps
        values.append(float(delta_sec))

    if not values:
        return None
    return float(np.clip(float(np.median(values)), 0.08, 0.70))


def _compute_recovery_time_sec(
    pose_data: List[Optional[Dict[str, Any]]],
    shot_segments: List[Dict[str, Any]],
    fps: float,
) -> Optional[float]:
    if fps <= 0:
        return None

    speeds = _wrist_speeds_series(pose_data, fps)
    valid = [s for s in speeds if s is not None]
    if len(valid) < 8:
        return None

    settle_threshold = max(0.04, float(np.percentile(valid, 35)) * 1.2)
    max_window_frames = max(4, int(round(1.8 * fps)))

    values: List[float] = []
    preferred_segments = [seg for seg in shot_segments if seg.get("includedForScoring")]
    candidate_segments = preferred_segments if preferred_segments else shot_segments

    for seg in candidate_segments:
        end = int(seg.get("endFrame", -1))
        if end < 0:
            continue

        settle_idx: Optional[int] = None
        consec = 0
        for idx in range(end + 1, min(len(speeds), end + 1 + max_window_frames)):
            s = speeds[idx]
            if s is None:
                consec = 0
                continue
            if s <= settle_threshold:
                consec += 1
                if consec >= 3:
                    settle_idx = idx
                    break
            else:
                consec = 0

        if settle_idx is None:
            continue

        values.append(float((settle_idx - end) / fps))

    if not values:
        return None
    return float(np.clip(float(np.median(values)), 0.35, 3.5))


def _compute_segment_reaction_ms(
    pose_data: List[Optional[Dict[str, Any]]],
    start_frame: int,
    end_frame: int,
    fps: float,
) -> Optional[float]:
    if fps <= 0 or end_frame <= start_frame:
        return None

    speeds: List[float] = []
    prev_wrist: Optional[Dict[str, float]] = None

    for idx in range(start_frame, end_frame + 1):
        pose = pose_data[idx] if 0 <= idx < len(pose_data) else None
        if pose is None:
            prev_wrist = None
            continue

        wrist = _wrist_point(pose)
        if wrist is None:
            prev_wrist = None
            continue

        if prev_wrist is not None:
            dx = float(wrist["x"]) - float(prev_wrist["x"])
            dy = float(wrist["y"]) - float(prev_wrist["y"])
            speed = float(np.hypot(dx, dy) * fps)
            speeds.append(speed)

        prev_wrist = wrist

    if len(speeds) < 3:
        return None

    baseline_window = max(2, min(6, len(speeds) // 3))
    baseline = float(np.median(speeds[:baseline_window]))
    trigger = max(0.05, baseline * 1.9)

    trigger_idx = None
    for i in range(1, len(speeds)):
        if speeds[i] >= trigger and (speeds[i - 1] >= trigger * 0.75 or speeds[i] >= trigger * 1.25):
            trigger_idx = i
            break

    if trigger_idx is None:
        return None

    reaction_ms = (trigger_idx / fps) * 1000.0
    return float(np.clip(reaction_ms, 80.0, 900.0))


def _compute_global_reaction_time_ms(
    pose_data: List[Optional[Dict[str, Any]]],
    fps: float,
) -> Optional[float]:
    if fps <= 0:
        return None

    speeds: List[float] = []
    prev_wrist: Optional[Dict[str, float]] = None
    prev_valid_idx: Optional[int] = None
    onset_idx: Optional[int] = None

    for idx, pose in enumerate(pose_data):
        if pose is None:
            prev_wrist = None
            prev_valid_idx = None
            continue

        wrist = _wrist_point(pose)
        if wrist is None:
            prev_wrist = None
            prev_valid_idx = None
            continue

        if prev_wrist is not None and prev_valid_idx is not None:
            dx = float(wrist["x"]) - float(prev_wrist["x"])
            dy = float(wrist["y"]) - float(prev_wrist["y"])
            speed = float(np.hypot(dx, dy) * fps)
            speeds.append(speed)

            if len(speeds) >= 3 and onset_idx is None:
                baseline = float(np.median(speeds[: min(6, len(speeds))]))
                trigger = max(0.05, baseline * 1.9)
                if speed >= trigger:
                    onset_idx = idx

        prev_wrist = wrist
        prev_valid_idx = idx

    if onset_idx is None:
        return None

    reaction_ms = (onset_idx / fps) * 1000.0
    return float(np.clip(reaction_ms, 80.0, 900.0))


def _compute_reaction_time_ms(
    pose_data: List[Optional[Dict[str, Any]]],
    shot_segments: List[Dict[str, Any]],
    fps: float,
) -> Optional[float]:
    values: List[float] = []
    preferred_segments = [seg for seg in shot_segments if seg.get("includedForScoring")]
    candidate_segments = preferred_segments if preferred_segments else shot_segments

    for seg in candidate_segments:

        start = int(seg.get("startFrame", -1))
        end = int(seg.get("endFrame", -1))
        if start < 0 or end < 0:
            continue

        segment_reaction = _compute_segment_reaction_ms(pose_data, start, end, fps)
        if segment_reaction is not None:
            values.append(segment_reaction)

    if not values:
        return _compute_global_reaction_time_ms(pose_data, fps)

    return float(np.clip(float(np.median(values)), 120.0, 700.0))


def main():
    parser = argparse.ArgumentParser(description="Swing AI diagnostics")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--sport", default="tennis", help="Sport name")
    parser.add_argument("--movement", default="forehand", help="Movement name")
    parser.add_argument("--dominant-profile", default="", help="Player dominant side: right or left")
    parser.add_argument("--analysis-artifact", default="", help="Path to shared analysis artifact")
    args = parser.parse_args()

    sport = args.sport.lower().replace(" ", "").replace("_", "")
    movement = args.movement.lower().replace(" ", "-").replace("_", "-")
    dominant_profile = args.dominant_profile.lower().strip()
    preferred_dominant_side = dominant_profile if dominant_profile in ("right", "left") else None

    try:
        import cv2
        from python_analysis.pose_detector import PoseDetector
        from python_analysis.movement_classifier import (
            classify_movement,
            classify_segment_movement,
            classify_segment_movement_with_diagnostics,
            validate_sport_match,
            _segment_swings,
            _extract_features,
        )

        if not os.path.exists(args.video_path):
            raise FileNotFoundError(f"Video does not exist: {args.video_path}")
        artifact = load_analysis_artifact(args.analysis_artifact) if args.analysis_artifact else None

        analysis_fps_snapshot = _build_analysis_fps_snapshot(artifact, 30.0)

        if artifact:
            file_size_bytes = int(artifact.get("fileSizeBytes") or os.path.getsize(args.video_path))
            fps = float(artifact.get("fps") or 30.0)
            frame_width = int(artifact.get("frameWidth") or 0)
            frame_height = int(artifact.get("frameHeight") or 0)
            total_frames = int(artifact.get("totalFrames") or 0)
            analysis_fps_snapshot = _build_analysis_fps_snapshot(artifact, fps)
            duration_seconds = float(
                artifact.get("durationSec")
                or ((total_frames / fps) if fps > 0 and total_frames > 0 else 0.0)
            )
            avg_brightness = float(artifact.get("avgBrightness") or 0.0)
            avg_blur = float(artifact.get("avgBlur") or 0.0)
            pose_data = list(artifact.get("poseData") or [])
            full_pose_landmarks_per_frame = list(artifact.get("fullPoseLandmarksPerFrame") or [])
            validation = dict(artifact.get("validation") or {})
            shot_segments = list(artifact.get("shotSegments") or [])
            shot_count = int(artifact.get("shotCount") or len(shot_segments))
            dominant_movement = str(artifact.get("detectedMovement") or movement)
        else:
            file_size_bytes = os.path.getsize(args.video_path)

            cap = cv2.VideoCapture(args.video_path)
            if not cap.isOpened():
                raise ValueError(f"Cannot open video: {args.video_path}")

            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            duration_seconds = (total_frames / fps) if fps > 0 and total_frames > 0 else 0.0

            sampled_brightness: List[float] = []
            sampled_blur: List[float] = []
            sample_step = max(1, total_frames // 30) if total_frames > 0 else 1
            frame_index = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                if frame_index % sample_step == 0:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    sampled_brightness.append(float(gray.mean()))
                    sampled_blur.append(float(cv2.Laplacian(gray, cv2.CV_64F).var()))
                frame_index += 1
            cap.release()

            avg_brightness = float(sum(sampled_brightness) / len(sampled_brightness)) if sampled_brightness else 0.0
            avg_blur = float(sum(sampled_blur) / len(sampled_blur)) if sampled_blur else 0.0

            detector = PoseDetector()
            cap2 = cv2.VideoCapture(args.video_path)
            pose_data: List[Optional[Dict]] = []
            full_pose_landmarks_per_frame: List[List[Dict[str, Any]]] = []
            while True:
                ret, frame = cap2.read()
                if not ret:
                    break
                landmarks, full_landmarks = detector.detect_with_skeleton(frame)
                pose_data.append(landmarks)
                full_pose_landmarks_per_frame.append(full_landmarks)
            cap2.release()
            detector.close()

            validation = validate_sport_match(
                pose_data,
                sport,
                fps,
                frame_width,
                frame_height,
                bg_features=None,
            )

            dominant_movement, shot_count = classify_movement(
                pose_data,
                sport,
                fps,
                frame_width,
                frame_height,
                preferred_dominant_side,
            )

            segments = _segment_swings(pose_data, fps, frame_width, frame_height)
            shot_segments = []

            for seg_idx, (start, end) in enumerate(segments):
                segment_data = pose_data[start : end + 1]
                valid_segment = [p for p in segment_data if p is not None]
                if len(valid_segment) < 3:
                    shot_segments.append(
                        {
                            "index": seg_idx + 1,
                            "startFrame": int(start),
                            "endFrame": int(end),
                            "label": "unknown",
                            "frames": len(segment_data),
                            "includedForScoring": False,
                        }
                    )
                    continue

                cls = classify_segment_movement(
                    segment_data,
                    sport,
                    fps,
                    frame_width,
                    frame_height,
                    preferred_dominant_side,
                )
                diag = classify_segment_movement_with_diagnostics(
                    segment_data,
                    sport,
                    fps,
                    frame_width,
                    frame_height,
                    preferred_dominant_side,
                )
                cls = str(diag.get("label", cls))
                segment_features = _extract_features(
                    segment_data,
                    fps,
                    frame_width,
                    frame_height,
                    preferred_dominant_side,
                )
                shot_segments.append(
                    {
                        "index": seg_idx + 1,
                        "startFrame": int(start),
                        "endFrame": int(end),
                        "label": cls,
                        "rawLabel": cls,
                        "confidence": float(diag.get("confidence", 0.0)),
                        "frames": len(segment_data),
                        "includedForScoring": False,
                        "classificationDebug": {
                            "dominantSide": segment_features.get("dominant_side"),
                            "isCrossBody": bool(segment_features.get("is_cross_body", False)),
                            "isServe": bool(segment_features.get("is_serve", False)),
                            "isCompactForward": bool(segment_features.get("is_compact_forward", False)),
                            "isOverhead": bool(segment_features.get("is_overhead", False)),
                            "isDownwardMotion": bool(segment_features.get("is_downward_motion", False)),
                            "maxWristSpeed": round(float(segment_features.get("max_wrist_speed", 0.0)), 4),
                            "rightWristSpeed": round(float(segment_features.get("max_rw_speed", 0.0)), 4),
                            "leftWristSpeed": round(float(segment_features.get("max_lw_speed", 0.0)), 4),
                            "swingArcRatio": round(float(segment_features.get("swing_arc_ratio", 0.0)), 4),
                            "contactHeightRatio": round(float(segment_features.get("contact_height_ratio", 0.0)), 4),
                            "reasons": list(diag.get("reasons", [])),
                        },
                    }
                )

            target_drill_label = movement if movement in ("forehand", "backhand") else ""

            if sport == "tennis" and target_drill_label in ("forehand", "backhand"):
                opposite = "backhand" if target_drill_label == "forehand" else "forehand"
                labeled_strokes = [
                    str(s.get("label", "unknown"))
                    for s in shot_segments
                    if str(s.get("label", "unknown")) in ("forehand", "backhand")
                ]
                target_count = sum(1 for label in labeled_strokes if label == target_drill_label)
                opposite_count = sum(1 for label in labeled_strokes if label == opposite)
                total_labeled = len(labeled_strokes)
                target_ratio = (target_count / max(total_labeled, 1)) if total_labeled else 0.0
                opposite_confident = [
                    s for s in shot_segments
                    if str(s.get("label", "unknown")) == opposite and float(s.get("confidence", 0.0)) >= 0.90
                ]

                should_normalize = (
                    total_labeled >= 6
                    and target_ratio >= 0.65
                    and opposite_count <= 2
                    and len(opposite_confident) == 0
                )

                if should_normalize:
                    for s in shot_segments:
                        if str(s.get("label", "unknown")) == opposite:
                            s["label"] = target_drill_label
                            dbg = s.get("classificationDebug", {})
                            reasons = list(dbg.get("reasons", []))
                            reasons.append("drill_prior_normalized")
                            dbg["reasons"] = reasons
                            s["classificationDebug"] = dbg

                if total_labeled <= 4:
                    for i, s in enumerate(shot_segments):
                        if i not in (0, len(shot_segments) - 1):
                            continue
                        label = str(s.get("label", "unknown"))
                        confidence = float(s.get("confidence", 0.0))
                        dbg = s.get("classificationDebug", {}) or {}
                        reasons = [str(r) for r in dbg.get("reasons", [])]
                        if label != opposite or confidence >= 0.82:
                            continue
                        if target_drill_label == "forehand" and _has_strong_backhand_evidence(reasons):
                            continue
                        if target_drill_label == "backhand" and _has_strong_forehand_evidence(reasons):
                            continue
                        s["label"] = target_drill_label
                        updated_dbg = s.get("classificationDebug", {}) or {}
                        updated_reasons = list(updated_dbg.get("reasons", []))
                        updated_reasons.append("short_drill_confidence_normalized")
                        updated_dbg["reasons"] = updated_reasons
                        s["classificationDebug"] = updated_dbg

            if sport == "tennis" and movement == "auto-detect":
                _apply_tennis_auto_detect_majority_normalization(shot_segments)

            if sport == "tennis":
                _apply_tennis_temporal_smoothing(shot_segments)

        valid_pose_frames = sum(1 for p in pose_data if p is not None)

        visible_wrist_frames = 0
        visible_shoulder_frames = 0
        valid_pose_list = [p for p in pose_data if p is not None]
        for pose in valid_pose_list:
            rw = pose.get("right_wrist")
            lw = pose.get("left_wrist")
            rs = pose.get("right_shoulder")
            ls = pose.get("left_shoulder")

            wrist_visible = (
                (rw and rw.get("visibility", 0) > 0.4)
                or (lw and lw.get("visibility", 0) > 0.4)
            )
            shoulder_visible = (
                (rs and rs.get("visibility", 0) > 0.4)
                or (ls and ls.get("visibility", 0) > 0.4)
            )

            if wrist_visible:
                visible_wrist_frames += 1
            if shoulder_visible:
                visible_shoulder_frames += 1

        excluded_shot_reasons: List[str] = []

        movement_per_segment: List[str] = [
            str(seg.get("label", "unknown"))
            for seg in shot_segments
            if str(seg.get("label", "unknown")) != "unknown"
        ]
        movement_counts = dict(Counter(movement_per_segment))
        dominant_movement_for_report = dominant_movement
        if movement_counts:
            dominant_movement_for_report = max(movement_counts, key=movement_counts.get)

        scoring_frames = 0
        for seg in shot_segments:
            included_for_scoring = str(seg.get("label", "unknown")) == dominant_movement_for_report
            seg["includedForScoring"] = included_for_scoring
            segment_valid_frames = int(seg.get("frames", 0))
            if included_for_scoring:
                scoring_frames += segment_valid_frames
            else:
                excluded_shot_reasons.append(
                    f"Shot {seg.get('index')} excluded: labeled {seg.get('label')}, dominant movement is {dominant_movement_for_report}"
                )

        top_candidates = _to_top_candidates(dominant_movement_for_report, movement_counts)

        total_frame_count = int(total_frames if total_frames > 0 else len(pose_data))
        active_frame_count = int(sum((seg["endFrame"] - seg["startFrame"] + 1) for seg in shot_segments if seg.get("includedForScoring")))
        active_frame_count = max(0, min(active_frame_count, total_frame_count))
        idle_frame_count = max(0, total_frame_count - active_frame_count)

        active_time_sec = (active_frame_count / fps) if fps > 0 else 0.0
        idle_time_sec = (idle_frame_count / fps) if fps > 0 else 0.0

        active_time_pct = (active_frame_count / max(total_frame_count, 1)) * 100.0
        idle_time_pct = (idle_frame_count / max(total_frame_count, 1)) * 100.0

        pose_coverage_pct = round(
            (valid_pose_frames / max(len(pose_data), 1)) * 100.0,
            1,
        )
        wrist_occlusion_pct = round(
            100.0 - ((visible_wrist_frames / max(len(valid_pose_list), 1)) * 100.0),
            1,
        )
        shoulder_occlusion_pct = round(
            100.0 - ((visible_shoulder_frames / max(len(valid_pose_list), 1)) * 100.0),
            1,
        )

        shots_considered_for_scoring = int(
            len([s for s in shot_segments if s.get("includedForScoring")])
        )

        ai_confidence_pct = _compute_ai_confidence_pct(
            float(validation.get("confidence", 0.0)),
            top_candidates,
            pose_coverage_pct,
            wrist_occlusion_pct,
            shoulder_occlusion_pct,
            shots_considered_for_scoring,
        )

        features = _extract_features(
            pose_data,
            fps,
            frame_width,
            frame_height,
            preferred_dominant_side,
        )
        rationale = _build_rationale(sport, dominant_movement_for_report, movement_counts, features)

        hip_rotation = _compute_hip_rotation_deg_per_sec(pose_data, fps)
        reaction_time = _compute_reaction_time_ms(pose_data, shot_segments, fps)
        contact_distance = _compute_contact_distance_ratio(pose_data, shot_segments)
        knee_bend_angle = _compute_knee_bend_angle_deg(pose_data)
        racket_lag_angle = _compute_racket_lag_proxy_angle_deg(pose_data)
        recovery_time = _compute_recovery_time_sec(pose_data, shot_segments, fps)
        split_step_time = _compute_split_step_time_sec(pose_data, shot_segments, fps)
        stance_angle = _compute_stance_angle_deg(pose_data, shot_segments)

        bitrate_kbps = (
            (file_size_bytes * 8 / 1000.0) / duration_seconds
            if duration_seconds > 0
            else 0.0
        )

        diagnostics = {
            "videoDurationSec": round(float(duration_seconds), 2),
            "videoQuality": _estimate_quality(frame_width, frame_height, fps, avg_brightness, avg_blur),
            "fps": round(float(fps), 2),
            "analysisFps": analysis_fps_snapshot,
            "resolution": {
                "width": frame_width,
                "height": frame_height,
            },
            "fileSizeBytes": int(file_size_bytes),
            "bitrateKbps": round(float(bitrate_kbps), 2),
            "totalFrames": total_frame_count,
            "framesUsedForMetrics": int(valid_pose_frames),
            "framesConsideredForScoring": int(scoring_frames if scoring_frames > 0 else valid_pose_frames),
            "activeTimeSec": round(float(active_time_sec), 2),
            "idleTimeSec": round(float(idle_time_sec), 2),
            "activeTimePct": round(float(active_time_pct), 1),
            "idleTimePct": round(float(idle_time_pct), 1),
            "poseCoveragePct": pose_coverage_pct,
            "wristOcclusionPct": wrist_occlusion_pct,
            "shoulderOcclusionPct": shoulder_occlusion_pct,
            "shotsDetected": int(shot_count),
            "shotsConsideredForScoring": shots_considered_for_scoring,
            "shotSegments": shot_segments,
            "skeletonData": build_skeleton_dataset(
                video_id=os.path.basename(args.video_path),
                shot_segments=shot_segments,
                frame_landmarks=full_pose_landmarks_per_frame,
                fps=float(fps),
            ),
            "excludedShots": {
                "count": int(len([s for s in shot_segments if not s.get("includedForScoring")])),
                "reasons": excluded_shot_reasons,
            },
            "movementTypeCounts": movement_counts,
            "aiConfidencePct": ai_confidence_pct,
            "detectedMovement": dominant_movement_for_report,
            "classificationRationale": rationale,
            "computedMetrics": {
                "hipRotation": round(hip_rotation, 2) if hip_rotation is not None else None,
                "reactionTime": round(reaction_time, 2) if reaction_time is not None else None,
                "contactDistance": round(contact_distance, 3) if contact_distance is not None else None,
                "kneeBendAngle": round(knee_bend_angle, 2) if knee_bend_angle is not None else None,
                "racketLagAngle": round(racket_lag_angle, 2) if racket_lag_angle is not None else None,
                "recoveryTime": round(recovery_time, 3) if recovery_time is not None else None,
                "splitStepTime": round(split_step_time, 3) if split_step_time is not None else None,
                "stanceAngle": round(stance_angle, 2) if stance_angle is not None else None,
            },
            "validation": {
                "valid": bool(validation.get("valid", True)),
                "confidence": float(validation.get("confidence", 0.0)),
                "reason": str(validation.get("reason", "")),
            },
        }

        print(json.dumps(diagnostics))

    except Exception as e:
        print(
            json.dumps(
                {
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                }
            ),
            file=sys.stderr,
        )
        raise


if __name__ == "__main__":
    import sys

    try:
        main()
        sys.exit(0)
    except Exception:
        sys.exit(1)
