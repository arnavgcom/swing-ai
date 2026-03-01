import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer
from python_analysis.pose_detector import PoseDetector


class GolfPuttAnalyzer(BaseAnalyzer):
    config_key = "golf-putt"

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

        pendulum_score = self._calc_pendulum(valid_poses)
        head_stability = self._calc_head_stability(pose_data, frame_h)
        eye_line = self._calc_eye_line(valid_poses)
        stroke_length = self._calc_stroke_symmetry(swing_phases)
        wrist_stability = self._calc_wrist_stability(wrist_speeds, elbow_angles)

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 78.0, 55.0, 98.0))

        backswing = swing_phases.get("backswing", 0.4)
        follow = swing_phases.get("follow_through", 0.4)
        tempo_ratio = float(np.clip(follow / backswing if backswing > 0 else 1.0, 0.5, 1.5))

        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "pendulumScore": round(pendulum_score, 2),
            "headStability": round(head_stability, 2),
            "eyeLine": round(eye_line, 2),
            "strokeLength": round(stroke_length, 2),
            "wristStability": round(wrist_stability, 2),
            "balanceScore": round(balance, 2),
            "tempoRatio": round(tempo_ratio, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_pendulum(self, poses: List[Dict]) -> float:
        shoulder_rotation_range = []
        for p in poses:
            ls = p.get("left_shoulder")
            rs = p.get("right_shoulder")
            if ls and rs and ls.get("visibility", 0) > 0.4 and rs.get("visibility", 0) > 0.4:
                mid_y = (ls["y"] + rs["y"]) / 2
                shoulder_rotation_range.append(mid_y)

        if len(shoulder_rotation_range) < 5:
            return 78.0

        y_range = max(shoulder_rotation_range) - min(shoulder_rotation_range)
        std = float(np.std(shoulder_rotation_range))
        score = max(0, 100 - std * 0.5)
        return float(np.clip(score, 55, 98))

    def _calc_eye_line(self, poses: List[Dict]) -> float:
        deviations = []
        for p in poses:
            nose = p.get("nose")
            lh = p.get("left_hip")
            rh = p.get("right_hip")
            if nose and lh and rh and nose.get("visibility", 0) > 0.5:
                hip_mid_x = (lh["x"] + rh["x"]) / 2
                deviation = abs(nose["x"] - hip_mid_x)
                hip_width = abs(lh["x"] - rh["x"]) if abs(lh["x"] - rh["x"]) > 0 else 1
                norm_dev = deviation / hip_width
                deviations.append(norm_dev)

        if not deviations:
            return 78.0

        mean_dev = float(np.mean(deviations))
        score = max(0, 100 - mean_dev * 50)
        return float(np.clip(score, 55, 98))

    def _calc_stroke_symmetry(self, swing_phases: Dict[str, float]) -> float:
        backswing = swing_phases.get("backswing", 0.4)
        follow = swing_phases.get("follow_through", 0.4)
        if backswing > 0:
            ratio = follow / backswing
            score = max(0, 100 - abs(ratio - 1.0) * 50)
            return float(np.clip(score, 50, 98))
        return 75.0

    def _calc_wrist_stability(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        if len(wrist_speeds) < 3:
            return 78.0

        speed_std = float(np.std(wrist_speeds))
        mean_speed = float(np.mean(wrist_speeds))
        if mean_speed > 0:
            cv = speed_std / mean_speed
            score = max(0, 100 - cv * 70)
            return float(np.clip(score, 55, 98))
        return 78.0

    def _compute_sub_scores(self, m: Dict) -> Dict:
        technique = int(np.clip(round(
            (self._normalize(m["pendulumScore"], 55, 98) * 0.3
             + self._normalize(m["headStability"], 55, 98) * 0.3
             + self._normalize(m["eyeLine"], 55, 98) * 0.2
             + self._normalize(m["wristStability"], 55, 98) * 0.2) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 55, 98) * 0.4
             + self._normalize(m["wristStability"], 55, 98) * 0.3
             + self._normalize(m["strokeLength"], 50, 98) * 0.3) * 100
        ), 0, 100))

        alignment = int(np.clip(round(
            (self._normalize(m["eyeLine"], 55, 98) * 0.5
             + self._normalize(m["headStability"], 55, 98) * 0.5) * 100
        ), 0, 100))

        touch = int(np.clip(round(
            (self._normalize(m["strokeLength"], 50, 98) * 0.4
             + self._normalize(m["tempoRatio"], 0.8, 1.2) * 0.3
             + self._normalize(m["pendulumScore"], 55, 98) * 0.3) * 100
        ), 0, 100))

        return {
            "technique": technique,
            "consistency": consistency,
            "alignment": alignment,
            "touch": touch,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["technique"] * 0.30
            + sub_scores["consistency"] * 0.30
            + sub_scores["alignment"] * 0.25
            + sub_scores["touch"] * 0.15
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "putting stroke")

    def _fallback_metrics(self) -> Dict:
        return {
            "pendulumScore": 78.0,
            "headStability": 80.0,
            "eyeLine": 78.0,
            "strokeLength": 75.0,
            "wristStability": 78.0,
            "balanceScore": 78.0,
            "tempoRatio": 1.0,
            "rhythmConsistency": 75.0,
        }
