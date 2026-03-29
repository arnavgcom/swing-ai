import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class PickleballDriveAnalyzer(BaseAnalyzer):
    config_key = "pickleball-drive"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)
        balance_scores = self._calc_balance_scores(valid_poses)
        shoulder_rotations = self._calc_shoulder_rotation(pose_data, fps)

        paddle_speed = float(np.clip(float(np.max(wrist_speeds)) if wrist_speeds else 18.0, 5.0, 40.0))
        body_rotation = float(np.clip(float(np.max(shoulder_rotations)) if shoulder_rotations else 400.0, 100.0, 900.0))

        ball_speed = self.ball_tracker.estimate_speed(fps, frame_h / 1.8)
        ball_speed = float(np.clip(ball_speed, 20.0, 70.0)) if ball_speed > 0 else float(45.00)

        trajectory_angle = self._calc_trajectory_angle(wrist_speeds, elbow_angles)
        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 72.0, 45.0, 98.0))
        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "paddleSpeed": round(paddle_speed, 2),
            "bodyRotation": round(body_rotation, 2),
            "ballSpeed": round(ball_speed, 2),
            "trajectoryAngle": round(trajectory_angle, 2),
            "balanceScore": round(balance, 2),
            "shotConsistency": round(shot_consistency, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_trajectory_angle(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        if len(elbow_angles) < 3:
            return 7.0
        mean_angle = float(np.mean(elbow_angles))
        trajectory = abs(mean_angle - 160) * 0.3
        return float(np.clip(trajectory, 1.0, 20.0))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["paddleSpeed"], 15, 30) * 0.5
             + self._normalize(m["ballSpeed"], 35, 65) * 0.3
             + self._normalize(m["bodyRotation"], 300, 700) * 0.2) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["bodyRotation"], 300, 700) * 0.4
             + self._normalize(m["paddleSpeed"], 15, 30) * 0.3
             + self._normalize(m["shotConsistency"], 40, 98) * 0.3) * 100
        ), 0, 100))

        trajectory = int(np.clip(round(
            (self._normalize(m["trajectoryAngle"], 2, 12) * 0.6
             + self._normalize(m["ballSpeed"], 35, 65) * 0.4) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            self._normalize(m["balanceScore"], 45, 98) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 40, 98) * 0.6
             + self._normalize(m["rhythmConsistency"], 50, 98) * 0.4) * 100
        ), 0, 100))

        rhythm = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 50, 98) * 100
        ), 0, 100))

        return {
            "power": power,
            "technique": technique,
            "trajectory": trajectory,
            "stability": stability,
            "consistency": consistency,
            "rhythm": rhythm,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.25
            + sub_scores["technique"] * 0.20
            + sub_scores["trajectory"] * 0.15
            + sub_scores["stability"] * 0.15
            + sub_scores["consistency"] * 0.15
            + sub_scores["rhythm"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "drive")

    def _fallback_metrics(self) -> Dict:
        return {
            "paddleSpeed": 18.0,
            "bodyRotation": 400.0,
            "ballSpeed": 45.0,
            "trajectoryAngle": 7.0,
            "balanceScore": 72.0,
            "shotConsistency": 65.0,
            "rhythmConsistency": 70.0,
        }
