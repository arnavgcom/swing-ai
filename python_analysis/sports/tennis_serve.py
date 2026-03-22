import numpy as np
import math
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer
from python_analysis.pose_detector import PoseDetector


class TennisServeAnalyzer(BaseAnalyzer):
    config_key = "tennis-serve"
    core_metric_keys = {
        "wristSpeed",
        "shoulderRotation",
        "tossHeight",
        "trophyAngle",
        "pronation",
        "ballSpeed",
        "trajectoryArc",
        "spinRate",
        "balanceScore",
        "backswingDuration",
        "contactTiming",
        "contactHeight",
        "rhythmConsistency",
    }

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        shoulder_rotations = self._calc_shoulder_rotation(pose_data, fps)
        balance_scores = self._calc_balance_scores(valid_poses)
        contact_heights = self._calc_contact_heights(valid_poses, frame_h)
        swing_phases = self._detect_swing_phases(pose_data, fps)

        wrist_speed = float(np.percentile(wrist_speeds, 90)) if wrist_speeds else 30.0
        pixels_per_meter = frame_h / 1.8
        wrist_speed_ms = float(np.clip(wrist_speed / pixels_per_meter, 20.0, 55.0))

        shoulder_rot_vel = float(np.percentile(shoulder_rotations, 90)) if shoulder_rotations else 700.0
        shoulder_rot_vel = float(np.clip(shoulder_rot_vel, 400.0, 1200.0))

        toss_height = self._calc_toss_height(pose_data, frame_h)
        trophy_angle = self._calc_trophy_angle(valid_poses)
        pronation = self._calc_pronation(pose_data, fps)

        ball_speed = self.ball_tracker.estimate_speed(fps, frame_h / 1.8)
        ball_speed = float(np.clip(ball_speed, 50.0, 140.0)) if ball_speed > 0 else float(90.00)

        trajectory_arc = self.ball_tracker.estimate_trajectory_arc()
        trajectory_arc = float(np.clip(trajectory_arc, 2.0, 20.0)) if trajectory_arc > 0 else float(8.50)

        spin = float(np.clip(self.ball_tracker.estimate_spin(fps), 500.0, 3800.0))

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 72.0, 40.0, 98.0))
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        contact_height_m = float(np.median(contact_heights)) if contact_heights else 2.4
        contact_height_m = float(np.clip(contact_height_m * 1.6, 1.8, 3.0))

        return {
            "wristSpeed": round(wrist_speed_ms, 2),
            "shoulderRotation": round(shoulder_rot_vel, 2),
            "tossHeight": round(toss_height, 2),
            "trophyAngle": round(trophy_angle, 2),
            "pronation": round(pronation, 2),
            "ballSpeed": round(ball_speed, 2),
            "trajectoryArc": round(trajectory_arc, 2),
            "spinRate": round(spin, 2),
            "balanceScore": round(balance, 2),
            "backswingDuration": round(float(swing_phases["backswing"]), 3),
            "contactTiming": round(float(swing_phases["contact"]), 3),
            "contactHeight": round(contact_height_m, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_toss_height(self, pose_data: List[Optional[Dict]], frame_h: int) -> float:
        max_wrist_heights = []
        for p in pose_data:
            if p is None:
                continue
            wrist = p.get("left_wrist")
            if wrist and wrist["visibility"] > 0.4:
                max_wrist_heights.append(wrist["y"])

        if len(max_wrist_heights) < 5:
            return 0.5

        min_y = min(max_wrist_heights)
        max_y = max(max_wrist_heights)
        height_px = max_y - min_y
        height_m = (height_px / frame_h) * 1.8
        return float(np.clip(height_m, 0.2, 1.0))

    def _calc_trophy_angle(self, poses: List[Dict]) -> float:
        angles = []
        for p in poses:
            shoulder = p.get("right_shoulder")
            elbow = p.get("right_elbow")
            wrist = p.get("right_wrist")
            if (shoulder and elbow and wrist
                and shoulder["visibility"] > 0.4
                and elbow["visibility"] > 0.4
                and wrist["visibility"] > 0.4):
                angle = PoseDetector.calc_angle(shoulder, elbow, wrist)
                if 60 < angle < 140:
                    angles.append(angle)

        if not angles:
            return 95.0

        min_angle = min(angles)
        return float(np.clip(min_angle, 60, 140))

    def _calc_pronation(self, pose_data: List[Optional[Dict]], fps: float) -> float:
        wrist_rotation_speeds = []
        dt = 1.0 / fps
        prev_angle = None

        for p in pose_data:
            if p is None:
                prev_angle = None
                continue
            elbow = p.get("right_elbow")
            wrist = p.get("right_wrist")
            if elbow and wrist and elbow["visibility"] > 0.4 and wrist["visibility"] > 0.4:
                dx = wrist["x"] - elbow["x"]
                dy = wrist["y"] - elbow["y"]
                angle = math.degrees(math.atan2(dy, dx))
                if prev_angle is not None:
                    vel = abs(angle - prev_angle) / dt
                    if vel < 2000:
                        wrist_rotation_speeds.append(vel)
                prev_angle = angle
            else:
                prev_angle = None

        if wrist_rotation_speeds:
            return float(np.clip(np.percentile(wrist_rotation_speeds, 90), 200, 1200))
        return 550.0

    def _compute_sub_scores(self, m: Dict) -> Dict:
        power = int(np.clip(round(
            (self._normalize(m["ballSpeed"], 50.0, 140.0) * 0.4
             + self._normalize(m["wristSpeed"], 20.0, 55.0) * 0.35
             + self._normalize(m["spinRate"], 500.0, 3800.0) * 0.25) * 100
        ), 0, 100))

        accuracy = int(np.clip(round(
            (self._normalize(m["tossHeight"], 0.3, 0.8) * 0.4
             + self._normalize(m["contactHeight"], 2.2, 2.8) * 0.35
             + self._normalize(m["trajectoryArc"], 3.0, 15.0) * 0.25) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            (self._normalize(0.08 - m["contactTiming"], 0.0, 0.06) * 0.4
             + self._normalize(m["backswingDuration"], 0.8, 1.5) * 0.3
             + self._normalize(m["rhythmConsistency"], 50.0, 98.0) * 0.3) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["trophyAngle"], 80.0, 110.0) * 0.35
             + self._normalize(m["pronation"], 400.0, 900.0) * 0.35
             + self._normalize(m["shoulderRotation"], 400.0, 1200.0) * 0.3) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["rhythmConsistency"], 50.0, 98.0) * 0.5
             + self._normalize(m["balanceScore"], 40.0, 98.0) * 0.5) * 100
        ), 0, 100))

        return {
            "power": power,
            "accuracy": accuracy,
            "timing": timing,
            "technique": technique,
            "consistency": consistency,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["power"] * 0.30
            + sub_scores["accuracy"] * 0.25
            + sub_scores["timing"] * 0.20
            + sub_scores["technique"] * 0.15
            + sub_scores["consistency"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        strengths = []
        improvements = []
        suggestions = []

        if sub_scores["power"] >= 70:
            strengths.append("Your serve generates excellent power with good racket speed and ball velocity.")
        elif sub_scores["power"] < 50:
            improvements.append("Your serve power is below average. Work on the kinetic chain from legs through trunk rotation.")
            suggestions.append("Practice the trophy position drill and focus on explosive leg drive to generate more power.")

        if sub_scores["technique"] >= 70:
            strengths.append("Your serving technique shows proper trophy position and pronation mechanics.")
        elif sub_scores["technique"] < 50:
            improvements.append("Your serve technique needs refinement in the trophy position and pronation.")
            suggestions.append("Work on the serve progression drill: toss, trophy position hold, then full motion.")

        if sub_scores["accuracy"] >= 70:
            strengths.append("Your toss placement and contact point are consistent, enabling accurate serving.")
        elif sub_scores["accuracy"] < 50:
            improvements.append("Your toss consistency and contact height need improvement for better placement.")
            suggestions.append("Practice toss accuracy by placing a target on the ground and catching the toss without swinging.")

        key_strength = " ".join(strengths) if strengths else "Your serve shows solid fundamentals."
        improvement_area = " ".join(improvements) if improvements else "Your serve metrics are balanced."
        training_suggestion = " ".join(suggestions) if suggestions else "Continue refining your serve with targeted practice."

        if overall_score >= 75:
            level = "This is an advanced serve with strong mechanics."
        elif overall_score >= 50:
            level = "Your serve is at intermediate level with room to grow."
        else:
            level = "Your serve is developing. Focus on the fundamentals."

        score_parts = ", ".join([f"{k.capitalize()}: {v}" for k, v in sub_scores.items()])
        simple_explanation = f"Your serve scored {overall_score}/100 overall. {level} {score_parts}."

        return {
            "keyStrength": key_strength,
            "improvementArea": improvement_area,
            "trainingSuggestion": training_suggestion,
            "simpleExplanation": simple_explanation,
        }

    def _fallback_metrics(self) -> Dict:
        return {
            "wristSpeed": 30.0,
            "shoulderRotation": 700.0,
            "tossHeight": 0.5,
            "trophyAngle": 95.0,
            "pronation": 550.0,
            "ballSpeed": 85.0,
            "trajectoryArc": 8.0,
            "spinRate": 1800.0,
            "balanceScore": 72.0,
            "backswingDuration": 1.0,
            "contactTiming": 0.04,
            "contactHeight": 2.4,
            "rhythmConsistency": 70.0,
        }
