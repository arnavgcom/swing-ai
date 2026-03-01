import cv2
import numpy as np
import math
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple
from .pose_detector import PoseDetector
from .ball_tracker import BallTracker


class BaseAnalyzer(ABC):
    config_key: str = "unknown"

    def __init__(self):
        self.pose_detector = PoseDetector()
        self.ball_tracker = BallTracker()

    def analyze_video(self, video_path: str) -> Dict:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = total_frames / fps

        pose_data: List[Optional[Dict]] = []
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            landmarks = self.pose_detector.detect(frame)
            pose_data.append(landmarks)

            self.ball_tracker.detect(frame, frame_idx)
            frame_idx += 1

        cap.release()

        video_info = {
            "fps": fps,
            "total_frames": total_frames,
            "frame_width": frame_width,
            "frame_height": frame_height,
            "duration": duration,
        }

        metrics = self._compute_metrics(pose_data, video_info)
        sub_scores = self._compute_sub_scores(metrics)
        overall_score = self._compute_overall_score(sub_scores)
        coaching = self._generate_coaching(metrics, sub_scores, overall_score)

        return {
            "configKey": self.config_key,
            "metricValues": metrics,
            "subScores": sub_scores,
            "overallScore": overall_score,
            "coaching": coaching,
        }

    @abstractmethod
    def _compute_metrics(self, pose_data: List[Optional[Dict]], video_info: Dict) -> Dict:
        pass

    @abstractmethod
    def _compute_sub_scores(self, metrics: Dict) -> Dict:
        pass

    @abstractmethod
    def _compute_overall_score(self, sub_scores: Dict) -> int:
        pass

    @abstractmethod
    def _generate_coaching(self, metrics: Dict, sub_scores: Dict, overall_score: int) -> Dict:
        pass

    def _get_valid_poses(self, pose_data: List[Optional[Dict]]) -> List[Dict]:
        return [p for p in pose_data if p is not None]

    def _calc_wrist_speeds(self, pose_data: List[Optional[Dict]], fps: float) -> List[float]:
        speeds = []
        dt = 1.0 / fps
        prev = None

        for p in pose_data:
            if p is None:
                prev = None
                continue
            wrist = p.get("right_wrist") or p.get("left_wrist")
            if wrist and wrist["visibility"] > 0.5:
                if prev is not None:
                    speed = PoseDetector.calc_velocity(prev, wrist, dt)
                    if speed > 0:
                        speeds.append(speed)
                prev = wrist
            else:
                prev = None

        return speeds

    def _calc_elbow_angles(self, poses: List[Dict]) -> List[float]:
        angles = []
        for p in poses:
            shoulder = p.get("right_shoulder")
            elbow = p.get("right_elbow")
            wrist = p.get("right_wrist")

            if (
                shoulder and elbow and wrist
                and shoulder["visibility"] > 0.4
                and elbow["visibility"] > 0.4
                and wrist["visibility"] > 0.4
            ):
                angle = PoseDetector.calc_angle(shoulder, elbow, wrist)
                if 30 < angle < 180:
                    angles.append(angle)

        if not angles:
            for p in poses:
                shoulder = p.get("left_shoulder")
                elbow = p.get("left_elbow")
                wrist = p.get("left_wrist")
                if (
                    shoulder and elbow and wrist
                    and shoulder["visibility"] > 0.4
                    and elbow["visibility"] > 0.4
                    and wrist["visibility"] > 0.4
                ):
                    angle = PoseDetector.calc_angle(shoulder, elbow, wrist)
                    if 30 < angle < 180:
                        angles.append(angle)

        return angles

    def _calc_shoulder_rotation(self, pose_data: List[Optional[Dict]], fps: float) -> List[float]:
        rotations = []
        dt = 1.0 / fps
        prev_angle = None

        for p in pose_data:
            if p is None:
                prev_angle = None
                continue

            ls = p.get("left_shoulder")
            rs = p.get("right_shoulder")
            if ls and rs and ls["visibility"] > 0.4 and rs["visibility"] > 0.4:
                dx = rs["x"] - ls["x"]
                dy = rs["y"] - ls["y"]
                angle = math.degrees(math.atan2(dy, dx))

                if prev_angle is not None:
                    angular_vel = abs(angle - prev_angle) / dt
                    if angular_vel < 2000:
                        rotations.append(angular_vel)

                prev_angle = angle
            else:
                prev_angle = None

        return rotations

    def _calc_hip_rotation(self, pose_data: List[Optional[Dict]], fps: float) -> List[float]:
        rotations = []
        dt = 1.0 / fps
        prev_angle = None

        for p in pose_data:
            if p is None:
                prev_angle = None
                continue

            lh = p.get("left_hip")
            rh = p.get("right_hip")
            if lh and rh and lh["visibility"] > 0.4 and rh["visibility"] > 0.4:
                dx = rh["x"] - lh["x"]
                dy = rh["y"] - lh["y"]
                angle = math.degrees(math.atan2(dy, dx))

                if prev_angle is not None:
                    angular_vel = abs(angle - prev_angle) / dt
                    if angular_vel < 2000:
                        rotations.append(angular_vel)

                prev_angle = angle
            else:
                prev_angle = None

        return rotations

    def _calc_balance_scores(self, poses: List[Dict]) -> List[float]:
        scores = []
        for p in poses:
            lh = p.get("left_hip")
            rh = p.get("right_hip")
            la = p.get("left_ankle")
            ra = p.get("right_ankle")

            if lh and rh and la and ra:
                hip_mid_x = (lh["x"] + rh["x"]) / 2
                ankle_mid_x = (la["x"] + ra["x"]) / 2

                hip_width = abs(lh["x"] - rh["x"])
                if hip_width > 0:
                    offset = abs(hip_mid_x - ankle_mid_x) / hip_width
                    score = max(0, 100 - offset * 80)
                    scores.append(score)

        return scores

    def _calc_contact_heights(self, poses: List[Dict], frame_h: int) -> List[float]:
        heights = []
        for p in poses:
            wrist = p.get("right_wrist") or p.get("left_wrist")
            ankle = p.get("right_ankle") or p.get("left_ankle")

            if wrist and ankle and wrist["visibility"] > 0.4:
                pixel_height = abs(ankle["y"] - wrist["y"])
                body_height_px = frame_h * 0.85
                real_height = (pixel_height / body_height_px) * 1.75
                if 0.3 < real_height < 1.8:
                    heights.append(real_height)

        return heights

    def _calc_head_stability(self, pose_data: List[Optional[Dict]], frame_h: int) -> float:
        nose_positions = []
        for p in pose_data:
            if p is None:
                continue
            nose = p.get("nose")
            if nose and nose["visibility"] > 0.5:
                nose_positions.append((nose["x"], nose["y"]))

        if len(nose_positions) < 5:
            return 75.0

        xs = [pos[0] for pos in nose_positions]
        ys = [pos[1] for pos in nose_positions]
        x_std = float(np.std(xs))
        y_std = float(np.std(ys))
        total_movement = (x_std + y_std) / frame_h
        score = max(0, 100 - total_movement * 500)
        return float(np.clip(score, 40, 98))

    def _calc_spine_angle(self, poses: List[Dict]) -> List[float]:
        angles = []
        for p in poses:
            ls = p.get("left_shoulder")
            rs = p.get("right_shoulder")
            lh = p.get("left_hip")
            rh = p.get("right_hip")

            if ls and rs and lh and rh:
                shoulder_mid = {"x": (ls["x"] + rs["x"]) / 2, "y": (ls["y"] + rs["y"]) / 2}
                hip_mid = {"x": (lh["x"] + rh["x"]) / 2, "y": (lh["y"] + rh["y"]) / 2}
                dx = shoulder_mid["x"] - hip_mid["x"]
                dy = hip_mid["y"] - shoulder_mid["y"]
                if dy > 0:
                    angle = math.degrees(math.atan2(abs(dx), dy))
                    if 0 < angle < 90:
                        angles.append(angle)

        return angles

    def _detect_swing_phases(self, pose_data: List[Optional[Dict]], fps: float) -> Dict[str, float]:
        wrist_xs = []
        for p in pose_data:
            if p is None:
                wrist_xs.append(None)
                continue
            w = p.get("right_wrist") or p.get("left_wrist")
            if w and w["visibility"] > 0.4:
                wrist_xs.append(w["x"])
            else:
                wrist_xs.append(None)

        valid_xs = [x for x in wrist_xs if x is not None]
        if len(valid_xs) < 10:
            return {
                "backswing": 0.50,
                "contact": 0.06,
                "follow_through": 0.60,
            }

        velocities = []
        for i in range(1, len(wrist_xs)):
            if wrist_xs[i] is not None and wrist_xs[i - 1] is not None:
                velocities.append(wrist_xs[i] - wrist_xs[i - 1])
            else:
                velocities.append(0)

        if not velocities:
            return {
                "backswing": 0.50,
                "contact": 0.06,
                "follow_through": 0.60,
            }

        peak_idx = int(np.argmax(np.abs(velocities)))
        total = len(velocities)

        backswing_frames = max(1, peak_idx)
        follow_frames = max(1, total - peak_idx)

        backswing_dur = np.clip(backswing_frames / fps, 0.2, 1.0)
        contact_timing = np.clip(3.0 / fps, 0.01, 0.15)
        follow_dur = np.clip(follow_frames / fps, 0.3, 1.2)

        return {
            "backswing": round(float(backswing_dur), 3),
            "contact": round(float(contact_timing), 3),
            "follow_through": round(float(follow_dur), 3),
        }

    def _calc_shot_consistency(self, elbow_angles: List[float], wrist_speeds: List[float]) -> float:
        scores = []
        if len(elbow_angles) > 2:
            std = float(np.std(elbow_angles))
            angle_consistency = max(0, 100 - std * 2)
            scores.append(angle_consistency)

        if len(wrist_speeds) > 2:
            mean_s = float(np.mean(wrist_speeds))
            if mean_s > 0:
                cv = float(np.std(wrist_speeds)) / mean_s
                speed_consistency = max(0, 100 - cv * 100)
                scores.append(speed_consistency)

        return float(np.mean(scores)) if scores else 65.0

    def _calc_rhythm_consistency(self, pose_data: List[Optional[Dict]], fps: float) -> float:
        wrist_speeds = self._calc_wrist_speeds(pose_data, fps)
        if len(wrist_speeds) < 5:
            return 70.0

        window = max(3, len(wrist_speeds) // 5)
        smoothed = np.convolve(wrist_speeds, np.ones(window) / window, mode="valid")

        if len(smoothed) < 2:
            return 70.0

        mean_val = float(np.mean(smoothed))
        if mean_val > 0:
            cv = float(np.std(smoothed)) / mean_val
            return float(np.clip(100 - cv * 80, 50, 98))

        return 70.0

    @staticmethod
    def _normalize(value: float, min_val: float, max_val: float) -> float:
        if max_val <= min_val:
            return 0.5
        return float(np.clip((value - min_val) / (max_val - min_val), 0.0, 1.0))

    def _generate_default_coaching(self, overall_score: int, sub_scores: Dict, sport_label: str) -> Dict:
        strengths = []
        improvements = []
        suggestions = []

        sorted_scores = sorted(sub_scores.items(), key=lambda x: x[1], reverse=True)

        for key, val in sorted_scores[:2]:
            if val >= 65:
                strengths.append(f"Your {key} score of {val}/100 shows strong performance in this area.")

        for key, val in sorted_scores[-2:]:
            if val < 70:
                improvements.append(f"Your {key} score of {val}/100 has room for improvement.")
                suggestions.append(f"Focus on drills targeting {key} to raise your overall performance.")

        if not strengths:
            strengths.append("Your overall technique shows a solid foundation with room for targeted improvements.")
        if not improvements:
            improvements.append("Your metrics are well-balanced. Focus on maintaining consistency across all areas.")
        if not suggestions:
            suggestions.append("Continue your current training regimen while focusing on match play to test your technique under pressure.")

        if overall_score >= 75:
            level = "This is an advanced level performance with strong fundamentals."
        elif overall_score >= 50:
            level = "Your technique shows intermediate level with clear areas for growth."
        else:
            level = "Your technique is developing. Focus on the suggested drills to build a stronger foundation."

        score_parts = ", ".join([f"{k}: {v}" for k, v in sub_scores.items()])
        simple_explanation = f"Your {sport_label} scored {overall_score}/100 overall. {level} {score_parts}."

        return {
            "keyStrength": " ".join(strengths),
            "improvementArea": " ".join(improvements),
            "trainingSuggestion": " ".join(suggestions),
            "simpleExplanation": simple_explanation,
        }

    def close(self):
        self.pose_detector.close()
