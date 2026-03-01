import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class BadmintonNetShotAnalyzer(BaseAnalyzer):
    config_key = "badminton-net-shot"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)
        balance_scores = self._calc_balance_scores(valid_poses)

        racket_control = self._calc_racket_control(wrist_speeds, elbow_angles)
        wrist_finesse = self._calc_wrist_finesse(wrist_speeds)
        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 75.0, 65.0, 95.0))
        footwork_score = self._calc_footwork(pose_data, fps)
        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "racketControl": round(racket_control, 2),
            "wristFinesse": round(wrist_finesse, 2),
            "balanceScore": round(balance, 2),
            "footworkScore": round(footwork_score, 2),
            "shotConsistency": round(shot_consistency, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_racket_control(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        if len(wrist_speeds) < 3 or len(elbow_angles) < 3:
            return 78.0
        speed_cv = float(np.std(wrist_speeds)) / float(np.mean(wrist_speeds)) if np.mean(wrist_speeds) > 0 else 1.0
        angle_std = float(np.std(elbow_angles))
        control = max(0, 100 - speed_cv * 50 - angle_std * 0.5)
        return float(np.clip(control, 70, 98))

    def _calc_wrist_finesse(self, wrist_speeds: List[float]) -> float:
        if len(wrist_speeds) < 3:
            return 78.0
        mean_speed = float(np.mean(wrist_speeds))
        peak_speed = float(np.max(wrist_speeds))
        ratio = peak_speed / mean_speed if mean_speed > 0 else 2.0
        score = float(np.clip(100 - abs(ratio - 1.8) * 25, 70, 98))
        return score

    def _calc_footwork(self, pose_data: List[Optional[Dict]], fps: float) -> float:
        ankle_movements = []
        prev_left = None
        prev_right = None
        dt = 1.0 / fps

        for p in pose_data:
            if p is None:
                prev_left = None
                prev_right = None
                continue
            la = p.get("left_ankle")
            ra = p.get("right_ankle")
            if la and ra and la.get("visibility", 0) > 0.4 and ra.get("visibility", 0) > 0.4:
                if prev_left is not None and prev_right is not None:
                    left_speed = ((la["x"] - prev_left["x"])**2 + (la["y"] - prev_left["y"])**2)**0.5 / dt
                    right_speed = ((ra["x"] - prev_right["x"])**2 + (ra["y"] - prev_right["y"])**2)**0.5 / dt
                    ankle_movements.append((left_speed + right_speed) / 2)
                prev_left = la
                prev_right = ra
            else:
                prev_left = None
                prev_right = None

        if ankle_movements:
            mean_movement = float(np.mean(ankle_movements))
            score = float(np.clip(self._normalize(mean_movement, 0, 500) * 100, 65, 95))
            return score
        return 75.0

    def _compute_sub_scores(self, m: Dict) -> Dict:
        control = int(np.clip(round(
            (self._normalize(m["racketControl"], 70.0, 98.0) * 0.6
             + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        finesse = int(np.clip(round(
            (self._normalize(m["wristFinesse"], 70.0, 98.0) * 0.6
             + self._normalize(m["racketControl"], 70.0, 98.0) * 0.4) * 100
        ), 0, 100))

        footwork = int(np.clip(round(
            (self._normalize(m["footworkScore"], 65.0, 95.0) * 0.6
             + self._normalize(m["balanceScore"], 65.0, 95.0) * 0.4) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            self._normalize(m["shotConsistency"], 70.0, 98.0) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100
        ), 0, 100))

        return {
            "control": control,
            "finesse": finesse,
            "footwork": footwork,
            "consistency": consistency,
            "timing": timing,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["control"] * 0.30
            + sub_scores["finesse"] * 0.25
            + sub_scores["footwork"] * 0.20
            + sub_scores["consistency"] * 0.15
            + sub_scores["timing"] * 0.10
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "net shot")

    def _fallback_metrics(self) -> Dict:
        return {
            "racketControl": 78.0,
            "wristFinesse": 78.0,
            "balanceScore": 75.0,
            "footworkScore": 75.0,
            "shotConsistency": 72.0,
            "rhythmConsistency": 72.0,
        }
