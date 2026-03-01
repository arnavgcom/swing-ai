import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class TableTennisLoopAnalyzer(BaseAnalyzer):
    config_key = "tabletennis-loop"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        shoulder_rotations = self._calc_shoulder_rotation(pose_data, fps)
        balance_scores = self._calc_balance_scores(valid_poses)
        elbow_angles = self._calc_elbow_angles(valid_poses)

        pixels_per_meter = frame_h / 1.8

        bat_speed = float(np.percentile(wrist_speeds, 90)) / pixels_per_meter if wrist_speeds else 14.0
        bat_speed = float(np.clip(bat_speed, 10.0, 22.0))

        body_rotation = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 400.0
        body_rotation = float(np.clip(body_rotation, 250.0, 600.0))

        spin_rate = bat_speed * 250.0 + body_rotation * 2.0
        spin_rate = float(np.clip(spin_rate, 3000.0, 6000.0))

        contact_point = self._calc_contact_point(valid_poses, wrist_speeds)
        contact_point = float(np.clip(contact_point, 65.0, 95.0))

        balance = float(np.mean(balance_scores)) if balance_scores else 78.0
        balance = float(np.clip(balance, 65.0, 95.0))

        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)
        rhythm_consistency = float(np.clip(rhythm_consistency, 60.0, 92.0))

        return {
            "batSpeed": round(bat_speed, 2),
            "bodyRotation": round(body_rotation, 2),
            "spinRate": round(spin_rate, 2),
            "contactPoint": round(contact_point, 2),
            "balanceScore": round(balance, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_contact_point(self, poses: List[Dict], wrist_speeds: List[float]) -> float:
        contact_heights = self._calc_contact_heights(poses, 720)
        if contact_heights:
            median_h = float(np.median(contact_heights))
            height_score = max(0, 100 - abs(median_h - 0.9) * 100)
        else:
            height_score = 75.0

        consistency = self._calc_shot_consistency(
            self._calc_elbow_angles(poses), wrist_speeds
        )
        return float(np.clip((height_score * 0.5 + consistency * 0.5), 60, 95))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["batSpeed"], 10.0, 22.0) * 0.5
             + self._normalize(m["bodyRotation"], 250.0, 600.0) * 0.3
             + self._normalize(m["spinRate"], 3000.0, 6000.0) * 0.2) * 100
        ), 0, 100))

        spin = int(np.clip(round(
            (self._normalize(m["spinRate"], 3000.0, 6000.0) * 0.6
             + self._normalize(m["batSpeed"], 10.0, 22.0) * 0.4) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["contactPoint"], 65.0, 95.0) * 0.4
             + self._normalize(m["bodyRotation"], 250.0, 600.0) * 0.3
             + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.3) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            (self._normalize(m["balanceScore"], 65.0, 95.0) * 0.6
             + self._normalize(m["rhythmConsistency"], 60.0, 92.0) * 0.4) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 60.0, 92.0) * 0.5
             + self._normalize(m["contactPoint"], 65.0, 95.0) * 0.5) * 100
        ), 0, 100))

        return {
            "power": power,
            "spin": spin,
            "technique": technique,
            "stability": stability,
            "consistency": consistency,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.20
            + sub_scores["spin"] * 0.25
            + sub_scores["technique"] * 0.20
            + sub_scores["stability"] * 0.15
            + sub_scores["consistency"] * 0.20
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "table tennis loop")

    def _fallback_metrics(self) -> Dict:
        return {
            "batSpeed": 14.0,
            "bodyRotation": 400.0,
            "spinRate": 4000.0,
            "contactPoint": 78.0,
            "balanceScore": 78.0,
            "rhythmConsistency": 75.0,
        }
