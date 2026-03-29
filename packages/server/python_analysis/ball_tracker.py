import cv2
import numpy as np
from typing import List, Optional, Tuple


class BallTracker:
    def __init__(self):
        self.lower_green = np.array([25, 50, 50])
        self.upper_green = np.array([85, 255, 255])
        self.lower_yellow = np.array([18, 80, 80])
        self.upper_yellow = np.array([45, 255, 255])
        self.positions: List[Tuple[float, float]] = []
        self.frame_indices: List[int] = []

    def detect(self, frame: np.ndarray, frame_idx: int) -> Optional[Tuple[float, float]]:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        mask_green = cv2.inRange(hsv, self.lower_green, self.upper_green)
        mask_yellow = cv2.inRange(hsv, self.lower_yellow, self.upper_yellow)
        mask = cv2.bitwise_or(mask_green, mask_yellow)

        mask = cv2.erode(mask, None, iterations=2)
        mask = cv2.dilate(mask, None, iterations=2)
        mask = cv2.GaussianBlur(mask, (5, 5), 0)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        best = None
        best_score = 0

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 50 or area > 8000:
                continue

            perimeter = cv2.arcLength(cnt, True)
            if perimeter == 0:
                continue
            circularity = 4 * np.pi * area / (perimeter * perimeter)

            if circularity < 0.4:
                continue

            score = circularity * area
            if score > best_score:
                best_score = score
                M = cv2.moments(cnt)
                if M["m00"] > 0:
                    cx = M["m10"] / M["m00"]
                    cy = M["m01"] / M["m00"]
                    best = (cx, cy)

        if best:
            self.positions.append(best)
            self.frame_indices.append(frame_idx)

        return best

    def estimate_speed(self, fps: float, pixels_per_meter: float = 200.0) -> float:
        if len(self.positions) < 2:
            return 0.0

        speeds = []
        for i in range(1, len(self.positions)):
            dx = self.positions[i][0] - self.positions[i - 1][0]
            dy = self.positions[i][1] - self.positions[i - 1][1]
            dist_px = np.sqrt(dx**2 + dy**2)
            dist_m = dist_px / pixels_per_meter
            dt = (self.frame_indices[i] - self.frame_indices[i - 1]) / fps
            if dt > 0:
                speed_ms = dist_m / dt
                speed_mph = speed_ms * 2.237
                if 5 < speed_mph < 150:
                    speeds.append(speed_mph)

        return float(np.percentile(speeds, 90)) if speeds else 0.0

    def estimate_trajectory_arc(self) -> float:
        if len(self.positions) < 5:
            return 0.0

        ys = [p[1] for p in self.positions]
        xs = list(range(len(ys)))

        if len(xs) >= 3:
            coeffs = np.polyfit(xs, ys, 2)
            arc_degree = abs(float(np.degrees(np.arctan(2 * coeffs[0]))))
            return min(arc_degree, 45.0)
        return 0.0

    def estimate_spin(self, fps: float) -> float:
        if len(self.positions) < 5:
            return 0.0

        deviations = []
        for i in range(2, len(self.positions)):
            p0 = np.array(self.positions[i - 2])
            p1 = np.array(self.positions[i - 1])
            p2 = np.array(self.positions[i])

            expected = p1 + (p1 - p0)
            deviation = np.linalg.norm(p2 - expected)
            deviations.append(deviation)

        avg_dev = np.mean(deviations) if deviations else 0
        spin_rpm = float(avg_dev * fps * 2.5)
        return np.clip(spin_rpm, 400, 3500)

    def reset(self):
        self.positions = []
        self.frame_indices = []
