import argparse
import json
import sys
import traceback
from typing import Any, Dict, List, Optional


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate whether a video matches a requested sport")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--sport", required=True, help="Sport name to validate against")
    args = parser.parse_args()

    try:
        import cv2
        from python_analysis.pose_detector import PoseDetector
        from python_analysis.background_analyzer import analyze_background
        from python_analysis.movement_classifier import (
            _compute_body_presence_metrics,
            validate_sport_match,
        )

        cap = cv2.VideoCapture(args.video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {args.video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        detector = PoseDetector()
        cap2 = cv2.VideoCapture(args.video_path)
        pose_data: List[Optional[Dict[str, Any]]] = []
        while True:
            ret, frame = cap2.read()
            if not ret:
                break
            landmarks, _ = detector.detect_with_skeleton(frame)
            pose_data.append(landmarks)
        cap2.release()
        detector.close()

        bg_features = analyze_background(args.video_path, pose_data)
        validation = validate_sport_match(
            pose_data,
            str(args.sport),
            fps,
            frame_width,
            frame_height,
            bg_features=bg_features,
        )
        body_presence = _compute_body_presence_metrics(pose_data, frame_width, frame_height)

        print(json.dumps({
            "sport": str(args.sport).lower().replace(" ", "").replace("_", ""),
            "valid": bool(validation.get("valid", False)),
            "reason": str(validation.get("reason", "") or ""),
            "confidence": float(validation.get("confidence", 0.0) or 0.0),
            "bodyPresence": body_presence,
            "background": bg_features,
            "frame": {
                "width": frame_width,
                "height": frame_height,
                "fps": fps,
            },
        }))
        sys.exit(0)
    except Exception as exc:
        print(json.dumps({
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()