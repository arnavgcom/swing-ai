import cv2
import numpy as np
import mediapipe as mp
import math
import os
from typing import Any, List, Dict, Optional, Tuple

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
RunningMode = mp.tasks.vision.RunningMode


class PoseDetector:
    LANDMARK_MAP = {
        0: "nose",
        11: "left_shoulder",
        12: "right_shoulder",
        13: "left_elbow",
        14: "right_elbow",
        15: "left_wrist",
        16: "right_wrist",
        23: "left_hip",
        24: "right_hip",
        25: "left_knee",
        26: "right_knee",
        27: "left_ankle",
        28: "right_ankle",
    }

    def __init__(self):
        model_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "models",
            "pose_landmarker_lite.task",
        )

        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.landmarker = PoseLandmarker.create_from_options(options)
        self._timestamp_ms = 0

    @staticmethod
    def _clamp01(value: float) -> float:
        return float(max(0.0, min(1.0, value)))

    def _detect_pose(self, frame: np.ndarray) -> Optional[Tuple[Any, int, int]]:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        self._timestamp_ms += 33
        result = self.landmarker.detect_for_video(mp_image, self._timestamp_ms)

        if not result.pose_landmarks or len(result.pose_landmarks) == 0:
            return None

        h, w = frame.shape[:2]
        pose = result.pose_landmarks[0]
        return pose, h, w

    def _build_named_landmarks(self, pose: Any, h: int, w: int) -> Dict[str, Dict[str, float]]:
        landmarks: Dict[str, Dict[str, float]] = {}
        for idx, name in self.LANDMARK_MAP.items():
            if idx < len(pose):
                lm = pose[idx]
                landmarks[name] = {
                    "x": float(lm.x) * float(w),
                    "y": float(lm.y) * float(h),
                    "z": float(lm.z),
                    "visibility": float(lm.visibility),
                }
        return landmarks

    def _build_full_landmarks(self, pose: Any) -> List[Dict[str, float | int]]:
        out: List[Dict[str, float | int]] = []
        for idx, lm in enumerate(pose):
            out.append(
                {
                    "id": int(idx),
                    "x": self._clamp01(float(lm.x)),
                    "y": self._clamp01(float(lm.y)),
                    "z": self._clamp01((float(lm.z) + 1.0) * 0.5),
                    "visibility": self._clamp01(float(lm.visibility)),
                }
            )
        return out

    def detect(self, frame: np.ndarray) -> Optional[Dict]:
        detected = self._detect_pose(frame)
        if not detected:
            return None

        pose, h, w = detected
        landmarks = self._build_named_landmarks(pose, h, w)
        return landmarks if landmarks else None

    def detect_with_skeleton(self, frame: np.ndarray) -> Tuple[Optional[Dict], List[Dict[str, float | int]]]:
        detected = self._detect_pose(frame)
        if not detected:
            return None, []

        pose, h, w = detected
        named_landmarks = self._build_named_landmarks(pose, h, w)
        full_landmarks = self._build_full_landmarks(pose)
        return (named_landmarks if named_landmarks else None), full_landmarks

    @staticmethod
    def calc_angle(a: Dict, b: Dict, c: Dict) -> float:
        ba = np.array([a["x"] - b["x"], a["y"] - b["y"]])
        bc = np.array([c["x"] - b["x"], c["y"] - b["y"]])
        cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
        return float(np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0))))

    @staticmethod
    def calc_distance(a: Dict, b: Dict) -> float:
        return float(math.sqrt((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2))

    @staticmethod
    def calc_velocity(pos1: Dict, pos2: Dict, dt: float) -> float:
        if dt <= 0:
            return 0.0
        dx = pos2["x"] - pos1["x"]
        dy = pos2["y"] - pos1["y"]
        return float(math.sqrt(dx**2 + dy**2) / dt)

    def close(self):
        self.landmarker.close()
