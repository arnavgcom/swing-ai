import math
import numpy as np
from typing import Dict, List, Optional, Tuple


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


def classify_movement(
    pose_data: List[Optional[Dict]],
    sport: str,
    fps: float = 30.0,
    frame_width: int = 1920,
    frame_height: int = 1080,
) -> str:
    sport = sport.lower().replace(" ", "").replace("_", "")

    if sport in RACQUET_SPORTS:
        return _classify_racquet_sport(pose_data, sport, fps, frame_width, frame_height)
    elif sport == "golf":
        return _classify_golf(pose_data, fps, frame_width, frame_height)
    else:
        movements = SPORT_MOVEMENTS.get(sport, [])
        return movements[0] if movements else "unknown"


def _classify_racquet_sport(
    pose_data: List[Optional[Dict]],
    sport: str,
    fps: float,
    frame_width: int,
    frame_height: int,
) -> str:
    valid_poses = [p for p in pose_data if p is not None]
    if len(valid_poses) < 5:
        return SPORT_MOVEMENTS.get(sport, ["forehand"])[0]

    features = _extract_features(pose_data, fps, frame_width, frame_height)

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
        if features["is_compact_forward"] and features["swing_arc_ratio"] < 0.2:
            return "volley"

    if features["is_cross_body"]:
        return "backhand"
    else:
        return "forehand"


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
) -> Dict:
    dt = 1.0 / fps if fps > 0 else 1.0 / 30.0

    right_wrist_positions = []
    left_wrist_positions = []
    right_wrist_speeds = []
    left_wrist_speeds = []
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
            angle = math.degrees(
                math.atan2(rs["y"] - ls["y"], rs["x"] - ls["x"])
            )
            shoulder_angles.append(angle)

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

    dominant_side = _determine_dominant_side(
        right_wrist_positions, left_wrist_positions,
        right_wrist_speeds, left_wrist_speeds,
        right_vis_count, left_vis_count,
        pose_data, frame_width,
    )

    is_compact_forward = swing_arc_ratio < 0.2 and max_wrist_speed < 0.35

    is_cross_body = _detect_cross_body(pose_data, frame_width)

    is_downward_motion = False
    if wrist_heights and len(wrist_heights) > 5:
        first_quarter = wrist_heights[:len(wrist_heights) // 4]
        last_quarter = wrist_heights[-(len(wrist_heights) // 4):]
        if first_quarter and last_quarter:
            is_downward_motion = np.mean(first_quarter) > np.mean(last_quarter) + 0.05

    contact_height_ratio = float(np.mean(contact_heights)) if contact_heights else 0.5

    return {
        "dominant_side": dominant_side,
        "max_wrist_speed": max_wrist_speed,
        "swing_arc_ratio": swing_arc_ratio,
        "avg_wrist_height": avg_wrist_height,
        "is_overhead": is_overhead,
        "is_serve": is_serve,
        "is_compact_forward": is_compact_forward,
        "is_cross_body": is_cross_body,
        "is_downward_motion": is_downward_motion,
        "contact_height_ratio": contact_height_ratio,
        "max_rw_speed": max_rw_speed,
        "max_lw_speed": max_lw_speed,
    }


def _detect_cross_body(
    pose_data: List[Optional[Dict]],
    frame_width: int,
) -> bool:
    wrist_body_offsets = []

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

        r_visible = rw and rw.get("visibility", 0) > 0.4
        l_visible = lw and lw.get("visibility", 0) > 0.4

        if r_visible:
            offset = (rw["x"] - body_center_x) / shoulder_width
            wrist_body_offsets.append(("right", offset))
        if l_visible:
            offset = (lw["x"] - body_center_x) / shoulder_width
            wrist_body_offsets.append(("left", offset))

    if len(wrist_body_offsets) < 5:
        return False

    right_offsets = [o for side, o in wrist_body_offsets if side == "right"]
    left_offsets = [o for side, o in wrist_body_offsets if side == "left"]

    right_cross_count = sum(1 for o in right_offsets if o < -0.3)
    left_cross_count = sum(1 for o in left_offsets if o > 0.3)

    right_total = len(right_offsets) if right_offsets else 1
    left_total = len(left_offsets) if left_offsets else 1

    right_cross_ratio = right_cross_count / right_total
    left_cross_ratio = left_cross_count / left_total

    cross_threshold = 0.15

    if right_cross_ratio > cross_threshold or left_cross_ratio > cross_threshold:
        return True

    right_range = max(right_offsets) - min(right_offsets) if len(right_offsets) > 2 else 0
    left_range = max(left_offsets) - min(left_offsets) if len(left_offsets) > 2 else 0

    active_side_offsets = right_offsets if right_range > left_range else left_offsets
    if not active_side_offsets or len(active_side_offsets) < 5:
        return False

    n = len(active_side_offsets)
    first_third = active_side_offsets[:n // 3]
    last_third = active_side_offsets[-(n // 3):]

    if first_third and last_third:
        start_mean = float(np.mean(first_third))
        end_mean = float(np.mean(last_third))
        if active_side_offsets is right_offsets:
            if start_mean > 0.2 and end_mean < -0.1:
                return True
        else:
            if start_mean < -0.2 and end_mean > 0.1:
                return True

    return False


def _detect_serve(
    wrist_heights: List[float],
    pose_data: List[Optional[Dict]],
    frame_height: int,
) -> bool:
    if not wrist_heights or len(wrist_heights) < 10:
        return False

    high_frames = sum(1 for h in wrist_heights if h > 0.25)
    high_ratio = high_frames / len(wrist_heights)

    if high_ratio < 0.15:
        return False

    peak_height = max(wrist_heights)
    if peak_height < 0.3:
        return False

    trophy_detected = False
    for p in pose_data:
        if p is None:
            continue
        rw = p.get("right_wrist")
        lw = p.get("left_wrist")
        rs = p.get("right_shoulder")
        ls = p.get("left_shoulder")

        if rw and rs and rw.get("visibility", 0) > 0.4 and rs.get("visibility", 0) > 0.4:
            if (rs["y"] - rw["y"]) / frame_height > 0.2:
                if lw and lw.get("visibility", 0) > 0.4 and ls and ls.get("visibility", 0) > 0.4:
                    left_raised = (ls["y"] - lw["y"]) / frame_height > 0.05
                    if left_raised:
                        trophy_detected = True
                        break

    return trophy_detected and high_ratio > 0.2


def _determine_dominant_side(
    right_positions: List[Tuple[float, float]],
    left_positions: List[Tuple[float, float]],
    right_speeds: List[float],
    left_speeds: List[float],
    right_vis: int,
    left_vis: int,
    pose_data: List[Optional[Dict]],
    frame_width: int,
) -> str:
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

    if score_right > score_left:
        return "right"
    elif score_left > score_right:
        return "left"

    return "right" if right_vis >= left_vis else "left"
