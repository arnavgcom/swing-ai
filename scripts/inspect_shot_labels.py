import json
import cv2
from python_analysis.pose_detector import PoseDetector
from python_analysis.movement_classifier import _segment_swings, classify_segment_movement, _extract_features


def main() -> None:
    video_path = "uploads/Coach Mayur-Tennis-AutoDetect-20260305-162050.mp4"

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    detector = PoseDetector()
    pose_data = []
    cap = cv2.VideoCapture(video_path)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        pose_data.append(detector.detect(frame))
    cap.release()
    detector.close()

    segments = _segment_swings(pose_data, fps, frame_width, frame_height)
    shots = []

    for index, (start, end) in enumerate(segments, 1):
        segment = pose_data[start : end + 1]
        label = classify_segment_movement(segment, "tennis", fps, frame_width, frame_height)
        features = _extract_features(segment, fps, frame_width, frame_height)

        rw = float(features.get("max_rw_speed", 0.0))
        lw = float(features.get("max_lw_speed", 0.0))

        shots.append(
            {
                "shot": index,
                "start": start,
                "end": end,
                "frames": end - start + 1,
                "label": label,
                "cross_body": bool(features.get("is_cross_body", False)),
                "dominant_side": features.get("dominant_side"),
                "max_rw_speed": round(rw, 4),
                "max_lw_speed": round(lw, 4),
                "speed_ratio_rw_lw": round(rw / max(lw, 1e-6), 3),
                "swing_arc_ratio": round(float(features.get("swing_arc_ratio", 0.0)), 4),
                "is_compact_forward": bool(features.get("is_compact_forward", False)),
            }
        )

    print(
        json.dumps(
            {
                "fps": fps,
                "frame_width": frame_width,
                "frame_height": frame_height,
                "total_frames": len(pose_data),
                "shots": shots,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
