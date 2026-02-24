import cv2
import numpy as np
import mediapipe as mp
import math
from typing import List, Dict, Optional, Tuple


class PoseDetector:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.landmark_names = {
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

    def detect(self, frame: np.ndarray) -> Optional[Dict]:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb)

        if not results.pose_landmarks:
            return None

        h, w = frame.shape[:2]
        landmarks = {}
        for idx, name in self.landmark_names.items():
            lm = results.pose_landmarks.landmark[idx]
            landmarks[name] = {
                "x": lm.x * w,
                "y": lm.y * h,
                "z": lm.z,
                "visibility": lm.visibility,
            }

        return landmarks

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
        self.pose.close()
