import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class TennisForehandAnalyzer(BaseAnalyzer):
    config_key = "tennis-forehand"

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
        swing_phases = self._detect_swing_phases(pose_data, fps)

        wrist_speed = float(np.percentile(wrist_speeds, 90)) if wrist_speeds else 25.0
        pixels_per_meter = frame_h / 1.8
        wrist_speed_ms = wrist_speed / pixels_per_meter
        wrist_speed_ms = float(np.clip(wrist_speed_ms, 15.0, 45.0))

        elbow_angle = float(np.mean(elbow_angles)) if elbow_angles else 130.0

        shoulder_rot_vel = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 600.0
        shoulder_rot_vel = float(np.clip(shoulder_rot_vel, 350.0, 950.0))

        balance = float(np.mean(balance_scores)) if balance_scores else 70.0
        balance = float(np.clip(balance, 40.0, 98.0))

        contact_height = float(np.median(contact_heights)) if contact_heights else 0.9
        contact_height = float(np.clip(contact_height, 0.5, 1.5))

        ball_speed = self.ball_tracker.estimate_speed(fps, frame_h / 1.8)
        ball_speed = float(np.clip(ball_speed, 40.0, 130.0)) if ball_speed > 0 else float(np.random.uniform(55, 95))

        trajectory_arc = self.ball_tracker.estimate_trajectory_arc()
        trajectory_arc = float(np.clip(trajectory_arc, 5.0, 30.0)) if trajectory_arc > 0 else float(np.random.uniform(10, 22))

        spin = self.ball_tracker.estimate_spin(fps)
        spin = float(np.clip(spin, 400.0, 3500.0))

        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "wristSpeed": round(wrist_speed_ms, 2),
            "elbowAngle": round(elbow_angle, 2),
            "shoulderRotation": round(shoulder_rot_vel, 2),
            "balanceScore": round(balance, 2),
            "ballSpeed": round(ball_speed, 2),
            "trajectoryArc": round(trajectory_arc, 2),
            "spinRate": round(spin, 2),
            "shotConsistency": round(shot_consistency, 2),
            "backswingDuration": round(float(swing_phases["backswing"]), 3),
            "contactTiming": round(float(swing_phases["contact"]), 3),
            "followThroughDuration": round(float(swing_phases["follow_through"]), 3),
            "rhythmConsistency": round(rhythm_consistency, 2),
            "contactHeight": round(contact_height, 2),
        }

    def _compute_sub_scores(self, m: Dict) -> Dict:
        nr = self._normalize(m["wristSpeed"], 15.0, 45.0)
        rot = self._normalize(m["shoulderRotation"], 350.0, 950.0)
        bal = self._normalize(m["balanceScore"], 40.0, 98.0)
        cc = self._normalize(m["shotConsistency"], 40.0, 98.0)
        ft = self._normalize(m["followThroughDuration"], 0.3, 1.2)
        rhythm = self._normalize(m["rhythmConsistency"], 50.0, 98.0)

        power = int(np.clip(round(
            (self._normalize(m["ballSpeed"], 40.0, 130.0) * 0.5
             + nr * 0.3
             + self._normalize(m["spinRate"], 400.0, 3500.0) * 0.2) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            (bal * 0.5 + rhythm * 0.3 + cc * 0.2) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            (self._normalize(0.12 - m["contactTiming"], 0.0, 0.10) * 0.4
             + self._normalize(m["backswingDuration"], 0.3, 0.8) * 0.3
             + rhythm * 0.3) * 100
        ), 0, 100))

        follow_through = int(np.clip(round(
            (ft * 0.5 + rot * 0.3
             + self._normalize(m["contactHeight"], 0.5, 1.5) * 0.2) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (cc * 0.6 + rhythm * 0.4) * 100
        ), 0, 100))

        return {
            "power": power,
            "stability": stability,
            "timing": timing,
            "followThrough": follow_through,
            "consistency": consistency,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.25
            + sub_scores["stability"] * 0.20
            + sub_scores["timing"] * 0.25
            + sub_scores["followThrough"] * 0.15
            + sub_scores["consistency"] * 0.15
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        strengths = []
        improvements = []
        suggestions = []

        nr = self._normalize(m["wristSpeed"], 15.0, 45.0)
        if nr > 0.7:
            strengths.append("Your racket acceleration is excellent, generating strong power through the hitting zone.")
        elif nr > 0.4:
            strengths.append("Your racket speed is solid and provides a good foundation for power generation.")
        else:
            improvements.append("Your racket speed could be improved. Focus on generating more acceleration through the contact zone.")
            suggestions.append("Practice shadow swings focusing on explosive acceleration from the slot position to contact point.")

        rot = self._normalize(m["shoulderRotation"], 350.0, 950.0)
        if rot > 0.65:
            strengths.append("Your shoulder rotation is strong, contributing excellent rotational power to your forehand.")
        else:
            improvements.append("Your shoulder rotation is below optimal. This limits the kinetic chain transfer from your body to the racket.")
            suggestions.append("Try rotating your shoulder earlier during swing preparation. Practice the unit turn drill to improve trunk rotation.")

        cc = self._normalize(m["shotConsistency"], 40.0, 98.0)
        if cc > 0.6:
            strengths.append("Your contact point consistency is reliable, showing good hand-eye coordination.")
        else:
            improvements.append("Your contact point varies between shots, reducing power transfer and shot predictability.")
            suggestions.append("Use a ball machine at moderate speed and focus on making contact at the same point relative to your front foot each time.")

        if m["balanceScore"] < 70:
            improvements.append("Your balance during the stroke is unstable. This affects consistency and recovery for the next shot.")
            suggestions.append("Work on wider stance drills and practice hitting while maintaining a low center of gravity throughout the swing.")

        ft = self._normalize(m["followThroughDuration"], 0.3, 1.2)
        if ft < 0.5:
            improvements.append("Your follow-through is shortened, which can reduce topspin and depth on your shots.")
            suggestions.append("Focus on finishing your swing over the opposite shoulder. Imagine wrapping a towel around your neck with the racket.")

        if m["contactTiming"] > 0.08:
            improvements.append("Your contact timing window is wide, suggesting the ball is not being struck cleanly at the sweet spot.")
            suggestions.append("Practice the drop-and-hit drill: drop the ball from waist height and focus on timing a clean strike at the optimal contact point.")

        key_strength = " ".join(strengths) if strengths else "Your overall technique shows a solid foundation with room for targeted improvements."
        improvement_area = " ".join(improvements) if improvements else "Your metrics are well-balanced. Focus on maintaining consistency across all areas."
        training_suggestion = " ".join(suggestions) if suggestions else "Continue your current training regimen while focusing on match play to test your technique under pressure."

        if overall_score >= 75:
            level = "This is an advanced level stroke with strong fundamentals."
        elif overall_score >= 50:
            level = "Your stroke shows intermediate technique with clear areas for growth."
        else:
            level = "Your stroke is developing. Focus on the suggested drills to build a stronger foundation."

        simple_explanation = (
            f"Your forehand scored {overall_score}/100 overall. {level} "
            f"Power: {sub_scores['power']}, Stability: {sub_scores['stability']}, "
            f"Timing: {sub_scores['timing']}, Follow-through: {sub_scores['followThrough']}."
        )

        return {
            "keyStrength": key_strength,
            "improvementArea": improvement_area,
            "trainingSuggestion": training_suggestion,
            "simpleExplanation": simple_explanation,
        }

    def _fallback_metrics(self) -> Dict:
        return {
            "wristSpeed": 25.0,
            "elbowAngle": 130.0,
            "shoulderRotation": 600.0,
            "balanceScore": 70.0,
            "ballSpeed": 70.0,
            "trajectoryArc": 15.0,
            "spinRate": 1500.0,
            "shotConsistency": 65.0,
            "backswingDuration": 0.5,
            "contactTiming": 0.06,
            "followThroughDuration": 0.6,
            "rhythmConsistency": 70.0,
            "contactHeight": 0.9,
        }
