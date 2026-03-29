import numpy as np
import math
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer


class BadmintonServeAnalyzer(BaseAnalyzer):
    config_key = "badminton-serve"

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        elbow_angles = self._calc_elbow_angles(valid_poses)

        racket_angle = self._calc_racket_angle(valid_poses)

        pixels_per_meter = frame_h / 1.8
        shuttle_speed = self.ball_tracker.estimate_speed(fps, pixels_per_meter)
        shuttle_speed = float(np.clip(shuttle_speed, 30.0, 100.0)) if shuttle_speed > 0 else float(57.50)

        placement_score = self._calc_placement_score(wrist_speeds, elbow_angles)
        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        return {
            "racketAngle": round(racket_angle, 2),
            "shuttleSpeed": round(shuttle_speed, 2),
            "placementScore": round(placement_score, 2),
            "shotConsistency": round(shot_consistency, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }

    def _calc_racket_angle(self, poses: List[Dict]) -> float:
        angles = []
        for p in poses:
            elbow = p.get("right_elbow") or p.get("left_elbow")
            wrist = p.get("right_wrist") or p.get("left_wrist")
            if elbow and wrist and elbow.get("visibility", 0) > 0.4 and wrist.get("visibility", 0) > 0.4:
                dx = wrist["x"] - elbow["x"]
                dy = wrist["y"] - elbow["y"]
                angle = abs(math.degrees(math.atan2(dy, dx)))
                if 5 < angle < 80:
                    angles.append(angle)

        if angles:
            return float(np.clip(np.mean(angles), 15.0, 40.0))
        return 25.0

    def _calc_placement_score(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        if len(wrist_speeds) < 3:
            return 78.0
        consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        score = float(np.clip(consistency * 1.05, 70, 98))
        return score

    def _compute_sub_scores(self, m: Dict) -> Dict:
        accuracy = int(np.clip(round(
            (self._normalize(m["placementScore"], 70.0, 98.0) * 0.5
             + self._normalize(m["racketAngle"], 15.0, 40.0) * 0.5) * 100
        ), 0, 100))

        technique = int(np.clip(round(
            (self._normalize(m["racketAngle"], 15.0, 40.0) * 0.5
             + self._normalize(m["shuttleSpeed"], 30.0, 100.0) * 0.5) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 70.0, 98.0) * 0.6
             + self._normalize(m["placementScore"], 70.0, 98.0) * 0.4) * 100
        ), 0, 100))

        timing = int(np.clip(round(
            self._normalize(m["rhythmConsistency"], 65.0, 95.0) * 100
        ), 0, 100))

        return {
            "accuracy": accuracy,
            "technique": technique,
            "consistency": consistency,
            "timing": timing,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["accuracy"] * 0.30
            + sub_scores["technique"] * 0.25
            + sub_scores["consistency"] * 0.25
            + sub_scores["timing"] * 0.20
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "serve")

    def _fallback_metrics(self) -> Dict:
        return {
            "racketAngle": 25.0,
            "shuttleSpeed": 55.0,
            "placementScore": 78.0,
            "shotConsistency": 72.0,
            "rhythmConsistency": 72.0,
        }
