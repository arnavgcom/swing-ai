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
        from python_analysis.movement_classifier import classify_movement
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

        classified = classify_movement(
            pose_data, sport, fps, frame_width, frame_height
        )

        if classified != movement and classified != "unknown":
            detected_movement = classified
            movement_overridden = True
            actual_config_key = f"{sport}-{detected_movement}"
        else:
            actual_config_key = user_config_key

        try:
            analyzer = get_analyzer(actual_config_key)
        except ValueError:
            analyzer = get_analyzer(user_config_key)
            detected_movement = movement
            movement_overridden = False

        result = analyzer.analyze_video(args.video_path)
        analyzer.close()

        result["detectedMovement"] = detected_movement
        result["movementOverridden"] = movement_overridden
        result["userSelectedMovement"] = movement

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
