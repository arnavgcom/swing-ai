#!/usr/bin/env python3
import argparse
import json
import os
import traceback
from collections import Counter
from typing import Any, Dict, List, Optional


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


def main():
    parser = argparse.ArgumentParser(description="Swing AI diagnostics")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--sport", default="tennis", help="Sport name")
    parser.add_argument("--movement", default="forehand", help="Movement name")
    args = parser.parse_args()

    sport = args.sport.lower().replace(" ", "").replace("_", "")
    movement = args.movement.lower().replace(" ", "-").replace("_", "-")

    try:
        import cv2
        from python_analysis.pose_detector import PoseDetector
        from python_analysis.movement_classifier import (
            classify_movement,
            classify_segment_movement,
            validate_sport_match,
            _segment_swings,
            _extract_features,
        )

        if not os.path.exists(args.video_path):
            raise FileNotFoundError(f"Video does not exist: {args.video_path}")

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
        while True:
            ret, frame = cap2.read()
            if not ret:
                break
            landmarks = detector.detect(frame)
            pose_data.append(landmarks)
        cap2.release()
        detector.close()

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
        )

        segments = _segment_swings(pose_data, fps, frame_width, frame_height)
        movement_per_segment: List[str] = []
        scoring_frames = 0
        shot_segments: List[Dict[str, Any]] = []
        excluded_shot_reasons: List[str] = []

        for seg_idx, (start, end) in enumerate(segments):
            segment_data = pose_data[start : end + 1]
            valid_segment = [p for p in segment_data if p is not None]
            if len(valid_segment) < 3:
                excluded_shot_reasons.append(
                    f"Shot {seg_idx + 1} excluded: insufficient valid pose frames"
                )
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
            )
            segment_features = _extract_features(
                segment_data,
                fps,
                frame_width,
                frame_height,
            )
            included_for_scoring = cls == dominant_movement
            if included_for_scoring:
                scoring_frames += len(valid_segment)
            else:
                excluded_shot_reasons.append(
                    f"Shot {seg_idx + 1} excluded: labeled {cls}, dominant movement is {dominant_movement}"
                )

            movement_per_segment.append(cls)
            shot_segments.append(
                {
                    "index": seg_idx + 1,
                    "startFrame": int(start),
                    "endFrame": int(end),
                    "label": cls,
                    "frames": len(segment_data),
                    "includedForScoring": included_for_scoring,
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
                    },
                }
            )

        movement_counts = dict(Counter(movement_per_segment))
        top_candidates = _to_top_candidates(dominant_movement, movement_counts)

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

        features = _extract_features(pose_data, fps, frame_width, frame_height)
        rationale = _build_rationale(sport, dominant_movement, movement_counts, features)

        bitrate_kbps = (
            (file_size_bytes * 8 / 1000.0) / duration_seconds
            if duration_seconds > 0
            else 0.0
        )

        diagnostics = {
            "videoDurationSec": round(float(duration_seconds), 2),
            "videoQuality": _estimate_quality(frame_width, frame_height, fps, avg_brightness, avg_blur),
            "fps": round(float(fps), 2),
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
            "excludedShots": {
                "count": int(len([s for s in shot_segments if not s.get("includedForScoring")])),
                "reasons": excluded_shot_reasons,
            },
            "movementTypeCounts": movement_counts,
            "aiConfidencePct": ai_confidence_pct,
            "detectedMovement": dominant_movement,
            "classificationRationale": rationale,
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
