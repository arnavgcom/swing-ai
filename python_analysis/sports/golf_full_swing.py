import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class GolfFullSwingAnalyzer(BaseAnalyzer):
    config_key = "golf-full-swing"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        shoulder_rotations = self._calc_shoulder_rotation(pose_data, fps)
        hip_rotations = self._calc_hip_rotation(pose_data, fps)
        balance_scores = self._calc_balance_scores(valid_poses)
        spine_angles = self._calc_spine_angle(valid_poses)
        swing_phases = self._detect_swing_phases(pose_data, fps)

        club_head_speed = float(np.percentile(wrist_speeds, 95)) if wrist_speeds else 380.0
        pixels_per_meter = frame_h / 1.8
        club_speed_mph = (club_head_speed / pixels_per_meter) * 2.237
        club_speed_mph = float(np.clip(club_speed_mph, 65.0, 120.0))

        hip_rot = float(np.percentile(hip_rotations, 90)) if hip_rotations else 42.0
        hip_rot_deg = float(np.clip(hip_rot * 0.08, 25.0, 60.0))

        shoulder_rot = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 85.0
        shoulder_rot_deg = float(np.clip(shoulder_rot * 0.12, 60.0, 110.0))

        x_factor = float(np.clip(shoulder_rot_deg - hip_rot_deg, 15.0, 55.0))

        spine_angle = float(np.mean(spine_angles)) if spine_angles else 32.0
        spine_angle = float(np.clip(spine_angle, 15.0, 48.0))

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 72.0, 40.0, 98.0))

        backswing = swing_phases["backswing"]
        downswing_dur = float(np.clip(swing_phases["contact"] * 5, 0.15, 0.5))
        tempo_ratio = float(np.clip(backswing / downswing_dur if downswing_dur > 0 else 3.0, 1.5, 5.0))

        head_stability = self._calc_head_stability(pose_data, frame_h)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "clubHeadSpeed": round(club_speed_mph, 2),
            "hipRotation": round(hip_rot_deg, 2),
            "shoulderRotation": round(shoulder_rot_deg, 2),
            "xFactor": round(x_factor, 2),
            "spineAngle": round(spine_angle, 2),
            "balanceScore": round(balance, 2),
            "tempoRatio": round(tempo_ratio, 2),
            "backswingDuration": round(float(backswing), 3),
            "headStability": round(head_stability, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["clubHeadSpeed"], 65, 120) * 0.5
             + self._normalize(m["shoulderRotation"], 60, 110) * 0.3
             + self._normalize(m["xFactor"], 15, 55) * 0.2) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["spineAngle"], 25, 40) * 0.35
             + self._normalize(m["headStability"], 40, 98) * 0.35
             + self._normalize(m["hipRotation"], 25, 60) * 0.3) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 50, 98) * 0.5
             + self._normalize(m["headStability"], 40, 98) * 0.5) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            (self._normalize(m["tempoRatio"], 2.5, 3.5) * 0.5
             + self._normalize(m["backswingDuration"], 0.7, 1.2) * 0.5) * 100
        ), 0, 100))

        balance = int(np.clip(round(
            (self._normalize(m["balanceScore"], 40, 98) * 0.6
             + self._normalize(m["headStability"], 40, 98) * 0.4) * 100
        ), 0, 100))

        return {
            "power": power,
            "technique": technique,
            "consistency": consistency,
            "timing": timing,
            "balance": balance,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.25
            + sub_scores["technique"] * 0.25
            + sub_scores["consistency"] * 0.20
            + sub_scores["timing"] * 0.15
            + sub_scores["balance"] * 0.15
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "full swing")

    def _fallback_metrics(self) -> Dict:
        return {
            "clubHeadSpeed": 88.0,
            "hipRotation": 42.0,
            "shoulderRotation": 82.0,
            "xFactor": 36.0,
            "spineAngle": 32.0,
            "balanceScore": 72.0,
            "tempoRatio": 3.0,
            "backswingDuration": 0.9,
            "headStability": 75.0,
            "rhythmConsistency": 70.0,
        }
