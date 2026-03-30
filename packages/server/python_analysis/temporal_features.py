"""Extract fixed-length temporal feature sequences from raw pose data.

Each shot segment is a variable-length list of per-frame pose dicts. This module
normalises every segment into a (SEQ_LEN, NUM_FEATURES) matrix via linear
interpolation so that it can be fed directly into an LSTM.

Features per timestep (10 total):
  0  rw_x              — right wrist x (normalised by frame_width)
  1  rw_y              — right wrist y (normalised by frame_height)
  2  rw_speed          — right wrist speed (norm √(Δx²+Δy²)/dt)
  3  lw_x              — left wrist x (normalised)
  4  lw_y              — left wrist y (normalised)
  5  lw_speed          — left wrist speed (norm)
  6  shoulder_angle     — shoulder line angle in radians / π (→ [-1, 1])
  7  wrist_height_rel  — dominant wrist height relative to shoulder
  8  contact_height    — wrist y / frame_height (lower = higher on screen)
  9  body_center_x     — midpoint of shoulders (normalised)
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np

SEQ_LEN = 32
NUM_FEATURES = 10


def _safe(joint: Optional[Dict[str, Any]], key: str, fallback: float = 0.0) -> float:
    if joint is None:
        return fallback
    val = joint.get(key)
    if val is None:
        return fallback
    return float(val)


def _visible(joint: Optional[Dict[str, Any]], threshold: float = 0.4) -> bool:
    if joint is None:
        return False
    return float(joint.get("visibility", 0.0)) > threshold


def extract_temporal_sequence(
    pose_data: List[Optional[Dict[str, Any]]],
    fps: float,
    frame_width: int,
    frame_height: int,
) -> np.ndarray:
    """Return a (SEQ_LEN, NUM_FEATURES) float32 array from raw pose frames.

    If the segment is shorter than SEQ_LEN valid frames, 1-D interpolation is
    applied along axis-0 to upsample. If longer, it is downsampled.
    Zero-filled if the whole segment is empty.
    """
    dt = 1.0 / fps if fps > 0 else 1.0 / 30.0
    fw = max(frame_width, 1)
    fh = max(frame_height, 1)

    raw_rows: List[np.ndarray] = []
    prev_rw: Optional[tuple] = None
    prev_lw: Optional[tuple] = None

    for p in pose_data:
        if p is None:
            prev_rw = None
            prev_lw = None
            continue

        rw = p.get("right_wrist")
        lw = p.get("left_wrist")
        rs = p.get("right_shoulder")
        ls = p.get("left_shoulder")

        rw_x = _safe(rw, "x") / fw if _visible(rw) else 0.0
        rw_y = _safe(rw, "y") / fh if _visible(rw) else 0.0
        lw_x = _safe(lw, "x") / fw if _visible(lw) else 0.0
        lw_y = _safe(lw, "y") / fh if _visible(lw) else 0.0

        # Wrist speeds
        rw_speed = 0.0
        if _visible(rw) and prev_rw is not None:
            rw_speed = math.sqrt(
                ((rw_x - prev_rw[0]) * fw) ** 2 + ((rw_y - prev_rw[1]) * fh) ** 2
            ) / (fw * dt)
        lw_speed = 0.0
        if _visible(lw) and prev_lw is not None:
            lw_speed = math.sqrt(
                ((lw_x - prev_lw[0]) * fw) ** 2 + ((lw_y - prev_lw[1]) * fh) ** 2
            ) / (fw * dt)

        prev_rw = (rw_x, rw_y) if _visible(rw) else None
        prev_lw = (lw_x, lw_y) if _visible(lw) else None

        # Shoulder angle normalised to [-1, 1]
        shoulder_angle = 0.0
        body_center_x = 0.5
        if _visible(rs) and _visible(ls):
            rs_x, rs_y = _safe(rs, "x"), _safe(rs, "y")
            ls_x, ls_y = _safe(ls, "x"), _safe(ls, "y")
            shoulder_angle = math.atan2(rs_y - ls_y, rs_x - ls_x) / math.pi
            body_center_x = ((rs_x + ls_x) / 2.0) / fw

        # Wrist height relative to shoulder
        wrist = rw if _visible(rw) else lw
        shoulder = rs if _visible(rs) else ls
        wrist_height_rel = 0.0
        if _visible(wrist) and _visible(shoulder):
            wrist_height_rel = (_safe(shoulder, "y") - _safe(wrist, "y")) / fh

        contact_height = _safe(wrist, "y") / fh if _visible(wrist) else 0.5

        raw_rows.append(np.array([
            rw_x, rw_y, rw_speed,
            lw_x, lw_y, lw_speed,
            shoulder_angle,
            wrist_height_rel,
            contact_height,
            body_center_x,
        ], dtype=np.float32))

    if len(raw_rows) == 0:
        return np.zeros((SEQ_LEN, NUM_FEATURES), dtype=np.float32)

    raw = np.stack(raw_rows, axis=0)  # (T, NUM_FEATURES)
    return _resample(raw, SEQ_LEN)


def _resample(arr: np.ndarray, target_len: int) -> np.ndarray:
    """Linearly interpolate arr (T, F) to (target_len, F)."""
    t = arr.shape[0]
    if t == target_len:
        return arr.astype(np.float32)
    src_indices = np.linspace(0, t - 1, target_len)
    resampled = np.zeros((target_len, arr.shape[1]), dtype=np.float32)
    for col in range(arr.shape[1]):
        resampled[:, col] = np.interp(src_indices, np.arange(t), arr[:, col])
    return resampled


def temporal_sequence_to_list(seq: np.ndarray) -> List[List[float]]:
    """Convert (SEQ_LEN, NUM_FEATURES) ndarray to a JSON-serialisable list."""
    return [[round(float(v), 6) for v in row] for row in seq]


def temporal_sequence_from_list(data: List[List[float]]) -> np.ndarray:
    """Reconstruct ndarray from JSON list (inverse of temporal_sequence_to_list)."""
    arr = np.array(data, dtype=np.float32)
    if arr.ndim != 2 or arr.shape[1] != NUM_FEATURES:
        return np.zeros((SEQ_LEN, NUM_FEATURES), dtype=np.float32)
    if arr.shape[0] != SEQ_LEN:
        return _resample(arr, SEQ_LEN)
    return arr
