import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class PaddleBackhandAnalyzer(BaseAnalyzer):
    config_key = "paddle-backhand"

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
        contact_heights = self._calc_contact_heights(valid_poses, frame_h)

        pixels_per_meter = frame_h / 1.8
        wrist_speed = float(np.percentile(wrist_speeds, 90)) if wrist_speeds else 20.0
        wrist_speed_ms = wrist_speed / pixels_per_meter
        wrist_speed_ms = float(np.clip(wrist_speed_ms, 15.0, 28.0))

        elbow_angle = float(np.mean(elbow_angles)) if elbow_angles else 125.0

        shoulder_rot = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 500.0
        shoulder_rot = float(np.clip(shoulder_rot, 350.0, 750.0))

        balance = float(np.mean(balance_scores)) if balance_scores else 75.0
        balance = float(np.clip(balance, 70.0, 98.0))

        ball_speed = self.ball_tracker.estimate_speed(fps, pixels_per_meter)
        ball_speed = float(np.clip(ball_speed, 35.0, 70.0)) if ball_speed > 0 else float(50.00)

        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        contact_height = float(np.median(contact_heights)) if contact_heights else 0.85
        contact_height = float(np.clip(contact_height, 0.6, 1.05))

        return {
            "wristSpeed": round(wrist_speed_ms, 2),
            "elbowAngle": round(elbow_angle, 2),
            "shoulderRotation": round(shoulder_rot, 2),
            "balanceScore": round(balance, 2),
            "ballSpeed": round(ball_speed, 2),
            "shotConsistency": round(shot_consistency, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
            "contactHeight": round(contact_height, 2),
        }

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["ballSpeed"], 35.0, 70.0) * 0.4
             + self._normalize(m["wristSpeed"], 15.0, 28.0) * 0.35
             + self._normalize(m["shoulderRotation"], 350.0, 750.0) * 0.25) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["elbowAngle"], 100.0, 145.0) * 0.3
             + self._normalize(m["contactHeight"], 0.6, 1.05) * 0.3
             + self._normalize(m["shoulderRotation"], 350.0, 750.0) * 0.2
             + self._normalize(m["wristSpeed"], 15.0, 28.0) * 0.2) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            (self._normalize(m["balanceScore"], 70.0, 98.0) * 0.5
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.3
             + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.6
             + self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 0.5
             + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.3
             + self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.2) * 100
        ), 0, 100))

        return {
            "power": power,
            "technique": technique,
            "stability": stability,
            "consistency": consistency,
            "timing": timing,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.20
            + sub_scores["technique"] * 0.25
            + sub_scores["stability"] * 0.20
            + sub_scores["consistency"] * 0.15
            + sub_scores["timing"] * 0.20
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "paddle backhand")

    def _fallback_metrics(self) -> Dict:
        return {
            "wristSpeed": 20.0,
            "elbowAngle": 125.0,
            "shoulderRotation": 500.0,
            "balanceScore": 75.0,
            "ballSpeed": 50.0,
            "shotConsistency": 68.0,
            "rhythmConsistency": 72.0,
            "contactHeight": 0.85,
        }
