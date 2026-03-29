import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class PickleballVolleyAnalyzer(BaseAnalyzer):
    config_key = "pickleball-volley"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)
        balance_scores = self._calc_balance_scores(valid_poses)

        reaction_speed = self._calc_reaction_speed(wrist_speeds, fps)
        paddle_prep = self._calc_paddle_prep(pose_data)
        wrist_firmness = self._calc_wrist_firmness(wrist_speeds)

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 72.0, 40.0, 98.0))

        ball_speed = self.ball_tracker.estimate_speed(fps, frame_h / 1.8)
        ball_speed = float(np.clip(ball_speed, 15.0, 55.0)) if ball_speed > 0 else float(35.00)

        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "reactionSpeed": round(reaction_speed, 2),
            "paddlePrep": round(paddle_prep, 2),
            "wristFirmness": round(wrist_firmness, 2),
            "balanceScore": round(balance, 2),
            "ballSpeed": round(ball_speed, 2),
            "shotConsistency": round(shot_consistency, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_reaction_speed(self, wrist_speeds: List[float], fps: float) -> float:
        if not wrist_speeds:
            return 250.0
        threshold = float(np.percentile(wrist_speeds, 70)) if len(wrist_speeds) > 3 else 100.0
        first_fast = None
        for i, s in enumerate(wrist_speeds):
            if s > threshold:
                first_fast = i
                break
        if first_fast is None:
            return 300.0
        reaction_ms = (first_fast / fps) * 1000
        return float(np.clip(reaction_ms, 80, 500))

    def _calc_paddle_prep(self, pose_data: List[Optional[Dict]]) -> float:
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

    def _compute_sub_scores(self, m: Dict) -> Dict:
        reflexes = int(np.clip(round(
            (self._normalize(500 - m["reactionSpeed"], 0, 400) * 0.6
             + self._normalize(m["paddlePrep"], 50, 98) * 0.4) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["paddlePrep"], 50, 98) * 0.4
             + self._normalize(m["wristFirmness"], 50, 98) * 0.3
             + self._normalize(m["shotConsistency"], 40, 98) * 0.3) * 100
        ), 0, 100))

        stability = int(np.clip(round(
            (self._normalize(m["balanceScore"], 40, 98) * 0.6
             + self._normalize(m["wristFirmness"], 50, 98) * 0.4) * 100
        ), 0, 100))

        power = int(np.clip(round(
            (self._normalize(m["ballSpeed"], 20, 50) * 0.7
             + self._normalize(m["paddlePrep"], 50, 98) * 0.3) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 40, 98) * 0.6
             + self._normalize(m["rhythmConsistency"], 50, 98) * 0.4) * 100
        ), 0, 100))

        rhythm = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 50, 98) * 100
        ), 0, 100))

        return {
            "reflexes": reflexes,
            "technique": technique,
            "stability": stability,
            "power": power,
            "consistency": consistency,
            "rhythm": rhythm,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["reflexes"] * 0.25
            + sub_scores["technique"] * 0.20
            + sub_scores["stability"] * 0.15
            + sub_scores["power"] * 0.15
            + sub_scores["consistency"] * 0.15
            + sub_scores["rhythm"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "volley")

    def _fallback_metrics(self) -> Dict:
        return {
            "reactionSpeed": 250.0,
            "paddlePrep": 75.0,
            "wristFirmness": 75.0,
            "balanceScore": 72.0,
            "ballSpeed": 35.0,
            "shotConsistency": 65.0,
            "rhythmConsistency": 70.0,
        }
