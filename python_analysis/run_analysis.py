#!/usr/bin/env python3
import sys
import json
import argparse
import traceback


def main():
    parser = argparse.ArgumentParser(description="Swing AI Sport Analysis")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--sport", default="tennis", help="Sport name (e.g., tennis, golf)")
    parser.add_argument("--movement", default="forehand", help="Movement name (e.g., forehand, drive)")

    args = parser.parse_args()

    movement_aliases = {
        "iron-shot": "iron",
    }

    sport = args.sport.lower().replace(' ', '').replace('_', '')
    movement = args.movement.lower().replace(' ', '-').replace('_', '-')
    movement = movement_aliases.get(movement, movement)
    user_config_key = f"{sport}-{movement}"

    try:
        import cv2
        from python_analysis.pose_detector import PoseDetector
        from python_analysis.ball_tracker import BallTracker
        from python_analysis.movement_classifier import (
            classify_movement,
            classify_segment_movement,
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
            pose_data, sport, fps, frame_width, frame_height
        )

        shot_ranges = _segment_swings(pose_data, fps, frame_width, frame_height)

        detected_movement = movement
        movement_overridden = False
        if classified != movement and classified != "unknown":
            detected_movement = classified
            movement_overridden = True

        scored_shot_ranges = []
        scored_frames = 0
        for start, end in shot_ranges:
            segment = pose_data[start:end + 1]
            valid_count = sum(1 for p in segment if p is not None)
            if valid_count < 3:
                continue
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
