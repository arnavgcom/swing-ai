#!/usr/bin/env python3
import sys
import json
import argparse
import traceback
from typing import Dict, List


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


def _apply_tennis_temporal_smoothing(shot_label_diagnostics: List[Dict]) -> None:
    tennis_labels = {"forehand", "backhand"}
    n = len(shot_label_diagnostics)
    if n < 3:
        return

    labels = [str(d.get("label", "unknown")) for d in shot_label_diagnostics]

    def _confidence(i: int) -> float:
        return float(shot_label_diagnostics[i].get("confidence", 0.0))

    def _reasons(i: int) -> List[str]:
        return [str(r) for r in shot_label_diagnostics[i].get("reasons", [])]

    def _try_flip(i: int, target_label: str, conf_limit: float) -> None:
        if labels[i] not in tennis_labels or target_label not in tennis_labels:
            return
        if labels[i] == target_label:
            return
        if _confidence(i) > conf_limit:
            return
        if _has_strong_backhand_evidence(_reasons(i)) and labels[i] == "backhand":
            return
        if _has_strong_forehand_evidence(_reasons(i)) and labels[i] == "forehand":
            return

        shot = shot_label_diagnostics[i]
        if "rawLabel" not in shot:
            shot["rawLabel"] = shot.get("label")
        shot["label"] = target_label
        reasons = list(shot.get("reasons", []))
        reasons.append("temporal_consistency_normalized")
        shot["reasons"] = reasons
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


def _apply_tennis_auto_detect_majority_normalization(shot_label_diagnostics: List[Dict]) -> None:
    tennis_labels = {"forehand", "backhand"}
    labeled = [
        d for d in shot_label_diagnostics
        if str(d.get("label", "unknown")) in tennis_labels
    ]
    total = len(labeled)
    if total < 6:
        return

    forehands = [d for d in labeled if str(d.get("label")) == "forehand"]
    backhands = [d for d in labeled if str(d.get("label")) == "backhand"]

    if len(forehands) >= len(backhands):
        target_label = "forehand"
        opposite = backhands
    else:
        target_label = "backhand"
        opposite = forehands

    target_ratio = max(len(forehands), len(backhands)) / max(total, 1)
    if target_ratio < 0.66 or len(opposite) > 2:
        return

    # Preserve truly strong opposite evidence.
    opposite_strong = [
        d for d in opposite
        if float(d.get("confidence", 0.0)) >= 0.97
    ]
    if opposite_strong:
        return

    for d in opposite:
        d["rawLabel"] = d.get("label")
        d["label"] = target_label
        reasons = list(d.get("reasons", []))
        reasons.append("auto_detect_majority_normalized")
        d["reasons"] = reasons


def main():
    parser = argparse.ArgumentParser(description="Swing AI Sport Analysis")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--sport", default="tennis", help="Sport name (e.g., tennis, golf)")
    parser.add_argument("--movement", default="forehand", help="Movement name (e.g., forehand, drive)")
    parser.add_argument("--dominant-profile", default="", help="Player dominant side: right or left")

    args = parser.parse_args()

    movement_aliases = {
        "iron-shot": "iron",
    }

    sport = args.sport.lower().replace(' ', '').replace('_', '')
    movement = args.movement.lower().replace(' ', '-').replace('_', '-')
    dominant_profile = args.dominant_profile.lower().strip()
    preferred_dominant_side = dominant_profile if dominant_profile in ("right", "left") else None
    movement = movement_aliases.get(movement, movement)
    user_config_key = f"{sport}-{movement}"

    try:
        import cv2
        from python_analysis.pose_detector import PoseDetector
        from python_analysis.ball_tracker import BallTracker
        from python_analysis.movement_classifier import (
            classify_movement,
            classify_segment_movement,
            classify_segment_movement_with_diagnostics,
            validate_sport_match,
            _segment_swings,
        )
        from python_analysis.background_analyzer import analyze_background
        from python_analysis.sports.registry import get_analyzer

        cap = cv2.VideoCapture(args.video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {args.video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        detected_movement = movement
        movement_overridden = False

        detector = PoseDetector()
        cap2 = cv2.VideoCapture(args.video_path)
        pose_data = []
        while True:
            ret, frame = cap2.read()
            if not ret:
                break
            landmarks = detector.detect(frame)
            pose_data.append(landmarks)
        cap2.release()
        detector.close()

        bg_features = analyze_background(args.video_path, pose_data)

        validation = validate_sport_match(
            pose_data, sport, fps, frame_width, frame_height,
            bg_features=bg_features,
        )

        if not validation["valid"]:
            print(json.dumps({
                "rejected": True,
                "rejectionReason": validation["reason"],
                "confidence": validation["confidence"],
            }))
            sys.exit(0)

        classified, shot_count = classify_movement(
            pose_data,
            sport,
            fps,
            frame_width,
            frame_height,
            preferred_dominant_side,
        )

        shot_ranges = _segment_swings(pose_data, fps, frame_width, frame_height)

        shot_label_diagnostics = []
        for idx, (start, end) in enumerate(shot_ranges, 1):
            segment = pose_data[start:end + 1]
            valid_count = sum(1 for p in segment if p is not None)
            if valid_count < 3:
                continue
            diag = classify_segment_movement_with_diagnostics(
                segment,
                sport,
                fps,
                frame_width,
                frame_height,
                preferred_dominant_side,
            )
            diag["shotIndex"] = idx
            diag["startFrame"] = start
            diag["endFrame"] = end
            diag["validPoseFrames"] = valid_count
            shot_label_diagnostics.append(diag)

        target_drill_label = movement if movement in ("forehand", "backhand") else ""

        if sport == "tennis" and target_drill_label in ("forehand", "backhand"):
            opposite = "backhand" if target_drill_label == "forehand" else "forehand"
            labeled_strokes = [
                str(d.get("label", "unknown"))
                for d in shot_label_diagnostics
                if str(d.get("label", "unknown")) in ("forehand", "backhand")
            ]
            target_count = sum(1 for label in labeled_strokes if label == target_drill_label)
            opposite_count = sum(1 for label in labeled_strokes if label == opposite)
            total_labeled = len(labeled_strokes)
            target_ratio = (target_count / max(total_labeled, 1)) if total_labeled else 0.0
            opposite_confident = [
                d for d in shot_label_diagnostics
                if str(d.get("label", "unknown")) == opposite and float(d.get("confidence", 0.0)) >= 0.90
            ]

            # Normalize only for clear, longer drill clips with near-unanimous stroke type.
            should_normalize = (
                total_labeled >= 6
                and target_ratio >= 0.65
                and opposite_count <= 2
                and len(opposite_confident) == 0
            )

            if should_normalize:
                for d in shot_label_diagnostics:
                    if str(d.get("label", "unknown")) == opposite:
                        d["rawLabel"] = d.get("label")
                        d["label"] = target_drill_label
                        reasons = list(d.get("reasons", []))
                        reasons.append("drill_prior_normalized")
                        d["reasons"] = reasons

            # Short explicit drill clips can contain a single ambiguous opposite label.
            # If opposite confidence is modest and evidence is weak, prefer selected drill side.
            if total_labeled <= 4:
                for i, d in enumerate(shot_label_diagnostics):
                    if i not in (0, len(shot_label_diagnostics) - 1):
                        continue
                    label = str(d.get("label", "unknown"))
                    confidence = float(d.get("confidence", 0.0))
                    reasons = [str(r) for r in d.get("reasons", [])]
                    if label != opposite or confidence >= 0.82:
                        continue
                    if target_drill_label == "forehand" and _has_strong_backhand_evidence(reasons):
                        continue
                    if target_drill_label == "backhand" and _has_strong_forehand_evidence(reasons):
                        continue
                    d["rawLabel"] = d.get("label")
                    d["label"] = target_drill_label
                    updated_reasons = list(d.get("reasons", []))
                    updated_reasons.append("short_drill_confidence_normalized")
                    d["reasons"] = updated_reasons

        if sport == "tennis" and movement == "auto-detect":
            _apply_tennis_auto_detect_majority_normalization(shot_label_diagnostics)

        if sport == "tennis":
            _apply_tennis_temporal_smoothing(shot_label_diagnostics)

        detected_movement = movement
        movement_overridden = False
        if classified != movement and classified != "unknown":
            should_override = True

            if sport == "tennis" and movement in ("forehand", "backhand") and classified in ("forehand", "backhand"):
                confident_votes = {
                    "forehand": 0,
                    "backhand": 0,
                }
                vote_conf_threshold = {
                    "forehand": 0.62,
                    "backhand": 0.74,
                }
                for diag in shot_label_diagnostics:
                    label = str(diag.get("label", "unknown"))
                    confidence = float(diag.get("confidence", 0.0))
                    if label in confident_votes and confidence >= vote_conf_threshold[label]:
                        confident_votes[label] += 1

                total_confident = confident_votes["forehand"] + confident_votes["backhand"]
                classified_votes = confident_votes.get(classified, 0)
                selected_votes = confident_votes.get(movement, 0)

                should_override = (
                    total_confident >= 2
                    and classified_votes >= max(selected_votes + 2, int(total_confident * 0.65))
                )

            if should_override:
                detected_movement = classified
                movement_overridden = True

        scored_shot_ranges = []
        scored_frames = 0
        for idx, (start, end) in enumerate(shot_ranges, 1):
            segment = pose_data[start:end + 1]
            valid_count = sum(1 for p in segment if p is not None)
            if valid_count < 3:
                continue
            diag = next((d for d in shot_label_diagnostics if int(d.get("shotIndex", -1)) == idx), None)
            if diag is not None:
                segment_label = str(diag.get("label", "unknown"))
            else:
                segment_label = classify_segment_movement(
                    segment,
                    sport,
                    fps,
                    frame_width,
                    frame_height,
                )
            if segment_label != detected_movement:
                continue
            scored_shot_ranges.append((start, end))
            scored_frames += valid_count

        min_scoring_frames = max(5, int(len(pose_data) * 0.05))
        use_shot_window_scoring = scored_frames >= min_scoring_frames and len(scored_shot_ranges) > 0

        if movement_overridden:
            actual_config_key = f"{sport}-{detected_movement}"
        else:
            actual_config_key = user_config_key

        try:
            analyzer = get_analyzer(actual_config_key)
        except ValueError:
            analyzer = get_analyzer(user_config_key)
            detected_movement = movement
            movement_overridden = False

        result = analyzer.analyze_video(
            args.video_path,
            include_frame_ranges=scored_shot_ranges if use_shot_window_scoring else None,
        )
        analyzer.close()

        result["detectedMovement"] = detected_movement
        result["movementOverridden"] = movement_overridden
        result["userSelectedMovement"] = movement
        result["shotCount"] = shot_count
        result["shotsConsideredForScoring"] = len(scored_shot_ranges) if use_shot_window_scoring else shot_count
        result["frameRangesUsedForScoring"] = scored_shot_ranges if use_shot_window_scoring else []
        result["idleTimeExcluded"] = bool(use_shot_window_scoring)
        result["shotLabelDiagnostics"] = shot_label_diagnostics

        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        error_info = {
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
        print(json.dumps(error_info), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
