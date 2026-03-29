import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class TableTennisServeAnalyzer(BaseAnalyzer):
    config_key = "tabletennis-serve"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)

        pixels_per_meter = frame_h / 1.8

        spin_variation = float(np.std(wrist_speeds)) * 20.0 if len(wrist_speeds) > 2 else 2500.0
        spin_variation = float(np.clip(spin_variation, 1500.0, 4500.0))

        bat_angle = float(np.mean(elbow_angles)) if elbow_angles else 40.0
        bat_angle = float(np.clip(bat_angle, 20.0, 65.0))

        ball_speed = self.ball_tracker.estimate_speed(fps, pixels_per_meter)
        ball_speed = float(np.clip(ball_speed, 15.0, 40.0)) if ball_speed > 0 else float(26.00)

        toss_height = self._calc_toss_height(valid_poses, frame_h)
        toss_height = float(np.clip(toss_height, 16.0, 30.0))

        placement_score = self._calc_placement(wrist_speeds, elbow_angles)
        placement_score = float(np.clip(placement_score, 65.0, 95.0))

        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)
        rhythm_consistency = float(np.clip(rhythm_consistency, 65.0, 95.0))

        return {
            "spinVariation": round(spin_variation, 2),
            "batAngle": round(bat_angle, 2),
            "ballSpeed": round(ball_speed, 2),
            "tossHeight": round(toss_height, 2),
            "placementScore": round(placement_score, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_toss_height(self, poses: List[Dict], frame_h: int) -> float:
        wrist_heights = []
        for p in poses:
            wrist = p.get("right_wrist") or p.get("left_wrist")
            shoulder = p.get("right_shoulder") or p.get("left_shoulder")
            if wrist and shoulder and wrist.get("visibility", 0) > 0.4:
                height_diff = abs(shoulder["y"] - wrist["y"])
                real_cm = (height_diff / frame_h) * 180.0
                wrist_heights.append(real_cm)

        if wrist_heights:
            return float(np.clip(max(wrist_heights), 16, 30))
        return 20.0

    def _calc_placement(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        return float(np.clip(consistency * 1.05, 60, 95))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        spin = int(np.clip(round(
            (self._normalize(m["spinVariation"], 1500.0, 4500.0) * 0.6
             + self._normalize(m["batAngle"], 20.0, 65.0) * 0.4) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["batAngle"], 20.0, 65.0) * 0.4
             + self._normalize(m["tossHeight"], 16.0, 30.0) * 0.3
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3) * 100
        ), 0, 100))

        placement = int(np.clip(round(
            (self._normalize(m["placementScore"], 65.0, 95.0) * 0.6
             + self._normalize(m["ballSpeed"], 15.0, 40.0) * 0.4) * 100
        ), 0, 100))

        deception = int(np.clip(round(
            (self._normalize(m["spinVariation"], 1500.0, 4500.0) * 0.5
             + self._normalize(m["batAngle"], 20.0, 65.0) * 0.3
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.2) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["placementScore"], 65.0, 95.0) * 0.5
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.5) * 100
        ), 0, 100))

        return {
            "spin": spin,
            "technique": technique,
            "placement": placement,
            "deception": deception,
            "consistency": consistency,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["spin"] * 0.25
            + sub_scores["technique"] * 0.25
            + sub_scores["placement"] * 0.20
            + sub_scores["deception"] * 0.15
            + sub_scores["consistency"] * 0.15
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "table tennis serve")

    def _fallback_metrics(self) -> Dict:
        return {
            "spinVariation": 2500.0,
            "batAngle": 40.0,
            "ballSpeed": 25.0,
            "tossHeight": 20.0,
            "placementScore": 75.0,
            "rhythmConsistency": 75.0,
        }
