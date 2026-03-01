import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class GolfDriveAnalyzer(BaseAnalyzer):
    config_key = "golf-drive"

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

        club_head_speed = float(np.percentile(wrist_speeds, 95)) if wrist_speeds else 400.0
        pixels_per_meter = frame_h / 1.8
        club_speed_mph = (club_head_speed / pixels_per_meter) * 2.237
        club_speed_mph = float(np.clip(club_speed_mph, 70.0, 125.0))

        hip_rot = float(np.percentile(hip_rotations, 90)) if hip_rotations else 45.0
        hip_rot_deg = float(np.clip(hip_rot * 0.08, 25.0, 65.0))

        shoulder_rot = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 85.0
        shoulder_rot_deg = float(np.clip(shoulder_rot * 0.12, 60.0, 110.0))

        x_factor = float(np.clip(shoulder_rot_deg - hip_rot_deg, 15.0, 60.0))

        spine_angle = float(np.mean(spine_angles)) if spine_angles else 32.0
        spine_angle = float(np.clip(spine_angle, 15.0, 50.0))

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 72.0, 40.0, 98.0))

        backswing = swing_phases["backswing"]
        follow_through = swing_phases["follow_through"]
        downswing = float(np.clip(swing_phases["contact"] * 5, 0.15, 0.5))
        tempo_ratio = float(np.clip(backswing / downswing if downswing > 0 else 3.0, 1.5, 5.0))

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
            "downswingDuration": round(downswing, 3),
            "followThroughDuration": round(float(follow_through), 3),
            "headStability": round(head_stability, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["clubHeadSpeed"], 70, 125) * 0.5
             + self._normalize(m["shoulderRotation"], 60, 110) * 0.3
             + self._normalize(m["xFactor"], 15, 60) * 0.2) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["spineAngle"], 25, 40) * 0.35
             + self._normalize(m["headStability"], 40, 98) * 0.35
             + self._normalize(m["hipRotation"], 25, 65) * 0.3) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 50, 98) * 0.5
             + self._normalize(m["headStability"], 40, 98) * 0.5) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            (self._normalize(m["tempoRatio"], 2.5, 3.5) * 0.4
             + self._normalize(m["backswingDuration"], 0.7, 1.2) * 0.3
             + self._normalize(m["downswingDuration"], 0.2, 0.4) * 0.3) * 100
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
            sub_scores["power"] * 0.30
            + sub_scores["technique"] * 0.25
            + sub_scores["consistency"] * 0.20
            + sub_scores["timing"] * 0.15
            + sub_scores["balance"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        strengths = []
        improvements = []
        suggestions = []

        if sub_scores["power"] >= 70:
            strengths.append("Your drive generates excellent club head speed and power through impact.")
        elif sub_scores["power"] < 50:
            improvements.append("Your drive lacks power. Focus on generating more club head speed through the hitting zone.")
            suggestions.append("Work on the X-factor stretch: maximize shoulder-hip separation at the top of your backswing.")

        if sub_scores["technique"] >= 70:
            strengths.append("Your spine angle and body positions are well-maintained through the swing.")
        elif sub_scores["technique"] < 50:
            improvements.append("Your spine angle changes during the swing, affecting consistency.")
            suggestions.append("Practice in front of a mirror maintaining your spine angle from address through impact.")

        if sub_scores["timing"] >= 70:
            strengths.append("Your swing tempo is excellent with a good backswing-to-downswing ratio.")
        elif sub_scores["timing"] < 50:
            improvements.append("Your swing tempo is off. The transition from backswing to downswing is too rushed or too slow.")
            suggestions.append("Use a metronome or count '1...2...3' for backswing and 'go' for downswing to develop proper tempo.")

        key_strength = " ".join(strengths) if strengths else "Your drive shows solid fundamentals."
        improvement_area = " ".join(improvements) if improvements else "Your drive metrics are well-balanced."
        training_suggestion = " ".join(suggestions) if suggestions else "Continue with your current practice routine and focus on consistency."

        if overall_score >= 75:
            level = "This is an advanced drive with strong mechanics."
        elif overall_score >= 50:
            level = "Your drive is at intermediate level with room for improvement."
        else:
            level = "Your drive is developing. Focus on the fundamentals."

        score_parts = ", ".join([f"{k.capitalize()}: {v}" for k, v in sub_scores.items()])
        simple_explanation = f"Your drive scored {overall_score}/100 overall. {level} {score_parts}."

        return {
            "keyStrength": key_strength,
            "improvementArea": improvement_area,
            "trainingSuggestion": training_suggestion,
            "simpleExplanation": simple_explanation,
        }

    def _fallback_metrics(self) -> Dict:
        return {
            "clubHeadSpeed": 92.0,
            "hipRotation": 42.0,
            "shoulderRotation": 85.0,
            "xFactor": 38.0,
            "spineAngle": 32.0,
            "balanceScore": 72.0,
            "tempoRatio": 3.0,
            "backswingDuration": 0.9,
            "downswingDuration": 0.3,
            "followThroughDuration": 0.7,
            "headStability": 75.0,
            "rhythmConsistency": 70.0,
        }
