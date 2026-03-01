import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class TableTennisBackhandAnalyzer(BaseAnalyzer):
    config_key = "tabletennis-backhand"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)
        balance_scores = self._calc_balance_scores(valid_poses)

        pixels_per_meter = frame_h / 1.8

        bat_speed = float(np.percentile(wrist_speeds, 90)) / pixels_per_meter if wrist_speeds else 10.0
        bat_speed = float(np.clip(bat_speed, 6.0, 15.0))

        timing_score = self._calc_timing(wrist_speeds, fps)
        timing_score = float(np.clip(timing_score, 70.0, 98.0))

        bat_angle = float(np.mean(elbow_angles)) if elbow_angles else 50.0
        bat_angle = float(np.clip(bat_angle, 30.0, 70.0))

        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        shot_consistency = float(np.clip(shot_consistency, 70.0, 98.0))

        balance = float(np.mean(balance_scores)) if balance_scores else 80.0
        balance = float(np.clip(balance, 70.0, 98.0))

        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)
        rhythm_consistency = float(np.clip(rhythm_consistency, 65.0, 95.0))

        return {
            "batSpeed": round(bat_speed, 2),
            "timingScore": round(timing_score, 2),
            "batAngle": round(bat_angle, 2),
            "shotConsistency": round(shot_consistency, 2),
            "balanceScore": round(balance, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_timing(self, wrist_speeds: List[float], fps: float) -> float:
        if len(wrist_speeds) < 5:
            return 78.0
        peak_idx = int(np.argmax(wrist_speeds))
        total = len(wrist_speeds)
        timing_ratio = peak_idx / total if total > 0 else 0.5
        score = max(0, 100 - abs(timing_ratio - 0.6) * 200)
        return float(np.clip(score, 60, 98))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        speed = int(np.clip(round(
            (self._normalize(m["batSpeed"], 6.0, 15.0) * 0.7
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            (self._normalize(m["timingScore"], 70.0, 98.0) * 0.6
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["batAngle"], 30.0, 70.0) * 0.5
             + self._normalize(m["batSpeed"], 6.0, 15.0) * 0.3
             + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.2) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.6
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            (self._normalize(m["balanceScore"], 70.0, 98.0) * 0.6
             + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.4) * 100
        ), 0, 100))

        return {
            "speed": speed,
            "timing": timing,
            "technique": technique,
            "consistency": consistency,
            "stability": stability,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["speed"] * 0.20
            + sub_scores["timing"] * 0.25
            + sub_scores["technique"] * 0.20
            + sub_scores["consistency"] * 0.20
            + sub_scores["stability"] * 0.15
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "table tennis backhand")

    def _fallback_metrics(self) -> Dict:
        return {
            "batSpeed": 10.0,
            "timingScore": 78.0,
            "batAngle": 50.0,
            "shotConsistency": 75.0,
            "balanceScore": 80.0,
            "rhythmConsistency": 75.0,
        }
