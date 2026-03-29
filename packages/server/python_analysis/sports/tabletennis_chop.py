import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class TableTennisChopAnalyzer(BaseAnalyzer):
    config_key = "tabletennis-chop"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)
        balance_scores = self._calc_balance_scores(valid_poses)

        bat_angle = float(np.mean(elbow_angles)) if elbow_angles else 55.0
        bat_angle = float(np.clip(bat_angle, 40.0, 75.0))

        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        shot_consistency = float(np.clip(shot_consistency, 70.0, 98.0))

        spin_rate = float(np.percentile(wrist_speeds, 85)) * 12.0 if wrist_speeds else 2500.0
        spin_rate = float(np.clip(spin_rate, 1500.0, 4000.0))

        balance = float(np.mean(balance_scores)) if balance_scores else 80.0
        balance = float(np.clip(balance, 70.0, 98.0))

        footwork_score = self._calc_footwork(valid_poses)
        footwork_score = float(np.clip(footwork_score, 65.0, 95.0))

        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)
        rhythm_consistency = float(np.clip(rhythm_consistency, 65.0, 95.0))

        return {
            "batAngle": round(bat_angle, 2),
            "shotConsistency": round(shot_consistency, 2),
            "spinRate": round(spin_rate, 2),
            "balanceScore": round(balance, 2),
            "footworkScore": round(footwork_score, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_footwork(self, poses: List[Dict]) -> float:
        ankle_positions = []
        for p in poses:
            la = p.get("left_ankle")
            ra = p.get("right_ankle")
            if la and ra and la.get("visibility", 0) > 0.4 and ra.get("visibility", 0) > 0.4:
                stance_width = abs(la["x"] - ra["x"])
                ankle_positions.append(stance_width)

        if len(ankle_positions) < 3:
            return 75.0

        mean_stance = float(np.mean(ankle_positions))
        std_stance = float(np.std(ankle_positions))
        stability = max(0, 100 - std_stance * 300)
        width_score = max(0, 100 - abs(mean_stance - 0.18) * 350)
        return float(np.clip((stability * 0.5 + width_score * 0.5), 50, 95))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        technique = int(np.clip(round(
            (self._normalize(m["batAngle"], 40.0, 75.0) * 0.5
             + self._normalize(m["spinRate"], 1500.0, 4000.0) * 0.3
             + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.2) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.6
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        spin = int(np.clip(round(
            (self._normalize(m["spinRate"], 1500.0, 4000.0) * 0.6
             + self._normalize(m["batAngle"], 40.0, 75.0) * 0.4) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            (self._normalize(m["balanceScore"], 70.0, 98.0) * 0.6
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        footwork = int(np.clip(round(
            (self._normalize(m["footworkScore"], 65.0, 95.0) * 0.7
             + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3) * 100
        ), 0, 100))

        return {
            "technique": technique,
            "consistency": consistency,
            "spin": spin,
            "stability": stability,
            "footwork": footwork,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["technique"] * 0.25
            + sub_scores["consistency"] * 0.25
            + sub_scores["spin"] * 0.20
            + sub_scores["stability"] * 0.15
            + sub_scores["footwork"] * 0.15
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "table tennis chop")

    def _fallback_metrics(self) -> Dict:
        return {
            "batAngle": 55.0,
            "shotConsistency": 75.0,
            "spinRate": 2500.0,
            "balanceScore": 80.0,
            "footworkScore": 75.0,
            "rhythmConsistency": 75.0,
        }
