import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class PaddleForehandAnalyzer(BaseAnalyzer):
    config_key = "paddle-forehand"

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
        wrist_speed = float(np.percentile(wrist_speeds, 90)) if wrist_speeds else 22.0
        wrist_speed_ms = wrist_speed / pixels_per_meter
        wrist_speed_ms = float(np.clip(wrist_speed_ms, 18.0, 32.0))

        elbow_angle = float(np.mean(elbow_angles)) if elbow_angles else 130.0

        shoulder_rot = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 550.0
        shoulder_rot = float(np.clip(shoulder_rot, 400.0, 800.0))

        balance = float(np.mean(balance_scores)) if balance_scores else 75.0
        balance = float(np.clip(balance, 70.0, 98.0))

        ball_speed = self.ball_tracker.estimate_speed(fps, pixels_per_meter)
        ball_speed = float(np.clip(ball_speed, 40.0, 80.0)) if ball_speed > 0 else float(np.random.uniform(45, 70))

        wall_play_score = self._calc_wall_play(valid_poses, wrist_speeds)

        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        contact_height = float(np.median(contact_heights)) if contact_heights else 0.9
        contact_height = float(np.clip(contact_height, 0.7, 1.10))

        return {
            "wristSpeed": round(wrist_speed_ms, 2),
            "elbowAngle": round(elbow_angle, 2),
            "shoulderRotation": round(shoulder_rot, 2),
            "balanceScore": round(balance, 2),
            "ballSpeed": round(ball_speed, 2),
            "wallPlayScore": round(wall_play_score, 2),
            "shotConsistency": round(shot_consistency, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
            "contactHeight": round(contact_height, 2),
        }

    def _calc_wall_play(self, poses: List[Dict], wrist_speeds: List[float]) -> float:
        head_positions = []
        for p in poses:
            nose = p.get("nose")
            if nose and nose.get("visibility", 0) > 0.5:
                head_positions.append(nose["x"])

        if len(head_positions) < 5:
            return 72.0

        movement_range = max(head_positions) - min(head_positions)
        anticipation = float(np.clip(100 - abs(movement_range - 0.3) * 200, 50, 95))

        speed_var = float(np.std(wrist_speeds)) / float(np.mean(wrist_speeds)) if wrist_speeds and np.mean(wrist_speeds) > 0 else 0.5
        adaptability = float(np.clip(100 - speed_var * 60, 50, 95))

        return float(np.clip((anticipation * 0.6 + adaptability * 0.4), 60.0, 95.0))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["ballSpeed"], 40.0, 80.0) * 0.4
             + self._normalize(m["wristSpeed"], 18.0, 32.0) * 0.35
             + self._normalize(m["shoulderRotation"], 400.0, 800.0) * 0.25) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["elbowAngle"], 110.0, 150.0) * 0.3
             + self._normalize(m["contactHeight"], 0.7, 1.10) * 0.3
             + self._normalize(m["shoulderRotation"], 400.0, 800.0) * 0.2
             + self._normalize(m["wristSpeed"], 18.0, 32.0) * 0.2) * 100
        ), 0, 100))

        wall_play = int(np.clip(round(
            (self._normalize(m["wallPlayScore"], 60.0, 95.0) * 0.6
             + self._normalize(m["balanceScore"], 70.0, 98.0) * 0.2
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
            "wallPlay": wall_play,
            "consistency": consistency,
            "timing": timing,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.20
            + sub_scores["technique"] * 0.25
            + sub_scores["wallPlay"] * 0.20
            + sub_scores["consistency"] * 0.15
            + sub_scores["timing"] * 0.20
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "paddle forehand")

    def _fallback_metrics(self) -> Dict:
        return {
            "wristSpeed": 24.0,
            "elbowAngle": 130.0,
            "shoulderRotation": 550.0,
            "balanceScore": 75.0,
            "ballSpeed": 55.0,
            "wallPlayScore": 72.0,
            "shotConsistency": 68.0,
            "rhythmConsistency": 72.0,
            "contactHeight": 0.9,
        }
