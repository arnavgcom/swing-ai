import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class TennisBackhandAnalyzer(BaseAnalyzer):
    config_key = "tennis-backhand"

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

        wrist_speed = float(np.percentile(wrist_speeds, 90)) if wrist_speeds else 22.0
        pixels_per_meter = frame_h / 1.8
        wrist_speed_ms = float(np.clip(wrist_speed / pixels_per_meter, 12.0, 40.0))

        elbow_angle = float(np.mean(elbow_angles)) if elbow_angles else 125.0
        shoulder_rot_vel = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 550.0
        shoulder_rot_vel = float(np.clip(shoulder_rot_vel, 300.0, 850.0))

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 70.0, 40.0, 98.0))
        contact_height = float(np.clip(float(np.median(contact_heights)) if contact_heights else 0.85, 0.5, 1.4))

        ball_speed = self.ball_tracker.estimate_speed(fps, frame_h / 1.8)
        ball_speed = float(np.clip(ball_speed, 35.0, 110.0)) if ball_speed > 0 else float(np.random.uniform(45, 85))

        trajectory_arc = self.ball_tracker.estimate_trajectory_arc()
        trajectory_arc = float(np.clip(trajectory_arc, 5.0, 28.0)) if trajectory_arc > 0 else float(np.random.uniform(8, 20))

        spin = float(np.clip(self.ball_tracker.estimate_spin(fps), 400.0, 3000.0))

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
        nr = self._normalize(m["wristSpeed"], 12.0, 40.0)
        rot = self._normalize(m["shoulderRotation"], 300.0, 850.0)
        bal = self._normalize(m["balanceScore"], 40.0, 98.0)
        cc = self._normalize(m["shotConsistency"], 40.0, 98.0)
        ft = self._normalize(m["followThroughDuration"], 0.3, 1.2)
        rhythm = self._normalize(m["rhythmConsistency"], 50.0, 98.0)

        power = int(np.clip(round(
            (self._normalize(m["ballSpeed"], 35.0, 110.0) * 0.5 + nr * 0.3 + self._normalize(m["spinRate"], 400.0, 3000.0) * 0.2) * 100
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
            (ft * 0.5 + rot * 0.3 + self._normalize(m["contactHeight"], 0.5, 1.4) * 0.2) * 100
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
            sub_scores["power"] * 0.20
            + sub_scores["stability"] * 0.25
            + sub_scores["timing"] * 0.25
            + sub_scores["followThrough"] * 0.15
            + sub_scores["consistency"] * 0.15
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        strengths = []
        improvements = []
        suggestions = []

        nr = self._normalize(m["wristSpeed"], 12.0, 40.0)
        if nr > 0.6:
            strengths.append("Your backhand racket speed is strong, generating good power through the stroke.")
        else:
            improvements.append("Your backhand racket speed needs work. Focus on using your body rotation to generate more racket acceleration.")
            suggestions.append("Practice the two-handed backhand unit turn drill to improve power generation through trunk rotation.")

        bal = self._normalize(m["balanceScore"], 40.0, 98.0)
        if bal > 0.6:
            strengths.append("Your balance and weight transfer during the backhand is solid.")
        else:
            improvements.append("Your balance shifts too much during the backhand. Stability is crucial for a consistent backhand.")
            suggestions.append("Practice hitting backhands with your feet set wider, focusing on staying low through the shot.")

        cc = self._normalize(m["shotConsistency"], 40.0, 98.0)
        if cc > 0.6:
            strengths.append("Your backhand consistency is good, showing repeatable mechanics.")
        else:
            improvements.append("Your backhand technique varies between shots. Work on repeating the same motion each time.")
            suggestions.append("Use a ball machine and groove your backhand with the same swing path for 15 minutes daily.")

        key_strength = " ".join(strengths) if strengths else "Your backhand shows developing technique with a good base to build on."
        improvement_area = " ".join(improvements) if improvements else "Your backhand metrics are balanced. Continue refining all areas."
        training_suggestion = " ".join(suggestions) if suggestions else "Integrate your backhand into rally drills to test consistency under pressure."

        if overall_score >= 75:
            level = "This is an advanced backhand with strong fundamentals."
        elif overall_score >= 50:
            level = "Your backhand is at an intermediate level with clear areas for growth."
        else:
            level = "Your backhand is developing. Focus on the suggested drills."

        simple_explanation = (
            f"Your backhand scored {overall_score}/100 overall. {level} "
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
            "wristSpeed": 22.0,
            "elbowAngle": 125.0,
            "shoulderRotation": 550.0,
            "balanceScore": 70.0,
            "ballSpeed": 60.0,
            "trajectoryArc": 14.0,
            "spinRate": 1300.0,
            "shotConsistency": 65.0,
            "backswingDuration": 0.5,
            "contactTiming": 0.06,
            "followThroughDuration": 0.6,
            "rhythmConsistency": 70.0,
            "contactHeight": 0.85,
        }
