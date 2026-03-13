import numpy as np
import math
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer
from python_analysis.pose_detector import PoseDetector


class BadmintonSmashAnalyzer(BaseAnalyzer):
    config_key = "badminton-smash"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        shoulder_rotations = self._calc_shoulder_rotation(pose_data, fps)
        contact_heights = self._calc_contact_heights(valid_poses, frame_h)

        pixels_per_meter = frame_h / 1.8
        racket_speed = float(np.percentile(wrist_speeds, 95)) / pixels_per_meter if wrist_speeds else 40.0
        racket_speed = float(np.clip(racket_speed, 35.0, 60.0))

        shuttle_speed = self.ball_tracker.estimate_speed(fps, pixels_per_meter)
        shuttle_speed = float(np.clip(shuttle_speed, 150.0, 300.0)) if shuttle_speed > 0 else float(220.00)

        jump_height = self._calc_jump_height(pose_data, frame_h)

        contact_h = float(np.median(contact_heights)) if contact_heights else 2.7
        contact_h = float(np.clip(contact_h * 1.2, 2.5, 3.2))

        wrist_snap = self._calc_wrist_snap(pose_data, fps)

        body_rotation = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 700.0
        body_rotation = float(np.clip(body_rotation, 500.0, 1000.0))

        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "racketSpeed": round(racket_speed, 2),
            "shuttleSpeed": round(shuttle_speed, 2),
            "jumpHeight": round(jump_height, 2),
            "contactHeight": round(contact_h, 2),
            "wristSnap": round(wrist_snap, 2),
            "bodyRotation": round(body_rotation, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_jump_height(self, pose_data: List[Optional[Dict]], frame_h: int) -> float:
        ankle_ys = []
        for p in pose_data:
            if p is None:
                continue
            la = p.get("left_ankle")
            ra = p.get("right_ankle")
            if la and ra and la.get("visibility", 0) > 0.4 and ra.get("visibility", 0) > 0.4:
                avg_y = (la["y"] + ra["y"]) / 2
                ankle_ys.append(avg_y)

        if len(ankle_ys) < 5:
            return 0.3

        baseline = np.percentile(ankle_ys, 90)
        min_y = min(ankle_ys)
        jump_px = baseline - min_y
        jump_m = (jump_px / frame_h) * 1.8
        return float(np.clip(jump_m, 0.2, 0.6))

    def _calc_wrist_snap(self, pose_data: List[Optional[Dict]], fps: float) -> float:
        wrist_rotation_speeds = []
        dt = 1.0 / fps
        prev_angle = None

        for p in pose_data:
            if p is None:
                prev_angle = None
                continue
            elbow = p.get("right_elbow") or p.get("left_elbow")
            wrist = p.get("right_wrist") or p.get("left_wrist")
            if elbow and wrist and elbow.get("visibility", 0) > 0.4 and wrist.get("visibility", 0) > 0.4:
                dx = wrist["x"] - elbow["x"]
                dy = wrist["y"] - elbow["y"]
                angle = math.degrees(math.atan2(dy, dx))
                if prev_angle is not None:
                    vel = abs(angle - prev_angle) / dt
                    if vel < 2000:
                        wrist_rotation_speeds.append(vel)
                prev_angle = angle
            else:
                prev_angle = None

        if wrist_rotation_speeds:
            return float(np.clip(np.percentile(wrist_rotation_speeds, 90), 400.0, 800.0))
        return 550.0

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["racketSpeed"], 35.0, 60.0) * 0.4
             + self._normalize(m["shuttleSpeed"], 150.0, 300.0) * 0.4
             + self._normalize(m["wristSnap"], 400.0, 800.0) * 0.2) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["wristSnap"], 400.0, 800.0) * 0.4
             + self._normalize(m["contactHeight"], 2.5, 3.2) * 0.3
             + self._normalize(m["bodyRotation"], 500.0, 1000.0) * 0.3) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100
        ), 0, 100))

        athleticism = int(np.clip(round(
            (self._normalize(m["jumpHeight"], 0.2, 0.6) * 0.5
             + self._normalize(m["bodyRotation"], 500.0, 1000.0) * 0.5) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100
        ), 0, 100))

        return {
            "power": power,
            "technique": technique,
            "timing": timing,
            "athleticism": athleticism,
            "consistency": consistency,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.30
            + sub_scores["technique"] * 0.25
            + sub_scores["timing"] * 0.20
            + sub_scores["athleticism"] * 0.15
            + sub_scores["consistency"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "smash")

    def _fallback_metrics(self) -> Dict:
        return {
            "racketSpeed": 42.0,
            "shuttleSpeed": 200.0,
            "jumpHeight": 0.35,
            "contactHeight": 2.8,
            "wristSnap": 550.0,
            "bodyRotation": 700.0,
            "rhythmConsistency": 72.0,
        }
