import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class GolfChipAnalyzer(BaseAnalyzer):
    config_key = "golf-chip"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)
        balance_scores = self._calc_balance_scores(valid_poses)
        swing_phases = self._detect_swing_phases(pose_data, fps)

        wrist_hinge = self._calc_wrist_hinge(valid_poses)
        arm_pendulum = self._calc_arm_pendulum(elbow_angles, wrist_speeds)
        head_stability = self._calc_head_stability(pose_data, frame_h)
        stroke_length = self._calc_stroke_length(wrist_speeds)
        contact_quality = self._calc_contact_quality(wrist_speeds, elbow_angles)
        follow_through_ratio = self._calc_follow_through_ratio(swing_phases)

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 75.0, 50.0, 98.0))
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "wristHinge": round(wrist_hinge, 2),
            "armPendulum": round(arm_pendulum, 2),
            "balanceScore": round(balance, 2),
            "headStability": round(head_stability, 2),
            "strokeLength": round(stroke_length, 2),
            "contactQuality": round(contact_quality, 2),
            "followThroughRatio": round(follow_through_ratio, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_wrist_hinge(self, poses: List[Dict]) -> float:
        angles = []
        for p in poses:
            elbow = p.get("right_elbow") or p.get("left_elbow")
            wrist = p.get("right_wrist") or p.get("left_wrist")
            hip = p.get("right_hip") or p.get("left_hip")
            if elbow and wrist and hip:
                if elbow.get("visibility", 0) > 0.4 and wrist.get("visibility", 0) > 0.4:
                    from python_analysis.pose_detector import PoseDetector
                    angle = PoseDetector.calc_angle(hip, elbow, wrist)
                    deviation = abs(angle - 180)
                    if deviation < 60:
                        angles.append(deviation)

        if angles:
            return float(np.clip(np.mean(angles), 2, 35))
        return 12.0

    def _calc_arm_pendulum(self, elbow_angles: List[float], wrist_speeds: List[float]) -> float:
        if len(elbow_angles) < 3:
            return 75.0
        angle_std = float(np.std(elbow_angles))
        pendulum_score = max(0, 100 - angle_std * 3)
        return float(np.clip(pendulum_score, 50, 98))

    def _calc_stroke_length(self, wrist_speeds: List[float]) -> float:
        if len(wrist_speeds) < 3:
            return 70.0
        peak = float(np.max(wrist_speeds))
        mean = float(np.mean(wrist_speeds))
        ratio = peak / mean if mean > 0 else 2.0
        score = float(np.clip(100 - abs(ratio - 2.5) * 20, 40, 95))
        return score

    def _calc_contact_quality(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        if len(wrist_speeds) < 3:
            return 70.0
        speed_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        return float(np.clip(speed_consistency * 1.1, 50, 98))

    def _calc_follow_through_ratio(self, swing_phases: Dict[str, float]) -> float:
        backswing = swing_phases.get("backswing", 0.3)
        follow = swing_phases.get("follow_through", 0.3)
        if backswing > 0:
            ratio = follow / backswing
            score = float(np.clip(100 - abs(ratio - 1.0) * 40, 50, 98))
            return score
        return 75.0

    def _compute_sub_scores(self, m: Dict) -> Dict:
        technique = int(np.clip(round(
            (self._normalize(m["wristHinge"], 5, 20) * 0.3
             + self._normalize(m["armPendulum"], 50, 98) * 0.3
             + self._normalize(m["headStability"], 50, 98) * 0.2
             + self._normalize(m["contactQuality"], 50, 98) * 0.2) * 100
        ), 0, 100))

        touch = int(np.clip(round(
            (self._normalize(m["strokeLength"], 40, 95) * 0.4
             + self._normalize(m["contactQuality"], 50, 98) * 0.3
             + self._normalize(m["followThroughRatio"], 50, 98) * 0.3) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 50, 98) * 0.5
             + self._normalize(m["armPendulum"], 50, 98) * 0.5) * 100
        ), 0, 100))

        balance = int(np.clip(round(
            (self._normalize(m["balanceScore"], 50, 98) * 0.6
             + self._normalize(m["headStability"], 50, 98) * 0.4) * 100
        ), 0, 100))

        return {
            "technique": technique,
            "touch": touch,
            "consistency": consistency,
            "balance": balance,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["technique"] * 0.35
            + sub_scores["touch"] * 0.25
            + sub_scores["consistency"] * 0.25
            + sub_scores["balance"] * 0.15
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "chip shot")

    def _fallback_metrics(self) -> Dict:
        return {
            "wristHinge": 12.0,
            "armPendulum": 78.0,
            "balanceScore": 75.0,
            "headStability": 78.0,
            "strokeLength": 72.0,
            "contactQuality": 72.0,
            "followThroughRatio": 78.0,
            "rhythmConsistency": 72.0,
        }
