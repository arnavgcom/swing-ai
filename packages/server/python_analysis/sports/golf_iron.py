import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class GolfIronAnalyzer(BaseAnalyzer):
    config_key = "golf-iron"

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

        club_head_speed = float(np.percentile(wrist_speeds, 95)) if wrist_speeds else 350.0
        pixels_per_meter = frame_h / 1.8
        club_speed_mph = (club_head_speed / pixels_per_meter) * 2.237
        club_speed_mph = float(np.clip(club_speed_mph, 55.0, 105.0))

        hip_rot = float(np.percentile(hip_rotations, 90)) if hip_rotations else 40.0
        hip_rot_deg = float(np.clip(hip_rot * 0.08, 20.0, 58.0))

        shoulder_rot = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 80.0
        shoulder_rot_deg = float(np.clip(shoulder_rot * 0.12, 55.0, 105.0))

        spine_angle = float(np.mean(spine_angles)) if spine_angles else 35.0
        spine_angle = float(np.clip(spine_angle, 18.0, 50.0))

        divot_angle = self._calc_divot_angle(pose_data, fps)

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 72.0, 40.0, 98.0))

        backswing = swing_phases["backswing"]
        downswing_dur = float(np.clip(swing_phases["contact"] * 5, 0.15, 0.45))
        tempo_ratio = float(np.clip(backswing / downswing_dur if downswing_dur > 0 else 3.0, 1.5, 5.0))

        head_stability = self._calc_head_stability(pose_data, frame_h)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "clubHeadSpeed": round(club_speed_mph, 2),
            "hipRotation": round(hip_rot_deg, 2),
            "shoulderRotation": round(shoulder_rot_deg, 2),
            "spineAngle": round(spine_angle, 2),
            "divotAngle": round(divot_angle, 2),
            "balanceScore": round(balance, 2),
            "tempoRatio": round(tempo_ratio, 2),
            "backswingDuration": round(float(backswing), 3),
            "headStability": round(head_stability, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_divot_angle(self, pose_data: List[Optional[Dict]], fps: float) -> float:
        wrist_ys = []
        for p in pose_data:
            if p is None:
                wrist_ys.append(None)
                continue
            w = p.get("right_wrist") or p.get("left_wrist")
            if w and w["visibility"] > 0.4:
                wrist_ys.append(w["y"])
            else:
                wrist_ys.append(None)

        velocities = []
        for i in range(1, len(wrist_ys)):
            if wrist_ys[i] is not None and wrist_ys[i - 1] is not None:
                velocities.append(wrist_ys[i] - wrist_ys[i - 1])

        if not velocities:
            return -3.0

        peak_idx = int(np.argmax(np.abs(velocities)))
        if peak_idx < len(velocities) and velocities[peak_idx] > 0:
            angle = float(np.clip(-abs(velocities[peak_idx]) * 0.02, -8.0, 0.0))
        else:
            angle = -3.0

        return round(angle, 2)

    def _compute_sub_scores(self, m: Dict) -> Dict:
        technique = int(np.clip(round(
            (self._normalize(m["spineAngle"], 28, 42) * 0.3
             + self._normalize(m["headStability"], 40, 98) * 0.3
             + self._normalize(abs(m["divotAngle"]), 1, 5) * 0.2
             + self._normalize(m["hipRotation"], 20, 58) * 0.2) * 100
        ), 0, 100))

        accuracy = int(np.clip(round(
            (self._normalize(abs(m["divotAngle"]), 1, 5) * 0.4
             + self._normalize(m["headStability"], 40, 98) * 0.3
             + self._normalize(m["rhythmConsistency"], 50, 98) * 0.3) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 50, 98) * 0.5
             + self._normalize(m["headStability"], 40, 98) * 0.5) * 100
        ), 0, 100))

        power = int(np.clip(round(
            (self._normalize(m["clubHeadSpeed"], 55, 105) * 0.5
             + self._normalize(m["shoulderRotation"], 55, 105) * 0.3
             + self._normalize(m["hipRotation"], 20, 58) * 0.2) * 100
        ), 0, 100))

        balance = int(np.clip(round(
            (self._normalize(m["balanceScore"], 40, 98) * 0.6
             + self._normalize(m["headStability"], 40, 98) * 0.4) * 100
        ), 0, 100))

        return {
            "technique": technique,
            "accuracy": accuracy,
            "consistency": consistency,
            "power": power,
            "balance": balance,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["technique"] * 0.30
            + sub_scores["accuracy"] * 0.25
            + sub_scores["consistency"] * 0.20
            + sub_scores["power"] * 0.15
            + sub_scores["balance"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "iron shot")

    def _fallback_metrics(self) -> Dict:
        return {
            "clubHeadSpeed": 80.0,
            "hipRotation": 38.0,
            "shoulderRotation": 80.0,
            "spineAngle": 35.0,
            "divotAngle": -3.0,
            "balanceScore": 72.0,
            "tempoRatio": 3.0,
            "backswingDuration": 0.85,
            "headStability": 75.0,
            "rhythmConsistency": 70.0,
        }
