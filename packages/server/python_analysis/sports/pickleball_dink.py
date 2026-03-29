import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class PickleballDinkAnalyzer(BaseAnalyzer):
    config_key = "pickleball-dink"

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
        soft_touch = self._calc_soft_touch(wrist_speeds)
        wrist_stability = self._calc_wrist_stability(wrist_speeds)
        arc_height = self._calc_arc_height(valid_poses, frame_h)

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 75.0, 50.0, 98.0))
        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "paddleAngle": round(paddle_angle, 2),
            "softTouch": round(soft_touch, 2),
            "wristStability": round(wrist_stability, 2),
            "arcHeight": round(arc_height, 2),
            "balanceScore": round(balance, 2),
            "shotConsistency": round(shot_consistency, 2),
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
        return 35.0

    def _calc_soft_touch(self, wrist_speeds: List[float]) -> float:
        if len(wrist_speeds) < 3:
            return 75.0
        peak = float(np.max(wrist_speeds))
        mean = float(np.mean(wrist_speeds))
        ratio = peak / mean if mean > 0 else 3.0
        score = max(0, 100 - (ratio - 1.5) * 20)
        return float(np.clip(score, 50, 98))

    def _calc_wrist_stability(self, wrist_speeds: List[float]) -> float:
        if len(wrist_speeds) < 3:
            return 75.0
        cv = float(np.std(wrist_speeds)) / float(np.mean(wrist_speeds)) if np.mean(wrist_speeds) > 0 else 0.5
        stability = max(0, 100 - cv * 60)
        return float(np.clip(stability, 50, 98))

    def _calc_arc_height(self, poses: List[Dict], frame_h: int) -> float:
        wrist_ys = []
        for p in poses:
            wrist = p.get("right_wrist") or p.get("left_wrist")
            if wrist and wrist.get("visibility", 0) > 0.4:
                wrist_ys.append(wrist["y"])
        if len(wrist_ys) < 3:
            return 0.15
        min_y = min(wrist_ys)
        max_y = max(wrist_ys)
        arc_pixels = max_y - min_y
        arc_meters = (arc_pixels / frame_h) * 1.75
        return float(np.clip(arc_meters, 0.02, 0.60))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        touch = int(np.clip(round(
            (self._normalize(m["softTouch"], 50, 98) * 0.5
             + self._normalize(m["wristStability"], 50, 98) * 0.3
             + self._normalize(m["paddleAngle"], 25, 50) * 0.2) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["paddleAngle"], 25, 50) * 0.4
             + self._normalize(m["wristStability"], 50, 98) * 0.3
             + self._normalize(m["softTouch"], 50, 98) * 0.3) * 100
        ), 0, 100))

        arc = int(np.clip(round(
            (self._normalize(m["arcHeight"], 0.05, 0.30) * 0.6
             + self._normalize(m["softTouch"], 50, 98) * 0.4) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            (self._normalize(m["balanceScore"], 50, 98) * 0.6
             + self._normalize(m["wristStability"], 50, 98) * 0.4) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 40, 98) * 0.6
             + self._normalize(m["rhythmConsistency"], 50, 98) * 0.4) * 100
        ), 0, 100))

        rhythm = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 50, 98) * 100
        ), 0, 100))

        return {
            "touch": touch,
            "technique": technique,
            "arc": arc,
            "stability": stability,
            "consistency": consistency,
            "rhythm": rhythm,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["touch"] * 0.25
            + sub_scores["technique"] * 0.20
            + sub_scores["arc"] * 0.15
            + sub_scores["stability"] * 0.15
            + sub_scores["consistency"] * 0.15
            + sub_scores["rhythm"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "dink")

    def _fallback_metrics(self) -> Dict:
        return {
            "paddleAngle": 35.0,
            "softTouch": 75.0,
            "wristStability": 75.0,
            "arcHeight": 0.15,
            "balanceScore": 75.0,
            "shotConsistency": 65.0,
            "rhythmConsistency": 70.0,
        }
