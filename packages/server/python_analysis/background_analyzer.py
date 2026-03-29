import cv2
import numpy as np
from typing import Dict, List, Optional


def analyze_background(
    video_path: str,
    pose_data: List[Optional[Dict]],
    sample_count: int = 8,
) -> Dict:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return _empty_features()

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if total_frames < 2:
        cap.release()
        return _empty_features()

    sample_indices = np.linspace(
        int(total_frames * 0.1),
        int(total_frames * 0.9),
        min(sample_count, total_frames),
        dtype=int,
    )

    all_features: List[Dict] = []

    for idx in sample_indices:
        idx = int(idx)
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            continue

        pose = pose_data[idx] if idx < len(pose_data) else None
        mask = _create_body_mask(pose, frame_width, frame_height)
        bg_pixels = _extract_background(frame, mask)

        if bg_pixels is None or len(bg_pixels) < 100:
            continue

        features = _analyze_colors(bg_pixels)
        features["court_lines_detected"] = _detect_court_lines(frame, mask)
        all_features.append(features)

    cap.release()

    if not all_features:
        return _empty_features()

    return _average_features(all_features)


def _empty_features() -> Dict:
    return {
        "green_ratio": 0.0,
        "brown_ratio": 0.0,
        "blue_ratio": 0.0,
        "white_ratio": 0.0,
        "brightness_mean": 128.0,
        "brightness_variance": 50.0,
        "court_lines_detected": False,
        "sufficient": False,
    }


def _create_body_mask(
    pose: Optional[Dict],
    frame_width: int,
    frame_height: int,
) -> Optional[np.ndarray]:
    if pose is None:
        return None

    visible_points = []
    for name, lm in pose.items():
        if lm and lm.get("visibility", 0) > 0.3:
            visible_points.append((int(lm["x"]), int(lm["y"])))

    if len(visible_points) < 3:
        return None

    xs = [p[0] for p in visible_points]
    ys = [p[1] for p in visible_points]

    cx = (min(xs) + max(xs)) // 2
    cy = (min(ys) + max(ys)) // 2
    w = max(xs) - min(xs)
    h = max(ys) - min(ys)

    expand = 0.4
    x1 = max(0, int(cx - w * (0.5 + expand)))
    y1 = max(0, int(cy - h * (0.5 + expand)))
    x2 = min(frame_width, int(cx + w * (0.5 + expand)))
    y2 = min(frame_height, int(cy + h * (0.5 + expand)))

    mask = np.zeros((frame_height, frame_width), dtype=np.uint8)
    mask[y1:y2, x1:x2] = 255

    return mask


def _extract_background(
    frame: np.ndarray,
    body_mask: Optional[np.ndarray],
) -> Optional[np.ndarray]:
    if body_mask is None:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        return hsv.reshape(-1, 3)

    bg_mask = cv2.bitwise_not(body_mask)

    bg_pixel_count = np.count_nonzero(bg_mask)
    if bg_pixel_count < 100:
        return None

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    bg_pixels = hsv[bg_mask > 0]

    return bg_pixels


def _analyze_colors(hsv_pixels: np.ndarray) -> Dict:
    total = len(hsv_pixels)
    if total == 0:
        return {
            "green_ratio": 0.0,
            "brown_ratio": 0.0,
            "blue_ratio": 0.0,
            "white_ratio": 0.0,
            "brightness_mean": 128.0,
            "brightness_variance": 50.0,
        }

    h = hsv_pixels[:, 0]
    s = hsv_pixels[:, 1]
    v = hsv_pixels[:, 2]

    green_mask = (h >= 35) & (h <= 85) & (s >= 40) & (v >= 40)
    green_ratio = float(np.count_nonzero(green_mask)) / total

    brown_mask = (h >= 10) & (h <= 25) & (s >= 50) & (s <= 200) & (v >= 50) & (v <= 200)
    brown_ratio = float(np.count_nonzero(brown_mask)) / total

    blue_mask = (h >= 90) & (h <= 130) & (s >= 40) & (v >= 80)
    blue_ratio = float(np.count_nonzero(blue_mask)) / total

    white_mask = (s <= 40) & (v >= 200)
    white_ratio = float(np.count_nonzero(white_mask)) / total

    brightness_mean = float(np.mean(v))
    brightness_variance = float(np.var(v))

    return {
        "green_ratio": green_ratio,
        "brown_ratio": brown_ratio,
        "blue_ratio": blue_ratio,
        "white_ratio": white_ratio,
        "brightness_mean": brightness_mean,
        "brightness_variance": brightness_variance,
    }


def _detect_court_lines(
    frame: np.ndarray,
    body_mask: Optional[np.ndarray],
) -> bool:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    if body_mask is not None:
        bg_mask = cv2.bitwise_not(body_mask)
        gray = cv2.bitwise_and(gray, gray, mask=bg_mask)

    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    min_line_length = min(frame.shape[1], frame.shape[0]) * 0.15
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=80,
        minLineLength=int(min_line_length),
        maxLineGap=20,
    )

    if lines is None:
        return False

    long_lines = 0
    for line in lines:
        x1, y1, x2, y2 = line[0]
        length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        if length > min_line_length:
            long_lines += 1

    return long_lines >= 3


def _average_features(features_list: List[Dict]) -> Dict:
    if not features_list:
        return _empty_features()

    n = len(features_list)
    result = {
        "green_ratio": sum(f["green_ratio"] for f in features_list) / n,
        "brown_ratio": sum(f["brown_ratio"] for f in features_list) / n,
        "blue_ratio": sum(f["blue_ratio"] for f in features_list) / n,
        "white_ratio": sum(f["white_ratio"] for f in features_list) / n,
        "brightness_mean": sum(f["brightness_mean"] for f in features_list) / n,
        "brightness_variance": sum(f["brightness_variance"] for f in features_list) / n,
        "court_lines_detected": any(f.get("court_lines_detected", False) for f in features_list),
        "sufficient": n >= 2,
    }

    return result
