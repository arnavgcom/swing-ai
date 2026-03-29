import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class PickleballServeAnalyzer(BaseAnalyzer):
    config_key = "pickleball-serve"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)
        balance_scores = self._calc_balance_scores(valid_poses)

        paddle_angle = self._calc_paddle_angle(valid_poses)
        toss_consistency = self._calc_toss_consistency(pose_data)

        ball_speed = self.ball_tracker.estimate_speed(fps, frame_h / 1.8)
        ball_speed = float(np.clip(ball_speed, 15.0, 55.0)) if ball_speed > 0 else float(32.50)

        placement = self._calc_placement(wrist_speeds, elbow_angles)
        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 75.0, 50.0, 98.0))
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "paddleAngle": round(paddle_angle, 2),
            "tossConsistency": round(toss_consistency, 2),
            "ballSpeed": round(ball_speed, 2),
            "placement": round(placement, 2),
            "balanceScore": round(balance, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_paddle_angle(self, poses: List[Dict]) -> float:
        angles = []
        for p in poses:
            elbow = p.get("right_elbow") or p.get("left_elbow")
            wrist = p.get("right_wrist") or p.get("left_wrist")
            shoulder = p.get("right_shoulder") or p.get("left_shoulder")
            if elbow and wrist and shoulder:
                if (elbow.get("visibility", 0) > 0.4 and
                    wrist.get("visibility", 0) > 0.4 and
                    shoulder.get("visibility", 0) > 0.4):
                    from python_analysis.pose_detector import PoseDetector
                    angle = PoseDetector.calc_angle(shoulder, elbow, wrist)
                    face_angle = abs(180 - angle)
                    if 5 < face_angle < 90:
                        angles.append(face_angle)
        if angles:
            return float(np.clip(np.mean(angles), 10, 70))
        return 30.0

    def _calc_toss_consistency(self, pose_data: List[Optional[Dict]]) -> float:
        left_wrist_ys = []
        for p in pose_data:
            if p is None:
                continue
            lw = p.get("left_wrist")
            if lw and lw.get("visibility", 0) > 0.4:
                left_wrist_ys.append(lw["y"])
        if len(left_wrist_ys) < 5:
            return 75.0
        std = float(np.std(left_wrist_ys))
        mean = float(np.mean(left_wrist_ys))
        cv = std / mean if mean > 0 else 0.5
        score = max(0, 100 - cv * 150)
        return float(np.clip(score, 50, 98))

    def _calc_placement(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        return float(np.clip(consistency * 1.05, 50, 98))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        technique = int(np.clip(round(
            (self._normalize(m["paddleAngle"], 20, 45) * 0.4
             + self._normalize(m["tossConsistency"], 50, 98) * 0.3
             + self._normalize(m["rhythmConsistency"], 50, 98) * 0.3) * 100
        ), 0, 100))

        placement = int(np.clip(round(
            (self._normalize(m["placement"], 50, 98) * 0.6
             + self._normalize(m["tossConsistency"], 50, 98) * 0.4) * 100
        ), 0, 100))

        power = int(np.clip(round(
            self._normalize(m["ballSpeed"], 25, 50) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            self._normalize(m["balanceScore"], 50, 98) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["tossConsistency"], 50, 98) * 0.5
             + self._normalize(m["placement"], 50, 98) * 0.5) * 100
        ), 0, 100))

        rhythm = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 50, 98) * 100
        ), 0, 100))

        return {
            "technique": technique,
            "placement": placement,
            "power": power,
            "stability": stability,
            "consistency": consistency,
            "rhythm": rhythm,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["technique"] * 0.25
            + sub_scores["placement"] * 0.20
            + sub_scores["power"] * 0.15
            + sub_scores["stability"] * 0.15
            + sub_scores["consistency"] * 0.15
            + sub_scores["rhythm"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "serve")

    def _fallback_metrics(self) -> Dict:
        return {
            "paddleAngle": 30.0,
            "tossConsistency": 75.0,
            "ballSpeed": 32.0,
            "placement": 70.0,
            "balanceScore": 75.0,
            "rhythmConsistency": 70.0,
        }
