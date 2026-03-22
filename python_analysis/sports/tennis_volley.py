import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer
from python_analysis.pose_detector import PoseDetector


class TennisVolleyAnalyzer(BaseAnalyzer):
    config_key = "tennis-volley"
    core_metric_keys = {
        "reactionSpeed",
        "racketPrep",
        "wristFirmness",
        "splitStepTiming",
        "balanceScore",
        "contactHeight",
        "stepForward",
        "ballSpeed",
        "shotConsistency",
    }

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        balance_scores = self._calc_balance_scores(valid_poses)
        contact_heights = self._calc_contact_heights(valid_poses, frame_h)

        reaction_speed = self._calc_reaction_speed(wrist_speeds, fps)
        racket_prep = self._calc_racket_prep(pose_data)
        wrist_firmness = self._calc_wrist_firmness(wrist_speeds)
        split_step = self._calc_split_step_timing(pose_data, fps)
        step_forward = self._calc_step_forward(pose_data)

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 72.0, 40.0, 98.0))
        contact_height = float(np.clip(float(np.median(contact_heights)) if contact_heights else 1.0, 0.5, 1.8))

        ball_speed = self.ball_tracker.estimate_speed(fps, frame_h / 1.8)
        ball_speed = float(np.clip(ball_speed, 20.0, 80.0)) if ball_speed > 0 else float(47.50)

        shot_consistency = self._calc_shot_consistency(
            self._calc_elbow_angles(valid_poses), wrist_speeds
        )
        rhythm_consistency = None
        if self._metric_requested("rhythmConsistency"):
            rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        metrics = {
            "reactionSpeed": round(reaction_speed, 2),
            "racketPrep": round(racket_prep, 2),
            "wristFirmness": round(wrist_firmness, 2),
            "splitStepTiming": round(split_step, 3),
            "balanceScore": round(balance, 2),
            "contactHeight": round(contact_height, 2),
            "stepForward": round(step_forward, 2),
            "ballSpeed": round(ball_speed, 2),
            "shotConsistency": round(shot_consistency, 2),
        }
        if rhythm_consistency is not None:
            metrics["rhythmConsistency"] = round(rhythm_consistency, 2)
        return metrics

    def _calc_reaction_speed(self, wrist_speeds: List[float], fps: float) -> float:
        if not wrist_speeds:
            return 250.0
        first_fast = None
        threshold = float(np.percentile(wrist_speeds, 70)) if len(wrist_speeds) > 3 else 100.0
        for i, s in enumerate(wrist_speeds):
            if s > threshold:
                first_fast = i
                break
        if first_fast is None:
            return 300.0
        reaction_ms = (first_fast / fps) * 1000
        return float(np.clip(reaction_ms, 100, 500))

    def _calc_racket_prep(self, pose_data: List[Optional[Dict]]) -> float:
        early_prep_count = 0
        total = 0
        for p in pose_data:
            if p is None:
                continue
            wrist = p.get("right_wrist") or p.get("left_wrist")
            shoulder = p.get("right_shoulder") or p.get("left_shoulder")
            if wrist and shoulder and wrist["visibility"] > 0.4 and shoulder["visibility"] > 0.4:
                total += 1
                if abs(wrist["x"] - shoulder["x"]) < abs(shoulder["x"]) * 0.3:
                    early_prep_count += 1
        if total == 0:
            return 75.0
        return float(np.clip((early_prep_count / total) * 100, 50, 98))

    def _calc_wrist_firmness(self, wrist_speeds: List[float]) -> float:
        if len(wrist_speeds) < 3:
            return 75.0
        cv = float(np.std(wrist_speeds)) / float(np.mean(wrist_speeds)) if np.mean(wrist_speeds) > 0 else 0.5
        firmness = max(0, 100 - cv * 60)
        return float(np.clip(firmness, 50, 98))

    def _calc_split_step_timing(self, pose_data: List[Optional[Dict]], fps: float) -> float:
        ankle_ys = []
        for p in pose_data:
            if p is None:
                ankle_ys.append(None)
                continue
            la = p.get("left_ankle")
            ra = p.get("right_ankle")
            if la and ra:
                ankle_ys.append((la["y"] + ra["y"]) / 2)
            else:
                ankle_ys.append(None)

        valid = [y for y in ankle_ys if y is not None]
        if len(valid) < 10:
            return 0.25

        velocities = []
        for i in range(1, len(ankle_ys)):
            if ankle_ys[i] is not None and ankle_ys[i - 1] is not None:
                velocities.append(abs(ankle_ys[i] - ankle_ys[i - 1]))
            else:
                velocities.append(0)

        if not velocities:
            return 0.25

        peak_idx = int(np.argmax(velocities))
        timing = peak_idx / fps
        return float(np.clip(timing, 0.05, 0.6))

    def _calc_step_forward(self, pose_data: List[Optional[Dict]]) -> float:
        ankle_xs = []
        for p in pose_data:
            if p is None:
                continue
            ra = p.get("right_ankle")
            la = p.get("left_ankle")
            ankle = ra or la
            if ankle:
                ankle_xs.append(ankle["x"])

        if len(ankle_xs) < 5:
            return 70.0

        forward_movement = max(ankle_xs) - min(ankle_xs)
        score = float(np.clip(forward_movement * 0.3, 40, 98))
        return score

    def _compute_sub_scores(self, m: Dict) -> Dict:
        reflexes = int(np.clip(round(
            (self._normalize(500 - m["reactionSpeed"], 0, 350) * 0.6
             + self._normalize(m["racketPrep"], 50, 98) * 0.4) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            (self._normalize(m["balanceScore"], 40, 98) * 0.5
             + self._normalize(m["wristFirmness"], 50, 98) * 0.5) * 100
        ), 0, 100))

        placement = int(np.clip(round(
            (self._normalize(m["contactHeight"], 0.8, 1.5) * 0.4
             + self._normalize(m["ballSpeed"], 30, 70) * 0.3
             + self._normalize(m["stepForward"], 40, 98) * 0.3) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["racketPrep"], 50, 98) * 0.35
             + self._normalize(m["wristFirmness"], 50, 98) * 0.35
             + self._normalize(m["shotConsistency"], 40, 98) * 0.3) * 100
        ), 0, 100))

        return {
            "reflexes": reflexes,
            "stability": stability,
            "placement": placement,
            "technique": technique,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["reflexes"] * 0.30
            + sub_scores["stability"] * 0.25
            + sub_scores["placement"] * 0.25
            + sub_scores["technique"] * 0.20
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        strengths = []
        improvements = []
        suggestions = []

        if sub_scores["reflexes"] >= 70:
            strengths.append("Your reflexes and racket preparation are quick, giving you an advantage at the net.")
        elif sub_scores["reflexes"] < 50:
            improvements.append("Your reaction time at the net needs improvement.")
            suggestions.append("Practice reflex volley drills with a partner feeding rapid-fire balls from close range.")

        if sub_scores["stability"] >= 70:
            strengths.append("Your wrist firmness and balance during volleys are excellent.")
        elif sub_scores["stability"] < 50:
            improvements.append("Your wrist breaks too much at contact and your balance is inconsistent.")
            suggestions.append("Practice volleys with a continental grip, focusing on punching through the ball with a firm wrist.")

        if sub_scores["placement"] >= 70:
            strengths.append("Your volley placement and depth control are strong.")
        elif sub_scores["placement"] < 50:
            improvements.append("Your volley placement needs more precision.")
            suggestions.append("Set up targets on the court and practice directing volleys to specific zones.")

        key_strength = " ".join(strengths) if strengths else "Your volley technique is developing well."
        improvement_area = " ".join(improvements) if improvements else "Your volley metrics are balanced."
        training_suggestion = " ".join(suggestions) if suggestions else "Continue net approach drills to improve your volleying."

        if overall_score >= 75:
            level = "This is an advanced volley with excellent net skills."
        elif overall_score >= 50:
            level = "Your volley is at intermediate level."
        else:
            level = "Your volley needs more work at the net."

        score_parts = ", ".join([f"{k.capitalize()}: {v}" for k, v in sub_scores.items()])
        simple_explanation = f"Your volley scored {overall_score}/100 overall. {level} {score_parts}."

        return {
            "keyStrength": key_strength,
            "improvementArea": improvement_area,
            "trainingSuggestion": training_suggestion,
            "simpleExplanation": simple_explanation,
        }

    def _fallback_metrics(self) -> Dict:
        return {
            "reactionSpeed": 250.0,
            "racketPrep": 75.0,
            "wristFirmness": 75.0,
            "splitStepTiming": 0.25,
            "balanceScore": 72.0,
            "contactHeight": 1.0,
            "stepForward": 70.0,
            "ballSpeed": 45.0,
            "shotConsistency": 65.0,
            "rhythmConsistency": 70.0,
        }
