from __future__ import annotations

from typing import Any, Dict, List, Optional


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return float(default)
    if out != out:  # NaN guard
        return float(default)
    return out


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _normalize_landmark(raw: Dict[str, Any], index: int) -> Dict[str, float | int]:
    # MediaPipe x/y are already normalized for image coordinates; normalize all outputs to [0, 1].
    x = _clamp01(_to_float(raw.get("x", 0.0), 0.0))
    y = _clamp01(_to_float(raw.get("y", 0.0), 0.0))

    z_raw = _to_float(raw.get("z", 0.0), 0.0)
    z = _clamp01((z_raw + 1.0) * 0.5)

    visibility = _clamp01(_to_float(raw.get("visibility", 0.0), 0.0))

    return {
        "id": int(index),
        "x": round(x, 6),
        "y": round(y, 6),
        "z": round(z, 6),
        "visibility": round(visibility, 6),
    }


def createSkeletonRecord(
    video_id: str,
    shot_id: int,
    frame_number: int,
    landmarks: List[Dict[str, Any]],
    timestamp: float = 0.0,
) -> Dict[str, Any]:
    normalized_landmarks = [
        _normalize_landmark(item, idx)
        for idx, item in enumerate(landmarks)
    ]

    return {
        "video_id": str(video_id),
        "shot_id": int(shot_id),
        "frame_number": int(frame_number),
        "timestamp": round(_to_float(timestamp, 0.0), 6),
        "landmarks": normalized_landmarks,
    }


def build_skeleton_dataset(
    video_id: str,
    shot_segments: List[Dict[str, Any]],
    frame_landmarks: List[List[Dict[str, Any]]],
    fps: float,
) -> Dict[str, Any]:
    safe_fps = _to_float(fps, 0.0)

    shots: List[Dict[str, Any]] = []
    for seg in shot_segments:
        shot_id = int(seg.get("index", len(shots) + 1))
        start_frame = int(seg.get("startFrame", -1))
        end_frame = int(seg.get("endFrame", -1))
        if start_frame < 0 or end_frame < start_frame:
            continue

        frames: List[Dict[str, Any]] = []
        for frame_idx in range(start_frame, end_frame + 1):
            landmarks = frame_landmarks[frame_idx] if 0 <= frame_idx < len(frame_landmarks) else []
            timestamp = (frame_idx / safe_fps) if safe_fps > 0 else 0.0
            record = createSkeletonRecord(
                video_id=video_id,
                shot_id=shot_id,
                frame_number=frame_idx + 1,
                landmarks=landmarks,
                timestamp=timestamp,
            )
            frames.append(
                {
                    "frame_number": record["frame_number"],
                    "timestamp": record["timestamp"],
                    "landmarks": record["landmarks"],
                }
            )

        shots.append(
            {
                "shot_id": shot_id,
                "frames": frames,
            }
        )

    return {
        "video_id": str(video_id),
        "shots": shots,
    }


def getShotSkeleton(video_skeleton: Dict[str, Any], video_id: str, shot_id: int) -> Optional[Dict[str, Any]]:
    if not isinstance(video_skeleton, dict):
        return None
    if str(video_skeleton.get("video_id", "")) != str(video_id):
        return None

    for shot in video_skeleton.get("shots", []) or []:
        if int(shot.get("shot_id", -1)) == int(shot_id):
            return shot
    return None


def getFrameSkeleton(
    video_skeleton: Dict[str, Any],
    video_id: str,
    shot_id: int,
    frame_number: int,
) -> Optional[Dict[str, Any]]:
    shot = getShotSkeleton(video_skeleton, video_id, shot_id)
    if not shot:
        return None

    for frame in shot.get("frames", []) or []:
        if int(frame.get("frame_number", -1)) == int(frame_number):
            return frame
    return None


def getShotSkeletonRange(
    video_skeleton: Dict[str, Any],
    video_id: str,
    shot_id: int,
    start_frame: Optional[int] = None,
    end_frame: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    shot = getShotSkeleton(video_skeleton, video_id, shot_id)
    if not shot:
        return None

    frames = shot.get("frames", []) or []
    if start_frame is None and end_frame is None:
        return {
            "video_id": str(video_id),
            "shot_id": int(shot_id),
            "frames": frames,
        }

    s = int(start_frame) if start_frame is not None else None
    e = int(end_frame) if end_frame is not None else None

    filtered: List[Dict[str, Any]] = []
    for frame in frames:
        n = int(frame.get("frame_number", -1))
        if s is not None and n < s:
            continue
        if e is not None and n > e:
            continue
        filtered.append(frame)

    return {
        "video_id": str(video_id),
        "shot_id": int(shot_id),
        "frames": filtered,
    }
