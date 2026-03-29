import argparse
import json
import sys
import traceback
from typing import Any, Dict, List, Optional


DEFAULT_POSE_SAMPLE_COUNT = 24


def _build_sample_indices(total_frames: int, sample_count: int) -> List[int]:
    if total_frames <= 0:
        return []

    if total_frames <= sample_count:
        return list(range(total_frames))

    start_index = max(0, int(total_frames * 0.05))
    end_index = max(start_index, min(total_frames - 1, int(total_frames * 0.95)))

    if sample_count <= 1 or start_index == end_index:
        return [start_index]

    indices: List[int] = []
    for sample_number in range(sample_count):
        position = start_index + ((end_index - start_index) * sample_number / (sample_count - 1))
        frame_index = int(round(position))
        if not indices or frame_index != indices[-1]:
            indices.append(frame_index)

    return indices


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate whether a video matches a requested sport")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--sport", required=True, help="Sport name to validate against")
    parser.add_argument(
        "--sample-count",
        type=int,
        default=DEFAULT_POSE_SAMPLE_COUNT,
        help="Number of evenly spaced frames to sample for lightweight sport validation",
    )
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
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        sample_count = max(1, int(args.sample_count or DEFAULT_POSE_SAMPLE_COUNT))
        sample_indices = _build_sample_indices(total_frames, sample_count)
        if not sample_indices:
            raise ValueError(f"Could not determine readable frames for video: {args.video_path}")

        detector = PoseDetector()
        cap2 = cv2.VideoCapture(args.video_path)
        pose_data: List[Optional[Dict[str, Any]]] = [None] * max(total_frames, sample_indices[-1] + 1)
        for frame_index in sample_indices:
            cap2.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ret, frame = cap2.read()
            if not ret:
                continue
            pose_data[frame_index] = detector.detect(frame)
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
                "totalFrames": total_frames,
                "sampledFrames": len(sample_indices),
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