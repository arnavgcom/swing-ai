import numpy as np
import math
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer
from python_analysis.pose_detector import PoseDetector


class BadmintonDropAnalyzer(BaseAnalyzer):
    config_key = "badminton-drop"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)

        touch_score = self._calc_touch_score(wrist_speeds)
        deception_score = self._calc_deception_score(wrist_speeds, elbow_angles)

        trajectory_arc = self.ball_tracker.estimate_trajectory_arc()
        net_clearance = float(np.clip(trajectory_arc * 2.0, 2.0, 15.0)) if trajectory_arc > 0 else float(7.00)

        racket_angle = self._calc_racket_angle(valid_poses)
        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "touchScore": round(touch_score, 2),
            "deceptionScore": round(deception_score, 2),
            "netClearance": round(net_clearance, 2),
            "racketAngle": round(racket_angle, 2),
            "shotConsistency": round(shot_consistency, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_touch_score(self, wrist_speeds: List[float]) -> float:
        if not wrist_speeds:
            return 78.0
        peak = float(np.max(wrist_speeds))
        mean = float(np.mean(wrist_speeds))
        ratio = peak / mean if mean > 0 else 2.0
        score = float(np.clip(100 - abs(ratio - 1.5) * 30, 70, 98))
        return score

    def _calc_deception_score(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        if len(wrist_speeds) < 3 or len(elbow_angles) < 3:
            return 75.0
        speed_std = float(np.std(wrist_speeds))
        angle_std = float(np.std(elbow_angles))
        variability = self._normalize(speed_std, 0, 50) * 0.5 + self._normalize(angle_std, 0, 30) * 0.5
        score = float(np.clip(variability * 100, 65, 95))
        return score

    def _calc_racket_angle(self, poses: List[Dict]) -> float:
        angles = []
        for p in poses:
            elbow = p.get("right_elbow") or p.get("left_elbow")
            wrist = p.get("right_wrist") or p.get("left_wrist")
            if elbow and wrist and elbow.get("visibility", 0) > 0.4 and wrist.get("visibility", 0) > 0.4:
                dx = wrist["x"] - elbow["x"]
                dy = wrist["y"] - elbow["y"]
                angle = abs(math.degrees(math.atan2(dy, dx)))
                if 10 < angle < 90:
                    angles.append(angle)

        if angles:
            return float(np.clip(np.mean(angles), 20.0, 45.0))
        return 30.0

    def _compute_sub_scores(self, m: Dict) -> Dict:
        touch = int(np.clip(round(
            (self._normalize(m["touchScore"], 70.0, 98.0) * 0.5
             + self._normalize(m["netClearance"], 2.0, 15.0) * 0.5) * 100
        ), 0, 100))

        deception = int(np.clip(round(
            self._normalize(m["deceptionScore"], 65.0, 95.0) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["racketAngle"], 20.0, 45.0) * 0.5
             + self._normalize(m["touchScore"], 70.0, 98.0) * 0.5) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            self._normalize(m["shotConsistency"], 70.0, 98.0) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100
        ), 0, 100))

        return {
            "touch": touch,
            "deception": deception,
            "technique": technique,
            "consistency": consistency,
            "timing": timing,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["touch"] * 0.30
            + sub_scores["deception"] * 0.25
            + sub_scores["technique"] * 0.20
            + sub_scores["consistency"] * 0.15
            + sub_scores["timing"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "drop shot")

    def _fallback_metrics(self) -> Dict:
        return {
            "touchScore": 78.0,
            "deceptionScore": 75.0,
            "netClearance": 7.0,
            "racketAngle": 30.0,
            "shotConsistency": 72.0,
            "rhythmConsistency": 72.0,
        }
