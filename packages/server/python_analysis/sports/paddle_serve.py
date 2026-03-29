import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class PaddleServeAnalyzer(BaseAnalyzer):
    config_key = "paddle-serve"

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

        paddle_angle = self._calc_paddle_angle(valid_poses)

        ball_speed = self.ball_tracker.estimate_speed(fps, pixels_per_meter)
        ball_speed = float(np.clip(ball_speed, 30.0, 60.0)) if ball_speed > 0 else float(42.50)

        placement_score = self._calc_placement(wrist_speeds, elbow_angles)

        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)

        balance = float(np.mean(balance_scores)) if balance_scores else 75.0
        balance = float(np.clip(balance, 70.0, 98.0))

        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "paddleAngle": round(paddle_angle, 2),
            "ballSpeed": round(ball_speed, 2),
            "placementScore": round(placement_score, 2),
            "shotConsistency": round(shot_consistency, 2),
            "balanceScore": round(balance, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_paddle_angle(self, poses: List[Dict]) -> float:
        angles = []
        for p in poses:
            elbow = p.get("right_elbow") or p.get("left_elbow")
            wrist = p.get("right_wrist") or p.get("left_wrist")
            hip = p.get("right_hip") or p.get("left_hip")
            if elbow and wrist and hip:
                if elbow.get("visibility", 0) > 0.4 and wrist.get("visibility", 0) > 0.4:
                    from python_analysis.pose_detector import PoseDetector
                    angle = PoseDetector.calc_angle(hip, elbow, wrist)
                    deviation = abs(angle - 150)
                    if deviation < 60:
                        angles.append(deviation)

        if angles:
            return float(np.clip(np.mean(angles), 15.0, 45.0))
        return 30.0

    def _calc_placement(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        return float(np.clip(consistency * 1.05, 65.0, 98.0))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        technique = int(np.clip(round(
            (self._normalize(m["paddleAngle"], 15.0, 45.0) * 0.4
             + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3) * 100
        ), 0, 100))

        placement = int(np.clip(round(
            (self._normalize(m["placementScore"], 65.0, 98.0) * 0.5
             + self._normalize(m["ballSpeed"], 30.0, 60.0) * 0.3
             + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.6
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.5
             + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3
             + self._normalize(m["paddleAngle"], 15.0, 45.0) * 0.2) * 100
        ), 0, 100))

        return {
            "technique": technique,
            "placement": placement,
            "consistency": consistency,
            "timing": timing,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["technique"] * 0.30
            + sub_scores["placement"] * 0.25
            + sub_scores["consistency"] * 0.25
            + sub_scores["timing"] * 0.20
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "paddle serve")

    def _fallback_metrics(self) -> Dict:
        return {
            "paddleAngle": 30.0,
            "ballSpeed": 42.0,
            "placementScore": 72.0,
            "shotConsistency": 68.0,
            "balanceScore": 75.0,
            "rhythmConsistency": 72.0,
        }
