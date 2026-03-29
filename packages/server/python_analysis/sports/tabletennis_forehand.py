import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class TableTennisForehandAnalyzer(BaseAnalyzer):
    config_key = "tabletennis-forehand"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)
        shoulder_rotations = self._calc_shoulder_rotation(pose_data, fps)
        balance_scores = self._calc_balance_scores(valid_poses)

        pixels_per_meter = frame_h / 1.8

        bat_speed = float(np.percentile(wrist_speeds, 90)) / pixels_per_meter if wrist_speeds else 12.0
        bat_speed = float(np.clip(bat_speed, 8.0, 18.0))

        wrist_action = float(np.percentile(wrist_speeds, 85)) * 15.0 if wrist_speeds else 450.0
        wrist_action = float(np.clip(wrist_action, 300.0, 700.0))

        spin_rate = wrist_action * 6.0
        spin_rate = float(np.clip(spin_rate, 2000.0, 5000.0))

        footwork_score = self._calc_footwork(valid_poses)
        footwork_score = float(np.clip(footwork_score, 65.0, 95.0))

        body_rotation = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 350.0
        body_rotation = float(np.clip(body_rotation, 200.0, 500.0))

        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        shot_consistency = float(np.clip(shot_consistency, 70.0, 98.0))

        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)
        rhythm_consistency = float(np.clip(rhythm_consistency, 65.0, 95.0))

        return {
            "batSpeed": round(bat_speed, 2),
            "wristAction": round(wrist_action, 2),
            "spinRate": round(spin_rate, 2),
            "footworkScore": round(footwork_score, 2),
            "bodyRotation": round(body_rotation, 2),
            "shotConsistency": round(shot_consistency, 2),
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
        width_score = max(0, 100 - abs(mean_stance - 0.15) * 400)
        return float(np.clip((stability * 0.6 + width_score * 0.4), 50, 95))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["batSpeed"], 8.0, 18.0) * 0.5
             + self._normalize(m["bodyRotation"], 200.0, 500.0) * 0.3
             + self._normalize(m["wristAction"], 300.0, 700.0) * 0.2) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["wristAction"], 300.0, 700.0) * 0.4
             + self._normalize(m["bodyRotation"], 200.0, 500.0) * 0.3
             + self._normalize(m["footworkScore"], 65.0, 95.0) * 0.3) * 100
        ), 0, 100))

        spin = int(np.clip(round(
            (self._normalize(m["spinRate"], 2000.0, 5000.0) * 0.6
             + self._normalize(m["wristAction"], 300.0, 700.0) * 0.4) * 100
        ), 0, 100))

        footwork = int(np.clip(round(
            (self._normalize(m["footworkScore"], 65.0, 95.0) * 0.7
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.6
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        return {
            "power": power,
            "technique": technique,
            "spin": spin,
            "footwork": footwork,
            "consistency": consistency,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.20
            + sub_scores["technique"] * 0.25
            + sub_scores["spin"] * 0.20
            + sub_scores["footwork"] * 0.15
            + sub_scores["consistency"] * 0.20
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "table tennis forehand")

    def _fallback_metrics(self) -> Dict:
        return {
            "batSpeed": 12.0,
            "wristAction": 450.0,
            "spinRate": 3000.0,
            "footworkScore": 75.0,
            "bodyRotation": 350.0,
            "shotConsistency": 75.0,
            "rhythmConsistency": 75.0,
        }
