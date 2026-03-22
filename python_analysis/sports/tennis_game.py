import numpy as np
from typing import Dict, List, Optional
from python_analysis.base_analyzer import BaseAnalyzer
from python_analysis.pose_detector import PoseDetector


class TennisGameAnalyzer(BaseAnalyzer):
    config_key = "tennis-game"
    core_metric_keys = {
        "courtCoverage",
        "recoverySpeed",
        "avgBallSpeed",
        "shotVariety",
        "balanceScore",
        "shotConsistency",
        "rhythmConsistency",
    }

    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        fps = video_info["fps"]
        frame_h = video_info["frame_height"]
        frame_w = video_info["frame_width"]
        valid_poses = self._get_valid_poses(pose_data)

        if len(valid_poses) < 3:
            return self._fallback_metrics()

        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        balance_scores = self._calc_balance_scores(valid_poses)
        elbow_angles = self._calc_elbow_angles(valid_poses)

        court_coverage = self._calc_court_coverage(pose_data, frame_w)
        recovery_speed = self._calc_recovery_speed(pose_data, fps, frame_h)
        shot_variety = self._calc_shot_variety(wrist_speeds, elbow_angles)
        rally_length = None
        if self._metric_requested("rallyLength"):
            rally_length = self._estimate_rally_length(pose_data, fps)

        ball_speed = self.ball_tracker.estimate_speed(fps, frame_h / 1.8)
        avg_ball_speed = float(np.clip(ball_speed, 40.0, 100.0)) if ball_speed > 0 else float(65.00)

        balance = float(np.clip(float(np.mean(balance_scores)) if balance_scores else 70.0, 40.0, 98.0))
        shot_consistency = self._calc_shot_consistency(elbow_angles, wrist_speeds)
        rhythm_consistency = self._calc_rhythm_consistency(pose_data, fps)

        metrics = {
            "courtCoverage": round(court_coverage, 2),
            "recoverySpeed": round(recovery_speed, 2),
            "avgBallSpeed": round(avg_ball_speed, 2),
            "shotVariety": round(shot_variety, 2),
            "balanceScore": round(balance, 2),
            "shotConsistency": round(shot_consistency, 2),
            "rhythmConsistency": round(rhythm_consistency, 2),
        }
        if rally_length is not None:
            metrics["rallyLength"] = round(rally_length, 1)
        return metrics

    def _calc_court_coverage(self, pose_data: List[Optional[Dict]], frame_w: int) -> float:
        positions_x = []
        for p in pose_data:
            if p is None:
                continue
            lh = p.get("left_hip")
            rh = p.get("right_hip")
            if lh and rh:
                mid_x = (lh["x"] + rh["x"]) / 2
                positions_x.append(mid_x)

        if len(positions_x) < 5:
            return 65.0

        x_range = max(positions_x) - min(positions_x)
        coverage = (x_range / frame_w) * 100
        return float(np.clip(coverage, 30, 98))

    def _calc_recovery_speed(self, pose_data: List[Optional[Dict]], fps: float, frame_h: int) -> float:
        hip_positions = []
        for p in pose_data:
            if p is None:
                hip_positions.append(None)
                continue
            lh = p.get("left_hip")
            rh = p.get("right_hip")
            if lh and rh:
                hip_positions.append(((lh["x"] + rh["x"]) / 2, (lh["y"] + rh["y"]) / 2))
            else:
                hip_positions.append(None)

        speeds = []
        dt = 1.0 / fps
        pixels_per_meter = frame_h / 1.8

        for i in range(1, len(hip_positions)):
            if hip_positions[i] is not None and hip_positions[i - 1] is not None:
                dx = hip_positions[i][0] - hip_positions[i - 1][0]
                dy = hip_positions[i][1] - hip_positions[i - 1][1]
                dist_m = np.sqrt(dx**2 + dy**2) / pixels_per_meter
                speed = dist_m / dt
                if 0.5 < speed < 8.0:
                    speeds.append(speed)

        if speeds:
            return float(np.clip(np.percentile(speeds, 75), 1.5, 6.0))
        return 3.0

    def _calc_shot_variety(self, wrist_speeds: List[float], elbow_angles: List[float]) -> float:
        if len(wrist_speeds) < 5 or len(elbow_angles) < 5:
            return 60.0

        speed_cv = float(np.std(wrist_speeds)) / float(np.mean(wrist_speeds)) if np.mean(wrist_speeds) > 0 else 0
        angle_cv = float(np.std(elbow_angles)) / float(np.mean(elbow_angles)) if np.mean(elbow_angles) > 0 else 0

        variety = (speed_cv + angle_cv) * 100
        return float(np.clip(variety, 30, 95))

    def _estimate_rally_length(self, pose_data: List[Optional[Dict]], fps: float) -> float:
        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        if len(wrist_speeds) < 10:
            return 5.0

        threshold = float(np.percentile(wrist_speeds, 80))
        swing_count = 0
        in_swing = False
        for s in wrist_speeds:
            if s > threshold and not in_swing:
                swing_count += 1
                in_swing = True
            elif s < threshold * 0.5:
                in_swing = False

        return float(np.clip(swing_count, 2, 20))

    def _compute_sub_scores(self, m: Dict) -> Dict:
        movement = int(np.clip(round(
            (self._normalize(m["courtCoverage"], 30, 98) * 0.5
             + self._normalize(m["recoverySpeed"], 1.5, 6.0) * 0.5) * 100
        ), 0, 100))

        shot_selection = int(np.clip(round(
            (self._normalize(m["shotVariety"], 30, 95) * 0.5
             + self._normalize(m["avgBallSpeed"], 40, 100) * 0.5) * 100
        ), 0, 100))

        consistency = int(np.clip(round(
            (self._normalize(m["shotConsistency"], 40, 98) * 0.5
             + self._normalize(m["rhythmConsistency"], 50, 98) * 0.5) * 100
        ), 0, 100))

        power = int(np.clip(round(
            (self._normalize(m["avgBallSpeed"], 40, 100) * 0.6
             + self._normalize(m["recoverySpeed"], 1.5, 6.0) * 0.4) * 100
        ), 0, 100))

        return {
            "movement": movement,
            "shotSelection": shot_selection,
            "consistency": consistency,
            "power": power,
        }

    def _compute_overall_score(self, sub_scores: Dict) -> int:
        score = round(
            sub_scores["movement"] * 0.25
            + sub_scores["shotSelection"] * 0.25
            + sub_scores["consistency"] * 0.25
            + sub_scores["power"] * 0.25
        )
        return int(np.clip(score, 0, 100))

    def _generate_coaching(self, m: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        return self._generate_default_coaching(overall_score, sub_scores, "game")

    def _fallback_metrics(self) -> Dict:
        return {
            "courtCoverage": 65.0,
            "recoverySpeed": 3.0,
            "avgBallSpeed": 65.0,
            "shotVariety": 60.0,
            "balanceScore": 70.0,
            "rallyLength": 5.0,
            "shotConsistency": 65.0,
            "rhythmConsistency": 70.0,
        }
