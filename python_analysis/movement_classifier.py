import math
import numpy as np
from typing import Any, Dict, List, Optional, Tuple

from python_analysis.tennis_movement_model import predict_tennis_movement


SPORT_MOVEMENTS = {
    "tennis": ["forehand", "backhand", "serve", "volley", "game"],
    "pickleball": ["dink", "drive", "serve", "volley", "third-shot-drop"],
    "paddle": ["forehand", "backhand", "serve", "smash", "bandeja"],
    "badminton": ["clear", "smash", "drop", "net-shot", "serve"],
    "tabletennis": ["forehand", "backhand", "serve", "loop", "chop"],
    "golf": ["drive", "iron", "chip", "putt", "full-swing"],
}

RACQUET_SPORTS = {"tennis", "pickleball", "paddle", "badminton", "tabletennis"}

MIN_VALID_POSES = 5
MIN_WRIST_SPEED_RACQUET = 0.08
MIN_SWING_ARC_RACQUET = 0.05
MIN_WRIST_SPEED_GOLF = 0.04
MIN_SWING_ARC_GOLF = 0.03

TENNIS_MIN_PROMINENT_FRAME_RATIO = 0.12
TENNIS_MIN_MEDIAN_BODY_AREA_RATIO = 0.014
TENNIS_MIN_LARGE_BODY_AREA_RATIO = 0.028
TENNIS_MIN_DISTANT_MEDIAN_BODY_AREA_RATIO = 0.006
TENNIS_MIN_DISTANT_P75_BODY_AREA_RATIO = 0.0075
TENNIS_MIN_DISTANT_MAX_BODY_AREA_RATIO = 0.012

TENNIS_MODEL_CONFIDENCE_THRESHOLD = 0.58
TENNIS_MODEL_MARGIN_THRESHOLD = 0.06


def _compute_body_presence_metrics(
    pose_data: List[Optional[Dict]],
    frame_width: int,
    frame_height: int,
) -> Dict[str, float]:
    if frame_width <= 0 or frame_height <= 0:
        return {
            "median_area_ratio": 0.0,
            "p75_area_ratio": 0.0,
            "max_area_ratio": 0.0,
            "prominent_frame_ratio": 0.0,
        }

    frame_area = float(frame_width * frame_height)
    area_ratios: List[float] = []
    prominent_frames = 0
    valid_frames = 0

    for pose in pose_data:
        if pose is None:
            continue

        visible_points = []
        for landmark in pose.values():
            if landmark and landmark.get("visibility", 0) > 0.45:
                visible_points.append((float(landmark["x"]), float(landmark["y"])))

        if len(visible_points) < 6:
            continue

        valid_frames += 1
        xs = [point[0] for point in visible_points]
        ys = [point[1] for point in visible_points]
        width = max(xs) - min(xs)
        height = max(ys) - min(ys)
        if width <= 0 or height <= 0:
            continue

        area_ratio = (width * height) / frame_area
        area_ratios.append(area_ratio)
        if area_ratio >= TENNIS_MIN_LARGE_BODY_AREA_RATIO:
            prominent_frames += 1

    if not area_ratios or valid_frames == 0:
        return {
            "median_area_ratio": 0.0,
            "p75_area_ratio": 0.0,
            "max_area_ratio": 0.0,
            "prominent_frame_ratio": 0.0,
        }

    return {
        "median_area_ratio": float(np.median(area_ratios)),
        "p75_area_ratio": float(np.percentile(area_ratios, 75)),
        "max_area_ratio": float(np.max(area_ratios)),
        "prominent_frame_ratio": float(prominent_frames) / float(valid_frames),
    }


def validate_sport_match(
    pose_data: List[Optional[Dict]],
    sport: str,
    fps: float = 30.0,
    frame_width: int = 1920,
    frame_height: int = 1080,
    bg_features: Optional[Dict] = None,
) -> Dict:
    sport = sport.lower().replace(" ", "").replace("_", "")

    valid_poses = [p for p in pose_data if p is not None]
    total_frames = len(pose_data)
    min_required = max(MIN_VALID_POSES, int(total_frames * 0.1))

    if len(valid_poses) < min_required:
        return {
            "valid": False,
            "reason": "No human body detected in the video. Please upload a video where you are clearly visible.",
            "confidence": 0.0,
        }

    wrist_visible = 0
    shoulder_visible = 0
    for p in valid_poses:
        rw = p.get("right_wrist")
        lw = p.get("left_wrist")
        rs = p.get("right_shoulder")
        ls = p.get("left_shoulder")
        if (rw and rw.get("visibility", 0) > 0.4) or (lw and lw.get("visibility", 0) > 0.4):
            wrist_visible += 1
        if (rs and rs.get("visibility", 0) > 0.4) or (ls and ls.get("visibility", 0) > 0.4):
            shoulder_visible += 1

    if wrist_visible < min_required:
        return {
            "valid": False,
            "reason": "Could not clearly see your arms/hands in the video. Please ensure your upper body is visible.",
            "confidence": 0.1,
        }

    if shoulder_visible < min_required:
        return {
            "valid": False,
            "reason": "Could not clearly detect your shoulders. Please ensure your upper body is fully visible.",
            "confidence": 0.1,
        }

    features = _extract_features(pose_data, fps, frame_width, frame_height)

    sport_label = sport
    if sport in ("tabletennis",):
        sport_label = "table tennis"

    if sport == "tennis":
        body_presence = _compute_body_presence_metrics(pose_data, frame_width, frame_height)
        if bg_features is None or not bg_features.get("sufficient", False):
            return {
                "valid": False,
                "reason": "A tennis court was not clearly detected. Upload a video where the player is visible on an actual tennis court.",
                "confidence": 0.0,
            }

        green = float(bg_features.get("green_ratio", 0.0))
        brown = float(bg_features.get("brown_ratio", 0.0))
        blue = float(bg_features.get("blue_ratio", 0.0))
        white = float(bg_features.get("white_ratio", 0.0))
        court_lines = bool(bg_features.get("court_lines_detected", False))
        has_line_supported_palette = green > 0.05 or blue > 0.05 or brown > 0.12
        has_strong_line_evidence = court_lines and white > 0.008 and has_line_supported_palette
        has_hard_court_colors = (green > 0.12 or blue > 0.12) and white > 0.008
        has_clay_court_colors = brown > 0.18 and has_strong_line_evidence
        has_court_colors = has_hard_court_colors or has_clay_court_colors
        has_distant_player_presence = (
            body_presence["median_area_ratio"] >= TENNIS_MIN_DISTANT_MEDIAN_BODY_AREA_RATIO
            and body_presence["p75_area_ratio"] >= TENNIS_MIN_DISTANT_P75_BODY_AREA_RATIO
            and body_presence["max_area_ratio"] >= TENNIS_MIN_DISTANT_MAX_BODY_AREA_RATIO
        )
        has_close_player_presence = (
            body_presence["median_area_ratio"] >= TENNIS_MIN_MEDIAN_BODY_AREA_RATIO
            and body_presence["prominent_frame_ratio"] >= TENNIS_MIN_PROMINENT_FRAME_RATIO
        )

        if not has_court_colors and not has_strong_line_evidence:
            return {
                "valid": False,
                "reason": "A tennis court was not clearly detected. Upload a video where the player is visible on an actual tennis court.",
                "confidence": 0.0,
            }

        if not has_close_player_presence:
            # Allow genuine full-court tennis clips when court-line evidence is strong
            # and the player remains consistently detectable, even if they occupy less
            # of the frame than close-up training videos.
            if not (has_strong_line_evidence and has_distant_player_presence):
                return {
                    "valid": False,
                    "reason": "A clearly visible player was not detected on court. TV screens, distant players, and tiny figures are not allowed.",
                    "confidence": 0.0,
                }

        if body_presence["prominent_frame_ratio"] < 0.2 and not has_strong_line_evidence:
            return {
                "valid": False,
                "reason": "The player appears too small or too far away to confirm an on-court tennis video. Upload a closer tennis-court video.",
                "confidence": 0.0,
            }

    if sport in RACQUET_SPORTS:
        if features["max_wrist_speed"] < MIN_WRIST_SPEED_RACQUET and features["swing_arc_ratio"] < MIN_SWING_ARC_RACQUET:
            return {
                "valid": False,
                "reason": f"Video does not appear to contain a {sport_label} movement. No swinging motion detected.",
                "confidence": 0.2,
            }

    elif sport == "golf":
        if features["max_wrist_speed"] < MIN_WRIST_SPEED_GOLF and features["swing_arc_ratio"] < MIN_SWING_ARC_GOLF:
            return {
                "valid": False,
                "reason": "Video does not appear to contain a golf swing. No swing motion detected.",
                "confidence": 0.2,
            }

    penalties = _compute_sport_penalties(pose_data, features, sport, fps, frame_width, frame_height, bg_features)
    total_penalty = sum(p["score"] for p in penalties)

    if total_penalty >= 4.0:
        reasons = [p["reason"] for p in penalties if p["score"] >= 1.0]
        reason_text = reasons[0] if reasons else f"Video motion pattern does not match {sport_label}."
        return {
            "valid": False,
            "reason": reason_text,
            "confidence": max(0.0, 1.0 - total_penalty / 5.0),
        }

    confidence = max(0.1, 1.0 - total_penalty / 5.0)
    return {"valid": True, "reason": "", "confidence": confidence}


def _compute_sport_penalties(
    pose_data: List[Optional[Dict]],
    features: Dict,
    sport: str,
    fps: float,
    frame_width: int,
    frame_height: int,
    bg_features: Optional[Dict] = None,
) -> List[Dict]:
    penalties: List[Dict] = []

    all_speeds = []
    if features.get("max_rw_speed", 0) > 0 or features.get("max_lw_speed", 0) > 0:
        rw_speeds = []
        lw_speeds = []
        dt = 1.0 / fps if fps > 0 else 1.0 / 30.0
        prev_rw = None
        prev_lw = None
        for p in pose_data:
            if p is None:
                prev_rw = None
                prev_lw = None
                continue
            rw = p.get("right_wrist")
            lw = p.get("left_wrist")
            if rw and rw.get("visibility", 0) > 0.4:
                if prev_rw is not None:
                    speed = math.sqrt((rw["x"] - prev_rw[0]) ** 2 + (rw["y"] - prev_rw[1]) ** 2) / (frame_width * dt)
                    rw_speeds.append(speed)
                    all_speeds.append(speed)
                prev_rw = (rw["x"], rw["y"])
            else:
                prev_rw = None
            if lw and lw.get("visibility", 0) > 0.4:
                if prev_lw is not None:
                    speed = math.sqrt((lw["x"] - prev_lw[0]) ** 2 + (lw["y"] - prev_lw[1]) ** 2) / (frame_width * dt)
                    lw_speeds.append(speed)
                    all_speeds.append(speed)
                prev_lw = (lw["x"], lw["y"])
            else:
                prev_lw = None

    if all_speeds and len(all_speeds) > 5:
        avg_speed = float(np.mean(all_speeds))
        max_speed = max(all_speeds)
        if avg_speed > 0:
            peak_ratio = max_speed / avg_speed
            if peak_ratio < 1.5:
                penalties.append({
                    "score": 1.5,
                    "reason": f"Video shows continuous rhythmic motion rather than a {sport} swing. Sport movements have a distinct wind-up and strike phase.",
                })

        above_avg_count = sum(1 for s in all_speeds if s > avg_speed * 0.7)
        continuous_ratio = above_avg_count / len(all_speeds)
        if continuous_ratio > 0.85:
            penalties.append({
                "score": 1.0,
                "reason": f"Video shows sustained movement throughout rather than a distinct {sport} swing motion.",
            })

    two_handed_sports = {"tennis", "golf"}
    if sport in RACQUET_SPORTS or sport == "golf":
        if sport not in two_handed_sports:
            max_rw = features.get("max_rw_speed", 0)
            max_lw = features.get("max_lw_speed", 0)
            dominant = max(max_rw, max_lw)
            non_dominant = min(max_rw, max_lw)
            if non_dominant > 0 and dominant > 0:
                arm_ratio = dominant / non_dominant
                if arm_ratio < 1.2 and dominant > 0.1:
                    penalties.append({
                        "score": 1.0,
                        "reason": f"Both arms are moving equally — {sport} swings are typically dominated by one arm.",
                    })

    hip_movements = []
    prev_hip = None
    for p in pose_data:
        if p is None:
            prev_hip = None
            continue
        lh = p.get("left_hip")
        rh = p.get("right_hip")
        if lh and rh and lh.get("visibility", 0) > 0.4 and rh.get("visibility", 0) > 0.4:
            hip_center = ((lh["x"] + rh["x"]) / 2, (lh["y"] + rh["y"]) / 2)
            if prev_hip is not None:
                hip_disp = math.sqrt((hip_center[0] - prev_hip[0]) ** 2 + (hip_center[1] - prev_hip[1]) ** 2)
                hip_movements.append(hip_disp)
            prev_hip = hip_center
        else:
            prev_hip = None

    if hip_movements and len(hip_movements) > 5:
        total_hip_range = sum(hip_movements)
        total_wrist_range = 0
        rw_positions = []
        for p in pose_data:
            if p is None:
                continue
            rw = p.get("right_wrist")
            lw = p.get("left_wrist")
            w = rw if (rw and rw.get("visibility", 0) > 0.4) else lw
            if w:
                rw_positions.append((w["x"], w["y"]))
        if len(rw_positions) > 2:
            for i in range(1, len(rw_positions)):
                total_wrist_range += math.sqrt(
                    (rw_positions[i][0] - rw_positions[i-1][0]) ** 2 +
                    (rw_positions[i][1] - rw_positions[i-1][1]) ** 2
                )

        if total_wrist_range > 0:
            hip_wrist_ratio = total_hip_range / total_wrist_range
            hip_threshold = 0.9 if sport in ("golf", "tennis") else 0.7
            if hip_wrist_ratio > hip_threshold:
                penalties.append({
                    "score": 1.5,
                    "reason": f"Video shows full-body movement (legs and hips moving as much as arms) rather than a {sport} swing.",
                })

    if bg_features is not None and bg_features.get("sufficient", False):
        green = bg_features.get("green_ratio", 0)
        brown = bg_features.get("brown_ratio", 0)
        blue = bg_features.get("blue_ratio", 0)
        court_lines = bg_features.get("court_lines_detected", False)
        brightness_var = bg_features.get("brightness_variance", 50.0)
        brightness_mean = bg_features.get("brightness_mean", 128.0)

        if sport == "golf":
            if green < 0.05 and not court_lines and brightness_var < 1500:
                penalties.append({
                    "score": 1.0,
                    "reason": "Background does not appear to be a golf course or driving range.",
                })

        elif sport == "tennis":
            has_court_colors = green > 0.10 or brown > 0.10 or blue > 0.10
            if not has_court_colors and not court_lines:
                penalties.append({
                    "score": 0.8,
                    "reason": "Background does not appear to be a tennis court.",
                })

        elif sport in ("tabletennis", "badminton"):
            is_outdoor = green > 0.20 and brightness_var > 2000 and brightness_mean > 150
            if is_outdoor:
                penalties.append({
                    "score": 0.5,
                    "reason": f"Background appears to be outdoors, which is unusual for {sport}.",
                })

    return penalties


def _segment_swings(
    pose_data: List[Optional[Dict]],
    fps: float,
    frame_width: int,
    frame_height: int,
) -> List[Tuple[int, int]]:
    dt = 1.0 / fps if fps > 0 else 1.0 / 30.0
    speeds = []
    prev_rw = None
    prev_lw = None

    for p in pose_data:
        if p is None:
            prev_rw = None
            prev_lw = None
            speeds.append(0.0)
            continue

        rw = p.get("right_wrist")
        lw = p.get("left_wrist")
        frame_speed = 0.0

        if rw and rw.get("visibility", 0) > 0.4:
            if prev_rw is not None:
                s = math.sqrt((rw["x"] - prev_rw[0]) ** 2 + (rw["y"] - prev_rw[1]) ** 2) / (frame_width * dt)
                frame_speed = max(frame_speed, s)
            prev_rw = (rw["x"], rw["y"])
        else:
            prev_rw = None

        if lw and lw.get("visibility", 0) > 0.4:
            if prev_lw is not None:
                s = math.sqrt((lw["x"] - prev_lw[0]) ** 2 + (lw["y"] - prev_lw[1]) ** 2) / (frame_width * dt)
                frame_speed = max(frame_speed, s)
            prev_lw = (lw["x"], lw["y"])
        else:
            prev_lw = None

        speeds.append(frame_speed)

    if len(speeds) < 10:
        return [(0, len(pose_data) - 1)]

    window = min(7, len(speeds) // 3)
    if window < 3:
        window = 3
    smoothed = []
    half_w = window // 2
    for i in range(len(speeds)):
        start_i = max(0, i - half_w)
        end_i = min(len(speeds), i + half_w + 1)
        smoothed.append(float(np.mean(speeds[start_i:end_i])))

    non_zero = [s for s in smoothed if s > 0]
    if not non_zero:
        return [(0, len(pose_data) - 1)]

    median_speed = float(np.median(non_zero))
    peak_threshold = max(median_speed * 2.0, 0.03)

    peaks = []
    for i in range(1, len(smoothed) - 1):
        if smoothed[i] > peak_threshold:
            if smoothed[i] >= smoothed[i - 1] and smoothed[i] >= smoothed[i + 1]:
                peaks.append(i)

    if not peaks:
        above = [i for i, s in enumerate(smoothed) if s > peak_threshold]
        if above:
            peaks = [above[len(above) // 2]]
        else:
            return [(0, len(pose_data) - 1)]

    min_window_frames = int(0.3 * fps)
    max_window_frames = int(3.0 * fps)

    segments: List[Tuple[int, int]] = []
    for peak in peaks:
        peak_val = smoothed[peak]
        drop_threshold = peak_val * 0.3

        start = peak
        while start > 0 and smoothed[start - 1] > drop_threshold:
            start -= 1
            if peak - start > max_window_frames:
                break

        end = peak
        while end < len(smoothed) - 1 and smoothed[end + 1] > drop_threshold:
            end += 1
            if end - peak > max_window_frames:
                break

        half_min = min_window_frames // 2
        if end - start < min_window_frames:
            center = (start + end) // 2
            start = max(0, center - half_min)
            end = min(len(pose_data) - 1, center + half_min)

        segments.append((start, end))

    merged: List[Tuple[int, int]] = []
    for seg in sorted(segments):
        if merged and seg[0] <= merged[-1][1] + int(0.2 * fps):
            merged[-1] = (merged[-1][0], max(merged[-1][1], seg[1]))
        else:
            merged.append(seg)

    return merged if merged else [(0, len(pose_data) - 1)]


def classify_movement(
    pose_data: List[Optional[Dict]],
    sport: str,
    fps: float = 30.0,
    frame_width: int = 1920,
    frame_height: int = 1080,
    preferred_dominant_side: Optional[str] = None,
) -> Tuple[str, int]:
    sport = sport.lower().replace(" ", "").replace("_", "")

    segments = _segment_swings(pose_data, fps, frame_width, frame_height)
    shot_count = len(segments)

    if shot_count <= 1:
        if sport in RACQUET_SPORTS:
            return _classify_racquet_sport(
                pose_data,
                sport,
                fps,
                frame_width,
                frame_height,
                preferred_dominant_side,
            ), shot_count
        elif sport == "golf":
            return _classify_golf(pose_data, fps, frame_width, frame_height), shot_count
        else:
            movements = SPORT_MOVEMENTS.get(sport, [])
            return (movements[0] if movements else "unknown"), shot_count

    classifications: List[Dict[str, Any]] = []
    for start, end in segments:
        segment_data = pose_data[start:end + 1]
        valid_in_segment = [p for p in segment_data if p is not None]
        if len(valid_in_segment) < 3:
            continue

        if sport in RACQUET_SPORTS:
            if sport == "tennis":
                classifications.append(
                    classify_segment_movement_with_diagnostics(
                        segment_data,
                        sport,
                        fps,
                        frame_width,
                        frame_height,
                        preferred_dominant_side,
                    )
                )
                continue
            cls = _classify_racquet_sport(
                segment_data,
                sport,
                fps,
                frame_width,
                frame_height,
                preferred_dominant_side,
            )
            classifications.append({"label": cls, "confidence": 0.7, "classifierSource": "rule"})
        elif sport == "golf":
            cls = _classify_golf(segment_data, fps, frame_width, frame_height)
            classifications.append({"label": cls, "confidence": 0.75, "classifierSource": "rule"})
        else:
            movements = SPORT_MOVEMENTS.get(sport, [])
            cls = movements[0] if movements else "unknown"
            classifications.append({"label": cls, "confidence": 0.5, "classifierSource": "default"})

    if not classifications:
        if sport in RACQUET_SPORTS:
            return _classify_racquet_sport(
                pose_data,
                sport,
                fps,
                frame_width,
                frame_height,
                preferred_dominant_side,
            ), shot_count
        elif sport == "golf":
            return _classify_golf(pose_data, fps, frame_width, frame_height), shot_count
        movements = SPORT_MOVEMENTS.get(sport, [])
        return (movements[0] if movements else "unknown"), shot_count

    if sport == "tennis":
        return _choose_tennis_dominant_label(classifications), shot_count

    from collections import Counter
    counts = Counter(str(item.get("label", "unknown")) for item in classifications)
    if sport == "tennis" and counts.get("serve", 0) > 0:
        serve_votes = counts["serve"]
        strongest_non_serve = max(
            (count for label, count in counts.items() if label != "serve"),
            default=0,
        )
        if serve_votes >= strongest_non_serve:
            return "serve", shot_count

    dominant = counts.most_common(1)[0][0]

    return dominant, shot_count


def classify_segment_movement(
    segment_data: List[Optional[Dict]],
    sport: str,
    fps: float = 30.0,
    frame_width: int = 1920,
    frame_height: int = 1080,
    preferred_dominant_side: Optional[str] = None,
) -> str:
    diagnostics = classify_segment_movement_with_diagnostics(
        segment_data,
        sport,
        fps,
        frame_width,
        frame_height,
        preferred_dominant_side,
    )
    return str(diagnostics.get("label", "unknown"))


def classify_segment_movement_with_diagnostics(
    segment_data: List[Optional[Dict]],
    sport: str,
    fps: float = 30.0,
    frame_width: int = 1920,
    frame_height: int = 1080,
    preferred_dominant_side: Optional[str] = None,
) -> Dict[str, Any]:
    sport = sport.lower().replace(" ", "").replace("_", "")

    valid_in_segment = [p for p in segment_data if p is not None]
    if len(valid_in_segment) < 3:
        return {
            "label": "unknown",
            "confidence": 0.0,
            "reasons": ["insufficient_pose_frames"],
            "keyFeatures": {},
            "classifierSource": "none",
        }

    if sport in RACQUET_SPORTS:
        features = _extract_features(
            segment_data,
            fps,
            frame_width,
            frame_height,
            preferred_dominant_side,
        )

        if features.get("is_serve", False):
            return {
                "label": "serve",
                "confidence": 0.9,
                "reasons": ["serve_motion_detected"],
                "keyFeatures": _build_tennis_key_features(features),
                "classifierSource": "rule",
            }

        if sport == "tennis" and features.get("is_compact_forward", False) and float(features.get("swing_arc_ratio", 0.0)) < 0.2:
            return {
                "label": "volley",
                "confidence": 0.85,
                "reasons": ["compact_forward_motion"],
                "keyFeatures": _build_tennis_key_features(features),
                "classifierSource": "rule",
            }

        if sport == "tennis":
            model_prediction = _predict_tennis_model(features)
            if _is_actionable_tennis_model_prediction(model_prediction):
                model_label = str(model_prediction.get("label", "unknown"))
                model_confidence = float(model_prediction.get("confidence", 0.0))
                model_margin = float(model_prediction.get("margin", 0.0))
                return {
                    "label": model_label,
                    "confidence": model_confidence,
                    "reasons": [
                        "model_inference",
                        f"model_predicted_{model_label}",
                    ],
                    "keyFeatures": _build_tennis_key_features(features),
                    "classifierSource": "model",
                    "modelLabel": model_label,
                    "modelConfidence": model_confidence,
                    "modelMargin": model_margin,
                    "modelProbabilities": dict(model_prediction.get("probabilities", {})),
                    "modelVersion": model_prediction.get("modelVersion"),
                }

            label, confidence, reasons = _classify_tennis_forehand_backhand(features)
            if model_prediction is not None:
                reasons = list(reasons)
                reasons.append("model_low_confidence_fallback")
            return {
                "label": label,
                "confidence": confidence,
                "reasons": reasons,
                "keyFeatures": _build_tennis_key_features(features),
                "classifierSource": "heuristic",
                "modelLabel": model_prediction.get("label") if model_prediction is not None else None,
                "modelConfidence": float(model_prediction.get("confidence", 0.0)) if model_prediction is not None else None,
                "modelMargin": float(model_prediction.get("margin", 0.0)) if model_prediction is not None else None,
                "modelProbabilities": dict(model_prediction.get("probabilities", {})) if model_prediction is not None else None,
                "modelVersion": model_prediction.get("modelVersion") if model_prediction is not None else None,
            }

        label = _classify_racquet_sport(segment_data, sport, fps, frame_width, frame_height)
        return {
            "label": label,
            "confidence": 0.7,
            "reasons": ["racquet_sport_rule"],
            "keyFeatures": {
                "swing_arc_ratio": float(features.get("swing_arc_ratio", 0.0)),
                "max_wrist_speed": float(features.get("max_wrist_speed", 0.0)),
            },
            "classifierSource": "rule",
        }

    if sport == "golf":
        label = _classify_golf(segment_data, fps, frame_width, frame_height)
        return {
            "label": label,
            "confidence": 0.75,
            "reasons": ["golf_rule"],
            "keyFeatures": {},
            "classifierSource": "rule",
        }

    movements = SPORT_MOVEMENTS.get(sport, [])
    return {
        "label": movements[0] if movements else "unknown",
        "confidence": 0.5,
        "reasons": ["default_movement"],
        "keyFeatures": {},
        "classifierSource": "default",
    }


def _build_tennis_key_features(features: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "dominant_side": str(features.get("dominant_side", "right")),
        "dominant_side_confidence": float(features.get("dominant_side_confidence", 0.0)),
        "is_cross_body": bool(features.get("is_cross_body", False)),
        "is_serve": bool(features.get("is_serve", False)),
        "is_compact_forward": bool(features.get("is_compact_forward", False)),
        "is_overhead": bool(features.get("is_overhead", False)),
        "is_downward_motion": bool(features.get("is_downward_motion", False)),
        "max_wrist_speed": float(features.get("max_wrist_speed", 0.0)),
        "max_rw_speed": float(features.get("max_rw_speed", 0.0)),
        "max_lw_speed": float(features.get("max_lw_speed", 0.0)),
        "swing_arc_ratio": float(features.get("swing_arc_ratio", 0.0)),
        "contact_height_ratio": float(features.get("contact_height_ratio", 0.0)),
        "dominant_wrist_median_offset": float(features.get("dominant_wrist_median_offset", 0.0)),
        "dominant_wrist_opposite_ratio": float(features.get("dominant_wrist_opposite_ratio", 0.0)),
        "dominant_wrist_same_ratio": float(features.get("dominant_wrist_same_ratio", 0.0)),
        "shoulder_rotation_delta_deg": float(features.get("shoulder_rotation_delta_deg", 0.0)),
    }


def _predict_tennis_model(features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    model_input = _build_tennis_key_features(features)
    return predict_tennis_movement(model_input)


def _is_actionable_tennis_model_prediction(prediction: Optional[Dict[str, Any]]) -> bool:
    if prediction is None:
        return False
    label = str(prediction.get("label", "unknown"))
    confidence = float(prediction.get("confidence", 0.0))
    margin = float(prediction.get("margin", 0.0))
    return label in {"forehand", "backhand", "serve", "volley"} and confidence >= TENNIS_MODEL_CONFIDENCE_THRESHOLD and margin >= TENNIS_MODEL_MARGIN_THRESHOLD


def _choose_tennis_dominant_label(classifications: List[Dict[str, Any]]) -> str:
    weighted_votes: Dict[str, float] = {}
    raw_counts: Dict[str, int] = {}

    for classification in classifications:
        label = str(classification.get("label", "unknown"))
        if label == "unknown":
            continue
        confidence = max(0.25, float(classification.get("confidence", 0.0)))
        weighted_votes[label] = weighted_votes.get(label, 0.0) + confidence
        raw_counts[label] = raw_counts.get(label, 0) + 1

    if not weighted_votes:
        return "unknown"

    serve_votes = weighted_votes.get("serve", 0.0)
    strongest_non_serve = max(
        (vote for label, vote in weighted_votes.items() if label != "serve"),
        default=0.0,
    )
    if serve_votes > 0.0 and serve_votes >= strongest_non_serve * 0.92:
        return "serve"

    return max(
        weighted_votes.items(),
        key=lambda item: (item[1], raw_counts.get(item[0], 0)),
    )[0]


def _classify_racquet_sport(
    pose_data: List[Optional[Dict]],
    sport: str,
    fps: float,
    frame_width: int,
    frame_height: int,
    preferred_dominant_side: Optional[str] = None,
) -> str:
    valid_poses = [p for p in pose_data if p is not None]
    if len(valid_poses) < 5:
        return SPORT_MOVEMENTS.get(sport, ["forehand"])[0]

    features = _extract_features(
        pose_data,
        fps,
        frame_width,
        frame_height,
        preferred_dominant_side,
    )

    if features["is_serve"]:
        return "serve"

    if sport in ("badminton",):
        return _classify_badminton(features)

    if sport in ("tennis", "pickleball", "paddle", "tabletennis"):
        return _classify_forehand_backhand(features, sport)

    return "forehand"


def _classify_badminton(features: Dict) -> str:
    if features["is_serve"]:
        return "serve"

    if features["is_overhead"]:
        if features["max_wrist_speed"] > 0.6:
            return "smash"
        elif features["swing_arc_ratio"] < 0.3:
            return "drop"
        else:
            return "clear"

    if features["swing_arc_ratio"] < 0.15 and features["contact_height_ratio"] < 0.4:
        return "net-shot"

    return "clear"


def _classify_forehand_backhand(features: Dict, sport: str) -> str:
    if sport == "pickleball":
        if features["swing_arc_ratio"] < 0.12 and features["max_wrist_speed"] < 0.3:
            return "dink"

        if features["is_compact_forward"]:
            return "volley"

        if features["swing_arc_ratio"] < 0.2 and features["contact_height_ratio"] < 0.5:
            return "third-shot-drop"

    if sport == "paddle":
        if features["is_overhead"] and features["max_wrist_speed"] > 0.5:
            return "smash"
        if features["is_overhead"] and features["swing_arc_ratio"] < 0.35:
            return "bandeja"

    if sport == "tabletennis":
        if features["swing_arc_ratio"] > 0.4 and features["max_wrist_speed"] > 0.4:
            return "loop"
        if features["is_downward_motion"]:
            return "chop"

    if sport == "tennis":
        if features["is_compact_forward"]:
            return "volley"
        label, _, _ = _classify_tennis_forehand_backhand(features)
        return label

    if features["is_cross_body"]:
        return "backhand"
    else:
        return "forehand"


def _classify_tennis_forehand_backhand(features: Dict) -> Tuple[str, float, List[str]]:
    reasons: List[str] = []
    forehand_score = 0.4
    backhand_score = 0.4

    dominant_side = str(features.get("dominant_side", "right"))
    dominant_conf = float(features.get("dominant_side_confidence", 0.0))
    max_rw = float(features.get("max_rw_speed", 0.0))
    max_lw = float(features.get("max_lw_speed", 0.0))
    swing_arc = float(features.get("swing_arc_ratio", 0.0))
    is_cross_body = bool(features.get("is_cross_body", False))
    is_compact_forward = bool(features.get("is_compact_forward", False))
    dominant_wrist_median_offset = float(features.get("dominant_wrist_median_offset", 0.0))
    dominant_wrist_opposite_ratio = float(features.get("dominant_wrist_opposite_ratio", 0.0))
    dominant_wrist_same_ratio = float(features.get("dominant_wrist_same_ratio", 0.0))
    shoulder_rotation_delta_deg = float(features.get("shoulder_rotation_delta_deg", 0.0))
    contact_height_ratio = float(features.get("contact_height_ratio", 0.5))
    is_overhead = bool(features.get("is_overhead", False))

    speed_ratio_rw_lw = max_rw / max(max_lw, 1e-6)
    speed_ratio_lw_rw = max_lw / max(max_rw, 1e-6)

    if is_cross_body:
        # Cross-body alone can overfire on forehand follow-through, so keep
        # this cue strong but not overwhelming.
        backhand_score += 0.46
        reasons.append("cross_body_motion")
    else:
        # Non-cross-body is weak evidence for forehand in real-world clips;
        # keep this signal modest so wide-arc and wrist parity can still vote backhand.
        forehand_score += 0.24
        reasons.append("non_cross_body_motion")

    side_weight = 0.35 * max(0.3, dominant_conf)
    if dominant_side == "right":
        if speed_ratio_rw_lw >= 1.3:
            forehand_score += side_weight
            reasons.append("right_wrist_speed_dominant")
        elif speed_ratio_rw_lw <= 0.8:
            backhand_score += side_weight * 0.75
            reasons.append("left_wrist_speed_dominant")
    else:
        if speed_ratio_lw_rw >= 1.3:
            forehand_score += side_weight
            reasons.append("left_wrist_speed_dominant")
        elif speed_ratio_lw_rw <= 0.8:
            backhand_score += side_weight * 0.75
            reasons.append("right_wrist_speed_dominant")

    if swing_arc < 0.24:
        forehand_score += 0.14
        reasons.append("compact_arc_forehand_like")
    else:
        backhand_score += 0.18
        reasons.append("wider_arc_backhand_risk")

    # If the dominant/non-dominant wrist speeds are close and arc is wide,
    # this is often a two-handed or neutral-prep backhand pattern.
    dominant_speed_ratio = speed_ratio_rw_lw if dominant_side == "right" else speed_ratio_lw_rw
    if swing_arc >= 0.30 and 0.85 <= dominant_speed_ratio <= 1.20:
        backhand_score += 0.10
        reasons.append("wrist_speed_parity_backhand_hint")

    # Contact-side profile: dominant wrist spending more time on opposite body side
    # is a backhand cue, while persistent same-side contact leans forehand.
    # When dominant wrist speed clearly leads, downweight opposite-side signals
    # to avoid labeling forehand follow-through as backhand.
    if dominant_wrist_opposite_ratio >= 0.42:
        opposite_side_weight = 0.12 if dominant_speed_ratio < 1.45 else 0.05
        backhand_score += opposite_side_weight
        reasons.append("opposite_side_contact_profile")
    elif dominant_wrist_same_ratio >= 0.70:
        forehand_score += 0.10
        reasons.append("same_side_contact_profile")

    if dominant_wrist_median_offset <= -0.10:
        median_opposite_weight = 0.08 if dominant_speed_ratio < 1.45 else 0.03
        backhand_score += median_opposite_weight
        reasons.append("median_contact_opposite_side")
    elif dominant_wrist_median_offset >= 0.12:
        forehand_score += 0.08
        reasons.append("median_contact_same_side")

    # Torso rotation direction near swing completion can help separate FH/BH on compact clips.
    if abs(shoulder_rotation_delta_deg) >= 8.0:
        if dominant_side == "right":
            if shoulder_rotation_delta_deg > 0:
                backhand_score += 0.08
                reasons.append("torso_rotation_backhand_hint")
            else:
                forehand_score += 0.03
                reasons.append("torso_rotation_forehand_hint")
        else:
            if shoulder_rotation_delta_deg < 0:
                backhand_score += 0.04
                reasons.append("torso_rotation_backhand_hint")
            else:
                forehand_score += 0.03
                reasons.append("torso_rotation_forehand_hint")

    # Cross-body forehands often end opposite-side after contact. If dominant
    # hand speed clearly leads and torso direction is forehand-like, add a
    # corrective forehand boost.
    forehand_torso_dir = (
        (dominant_side == "right" and shoulder_rotation_delta_deg < -8.0)
        or (dominant_side != "right" and shoulder_rotation_delta_deg > 8.0)
    )
    if is_cross_body and dominant_speed_ratio >= 1.45 and forehand_torso_dir:
        forehand_score += 0.18
        reasons.append("cross_body_follow_through_forehand_hint")

    if is_compact_forward:
        forehand_score += 0.08
        reasons.append("compact_forward_pattern")

    if is_overhead and contact_height_ratio >= 0.58 and swing_arc >= 0.24:
        backhand_score += 0.08
        reasons.append("high_contact_backhand_support")

    gap = abs(forehand_score - backhand_score)
    total = max(forehand_score + backhand_score, 1e-6)
    confidence = 0.5 + min(0.45, gap / total)

    backhand_lead = backhand_score - forehand_score
    if (
        is_cross_body
        and dominant_speed_ratio >= 1.45
        and forehand_torso_dir
        and "wrist_speed_parity_backhand_hint" not in reasons
        and backhand_lead <= 0.22
    ):
        reasons.append("cross_body_forehand_override")
        return "forehand", float(confidence), reasons

    if gap < 0.16:
        reasons.append("ambiguous_tennis_stroke")
        confidence = min(confidence, 0.6)

        if (
            is_cross_body
            and (
                dominant_wrist_opposite_ratio >= 0.46
                or dominant_wrist_median_offset <= -0.12
                or "wrist_speed_parity_backhand_hint" in reasons
            )
        ):
            reasons.append("ambiguous_structure_backhand")
            return "backhand", float(confidence), reasons

        if not is_cross_body and dominant_wrist_same_ratio >= 0.72:
            reasons.append("ambiguous_structure_forehand")
            return "forehand", float(confidence), reasons

    label = "forehand" if forehand_score >= backhand_score else "backhand"
    return label, float(confidence), reasons


def _classify_golf(
    pose_data: List[Optional[Dict]],
    fps: float,
    frame_width: int,
    frame_height: int,
) -> str:
    features = _extract_features(pose_data, fps, frame_width, frame_height)

    if features["swing_arc_ratio"] < 0.1 and features["max_wrist_speed"] < 0.2:
        return "putt"

    if features["swing_arc_ratio"] < 0.25 and features["max_wrist_speed"] < 0.35:
        return "chip"

    if features["swing_arc_ratio"] > 0.5 and features["max_wrist_speed"] > 0.5:
        return "drive"

    if features["swing_arc_ratio"] > 0.35:
        return "full-swing"

    return "iron"


def _extract_features(
    pose_data: List[Optional[Dict]],
    fps: float,
    frame_width: int,
    frame_height: int,
    preferred_dominant_side: Optional[str] = None,
) -> Dict:
    dt = 1.0 / fps if fps > 0 else 1.0 / 30.0

    right_wrist_positions = []
    left_wrist_positions = []
    right_wrist_speeds = []
    left_wrist_speeds = []
    right_wrist_offsets = []
    left_wrist_offsets = []
    shoulder_angles = []
    wrist_heights = []
    contact_heights = []
    right_vis_count = 0
    left_vis_count = 0

    prev_rw = None
    prev_lw = None

    for p in pose_data:
        if p is None:
            prev_rw = None
            prev_lw = None
            continue

        rw = p.get("right_wrist")
        lw = p.get("left_wrist")
        rs = p.get("right_shoulder")
        ls = p.get("left_shoulder")

        if rw and rw.get("visibility", 0) > 0.4:
            right_wrist_positions.append((rw["x"], rw["y"]))
            right_vis_count += 1
            if prev_rw is not None:
                speed = math.sqrt(
                    (rw["x"] - prev_rw[0]) ** 2 + (rw["y"] - prev_rw[1]) ** 2
                ) / (frame_width * dt)
                right_wrist_speeds.append(speed)
            prev_rw = (rw["x"], rw["y"])
        else:
            prev_rw = None

        if lw and lw.get("visibility", 0) > 0.4:
            left_wrist_positions.append((lw["x"], lw["y"]))
            left_vis_count += 1
            if prev_lw is not None:
                speed = math.sqrt(
                    (lw["x"] - prev_lw[0]) ** 2 + (lw["y"] - prev_lw[1]) ** 2
                ) / (frame_width * dt)
                left_wrist_speeds.append(speed)
            prev_lw = (lw["x"], lw["y"])
        else:
            prev_lw = None

        if rs and ls and rs.get("visibility", 0) > 0.4 and ls.get("visibility", 0) > 0.4:
            shoulder_width = abs(rs["x"] - ls["x"])
            body_center_x = (rs["x"] + ls["x"]) / 2
            angle = math.degrees(
                math.atan2(rs["y"] - ls["y"], rs["x"] - ls["x"])
            )
            shoulder_angles.append(angle)

            if shoulder_width > 1:
                if rw and rw.get("visibility", 0) > 0.4:
                    right_wrist_offsets.append((rw["x"] - body_center_x) / shoulder_width)
                if lw and lw.get("visibility", 0) > 0.4:
                    left_wrist_offsets.append((lw["x"] - body_center_x) / shoulder_width)

        wrist = rw if (rw and rw.get("visibility", 0) > 0.4) else lw
        shoulder = rs if (rs and rs.get("visibility", 0) > 0.4) else ls
        if wrist and shoulder:
            rel_height = (shoulder["y"] - wrist["y"]) / frame_height
            wrist_heights.append(rel_height)
            contact_heights.append(wrist["y"] / frame_height)

    max_rw_speed = max(right_wrist_speeds) if right_wrist_speeds else 0
    max_lw_speed = max(left_wrist_speeds) if left_wrist_speeds else 0
    max_wrist_speed = max(max_rw_speed, max_lw_speed)

    swing_arc_ratio = 0.0
    if right_wrist_positions:
        xs = [p[0] for p in right_wrist_positions]
        ys = [p[1] for p in right_wrist_positions]
        r_arc = (max(xs) - min(xs) + max(ys) - min(ys)) / (frame_width + frame_height)
        swing_arc_ratio = max(swing_arc_ratio, r_arc)
    if left_wrist_positions:
        xs = [p[0] for p in left_wrist_positions]
        ys = [p[1] for p in left_wrist_positions]
        l_arc = (max(xs) - min(xs) + max(ys) - min(ys)) / (frame_width + frame_height)
        swing_arc_ratio = max(swing_arc_ratio, l_arc)

    avg_wrist_height = float(np.mean(wrist_heights)) if wrist_heights else 0
    is_overhead = avg_wrist_height > 0.15
    is_serve = _detect_serve(wrist_heights, pose_data, frame_height)

    dominant_side, dominant_side_confidence = _determine_dominant_side(
        right_wrist_positions, left_wrist_positions,
        right_wrist_speeds, left_wrist_speeds,
        right_vis_count, left_vis_count,
        pose_data, frame_width,
        preferred_dominant_side,
    )

    is_compact_forward = swing_arc_ratio < 0.2 and max_wrist_speed < 0.35

    is_cross_body = _detect_cross_body(pose_data, frame_width, dominant_side)

    dominant_offsets = right_wrist_offsets if dominant_side == "right" else left_wrist_offsets
    dominant_wrist_median_offset = float(np.median(dominant_offsets)) if dominant_offsets else 0.0
    if dominant_side == "right":
        dominant_wrist_opposite_ratio = (
            float(sum(1 for o in dominant_offsets if o < -0.12)) / len(dominant_offsets)
            if dominant_offsets else 0.0
        )
        dominant_wrist_same_ratio = (
            float(sum(1 for o in dominant_offsets if o > 0.12)) / len(dominant_offsets)
            if dominant_offsets else 0.0
        )
    else:
        dominant_wrist_opposite_ratio = (
            float(sum(1 for o in dominant_offsets if o > 0.12)) / len(dominant_offsets)
            if dominant_offsets else 0.0
        )
        dominant_wrist_same_ratio = (
            float(sum(1 for o in dominant_offsets if o < -0.12)) / len(dominant_offsets)
            if dominant_offsets else 0.0
        )

    is_downward_motion = False
    if wrist_heights and len(wrist_heights) > 5:
        first_quarter = wrist_heights[:len(wrist_heights) // 4]
        last_quarter = wrist_heights[-(len(wrist_heights) // 4):]
        if first_quarter and last_quarter:
            is_downward_motion = np.mean(first_quarter) > np.mean(last_quarter) + 0.05

    contact_height_ratio = float(np.mean(contact_heights)) if contact_heights else 0.5

    shoulder_rotation_delta_deg = 0.0
    if len(shoulder_angles) >= 6:
        q = max(2, len(shoulder_angles) // 4)
        first_mean = float(np.mean(shoulder_angles[:q]))
        last_mean = float(np.mean(shoulder_angles[-q:]))
        shoulder_rotation_delta_deg = ((last_mean - first_mean + 180.0) % 360.0) - 180.0

    return {
        "dominant_side": dominant_side,
        "dominant_side_confidence": dominant_side_confidence,
        "dominant_side_calibrated": bool(preferred_dominant_side),
        "max_wrist_speed": max_wrist_speed,
        "swing_arc_ratio": swing_arc_ratio,
        "avg_wrist_height": avg_wrist_height,
        "is_overhead": is_overhead,
        "is_serve": is_serve,
        "is_compact_forward": is_compact_forward,
        "is_cross_body": is_cross_body,
        "is_downward_motion": is_downward_motion,
        "contact_height_ratio": contact_height_ratio,
        "dominant_wrist_median_offset": dominant_wrist_median_offset,
        "dominant_wrist_opposite_ratio": dominant_wrist_opposite_ratio,
        "dominant_wrist_same_ratio": dominant_wrist_same_ratio,
        "shoulder_rotation_delta_deg": shoulder_rotation_delta_deg,
        "max_rw_speed": max_rw_speed,
        "max_lw_speed": max_lw_speed,
    }


def _detect_cross_body(
    pose_data: List[Optional[Dict]],
    frame_width: int,
    dominant_side: str = "right",
) -> bool:
    frame_data: List[Dict] = []

    for p in pose_data:
        if p is None:
            continue

        ls = p.get("left_shoulder")
        rs = p.get("right_shoulder")
        rw = p.get("right_wrist")
        lw = p.get("left_wrist")

        if not (ls and rs and ls.get("visibility", 0) > 0.4 and rs.get("visibility", 0) > 0.4):
            continue

        body_center_x = (ls["x"] + rs["x"]) / 2
        shoulder_width = abs(rs["x"] - ls["x"])

        if shoulder_width < 10:
            continue

        entry: Dict = {"cx": body_center_x, "sw": shoulder_width}

        r_vis = rw and rw.get("visibility", 0) > 0.4
        l_vis = lw and lw.get("visibility", 0) > 0.4

        if r_vis:
            entry["rx"] = rw["x"]
        if l_vis:
            entry["lx"] = lw["x"]

        frame_data.append(entry)

    if len(frame_data) < 5:
        return False

    rw_speeds = []
    lw_speeds = []
    for i in range(1, len(frame_data)):
        cur = frame_data[i]
        prev = frame_data[i - 1]
        avg_sw = (cur["sw"] + prev["sw"]) / 2
        if avg_sw < 10:
            continue
        if "rx" in cur and "rx" in prev:
            rw_speeds.append((i, abs(cur["rx"] - prev["rx"]) / avg_sw))
        if "lx" in cur and "lx" in prev:
            lw_speeds.append((i, abs(cur["lx"] - prev["lx"]) / avg_sw))

    best_frame_idx = None
    best_speed = 0.0
    best_wrist = None

    preferred_first = "right" if dominant_side != "left" else "left"
    preferred_second = "left" if preferred_first == "right" else "right"

    speed_map = {
        "right": rw_speeds,
        "left": lw_speeds,
    }

    for wrist in (preferred_first, preferred_second):
        series = speed_map[wrist]
        if not series:
            continue
        local_idx, local_speed = max(series, key=lambda item: item[1])
        if local_speed > best_speed:
            best_speed = local_speed
            best_frame_idx = local_idx
            best_wrist = wrist

    if best_frame_idx is None or best_wrist is None or best_speed < 0.4:
        return False

    window = max(2, len(frame_data) // 6)
    contact_start = max(0, best_frame_idx - window)
    contact_end = min(len(frame_data), best_frame_idx + window + 1)
    contact_frames = frame_data[contact_start:contact_end]

    peak_frame = frame_data[best_frame_idx]
    peak_wrist_key = "rx" if best_wrist == "right" else "lx"
    if peak_wrist_key not in peak_frame:
        return False

    peak_offset = (peak_frame[peak_wrist_key] - peak_frame["cx"]) / max(peak_frame["sw"], 1e-6)
    if best_wrist == "right" and peak_offset > -0.15:
        return False
    if best_wrist == "left" and peak_offset < 0.15:
        return False

    cross_votes = 0
    total_votes = 0

    for f in contact_frames:
        cx = f["cx"]
        sw = f["sw"]
        wrist_key = "rx" if best_wrist == "right" else "lx"
        if wrist_key not in f:
            continue

        offset = (f[wrist_key] - cx) / sw
        total_votes += 1

        if best_wrist == "right" and offset < -0.3:
            cross_votes += 1
        elif best_wrist == "left" and offset > 0.3:
            cross_votes += 1

    if total_votes < 3:
        return False

    return cross_votes / total_votes >= 0.72


def _detect_serve(
    wrist_heights: List[float],
    pose_data: List[Optional[Dict]],
    frame_height: int,
) -> bool:
    if not wrist_heights or len(wrist_heights) < 8:
        return False

    high_frames = sum(1 for h in wrist_heights if h > 0.25)
    high_ratio = high_frames / len(wrist_heights)

    if high_ratio < 0.12:
        return False

    peak_height = max(wrist_heights)
    if peak_height < 0.28:
        return False

    visible_pose_frames = 0
    strong_raise_votes = 0
    serve_pose_votes = 0
    for p in pose_data:
        if p is None:
            continue
        rw = p.get("right_wrist")
        lw = p.get("left_wrist")
        rs = p.get("right_shoulder")
        ls = p.get("left_shoulder")

        right_raise = None
        left_raise = None
        if rw and rs and rw.get("visibility", 0) > 0.4 and rs.get("visibility", 0) > 0.4:
            right_raise = (rs["y"] - rw["y"]) / frame_height
        if lw and ls and lw.get("visibility", 0) > 0.4 and ls.get("visibility", 0) > 0.4:
            left_raise = (ls["y"] - lw["y"]) / frame_height

        if right_raise is None and left_raise is None:
            continue

        visible_pose_frames += 1
        max_raise = max(right_raise or 0.0, left_raise or 0.0)
        min_raise = min(
            value for value in (right_raise, left_raise)
            if value is not None
        ) if right_raise is not None and left_raise is not None else 0.0

        if max_raise >= 0.18:
            strong_raise_votes += 1

        if (max_raise >= 0.2 and min_raise >= 0.02) or (max_raise >= 0.24 and min_raise >= -0.02):
            serve_pose_votes += 1

    if visible_pose_frames == 0:
        return peak_height >= 0.4 and high_ratio >= 0.22

    strong_raise_ratio = strong_raise_votes / visible_pose_frames
    serve_pose_ratio = serve_pose_votes / visible_pose_frames

    return (
        (serve_pose_votes >= 2 and serve_pose_ratio >= 0.12 and high_ratio >= 0.16)
        or (strong_raise_ratio >= 0.22 and peak_height >= 0.4 and high_ratio >= 0.22)
    )


def _determine_dominant_side(
    right_positions: List[Tuple[float, float]],
    left_positions: List[Tuple[float, float]],
    right_speeds: List[float],
    left_speeds: List[float],
    right_vis: int,
    left_vis: int,
    pose_data: List[Optional[Dict]],
    frame_width: int,
    preferred_dominant_side: Optional[str] = None,
) -> Tuple[str, float]:
    normalized_preferred = str(preferred_dominant_side or "").strip().lower()
    if normalized_preferred in ("right", "left"):
        # Handedness calibration from user profile should take precedence
        # over noisy visual heuristics on ambiguous clips.
        return normalized_preferred, 1.0

    score_right = 0.0
    score_left = 0.0

    max_rs = max(right_speeds) if right_speeds else 0
    max_ls = max(left_speeds) if left_speeds else 0
    if max_rs > max_ls * 1.15:
        score_right += 2.0
    elif max_ls > max_rs * 1.15:
        score_left += 2.0

    avg_rs = float(np.mean(right_speeds)) if right_speeds else 0
    avg_ls = float(np.mean(left_speeds)) if left_speeds else 0
    if avg_rs > avg_ls * 1.1:
        score_right += 1.0
    elif avg_ls > avg_rs * 1.1:
        score_left += 1.0

    if right_positions and len(right_positions) > 3:
        r_range_x = max(p[0] for p in right_positions) - min(p[0] for p in right_positions)
    else:
        r_range_x = 0
    if left_positions and len(left_positions) > 3:
        l_range_x = max(p[0] for p in left_positions) - min(p[0] for p in left_positions)
    else:
        l_range_x = 0

    if r_range_x > l_range_x * 1.2:
        score_right += 1.5
    elif l_range_x > r_range_x * 1.2:
        score_left += 1.5

    body_centers = []
    for p in pose_data:
        if p is None:
            continue
        ls = p.get("left_shoulder")
        rs = p.get("right_shoulder")
        if ls and rs and ls.get("visibility", 0) > 0.4 and rs.get("visibility", 0) > 0.4:
            body_centers.append((ls["x"] + rs["x"]) / 2)

    if body_centers and right_positions and left_positions:
        avg_center = float(np.mean(body_centers))

        peak_r_idx = right_speeds.index(max(right_speeds)) if right_speeds else 0
        peak_l_idx = left_speeds.index(max(left_speeds)) if left_speeds else 0

        if peak_r_idx < len(right_positions):
            r_peak_x = right_positions[min(peak_r_idx, len(right_positions) - 1)][0]
            r_extension = abs(r_peak_x - avg_center) / frame_width
        else:
            r_extension = 0

        if peak_l_idx < len(left_positions):
            l_peak_x = left_positions[min(peak_l_idx, len(left_positions) - 1)][0]
            l_extension = abs(l_peak_x - avg_center) / frame_width
        else:
            l_extension = 0

        if r_extension > l_extension * 1.2:
            score_right += 1.5
        elif l_extension > r_extension * 1.2:
            score_left += 1.5

    total = score_right + score_left
    confidence = 0.0 if total <= 0 else min(1.0, abs(score_right - score_left) / total)

    if score_right > score_left:
        return "right", float(confidence)
    elif score_left > score_right:
        return "left", float(confidence)

    fallback_side = "right" if right_vis >= left_vis else "left"
    return fallback_side, max(0.1, float(confidence))
