from __future__ import annotations

from dataclasses import dataclass

import cv2
import mediapipe as mp
import numpy as np


def _angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Angle ABC in degrees, returning NaN for degenerate landmarks."""
    ba, bc = a - b, c - b
    denom = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denom < 1e-8:
        return float("nan")
    cosine = np.clip(np.dot(ba, bc) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cosine)))


def _summary(values: list[float], name: str) -> dict[str, float]:
    array = np.asarray(values, dtype=float)
    array = array[np.isfinite(array)]
    if array.size == 0:
        return {f"{name}_{suffix}": float("nan") for suffix in ("mean", "std", "min", "max", "rom")}
    return {
        f"{name}_mean": float(np.mean(array)),
        f"{name}_std": float(np.std(array)),
        f"{name}_min": float(np.min(array)),
        f"{name}_max": float(np.max(array)),
        f"{name}_rom": float(np.max(array) - np.min(array)),
    }


def _cadence_proxy(values: list[float], seconds_per_sample: float) -> float:
    """Dominant knee-angle frequency in cycles/minute; not a clinical cadence."""
    signal = np.asarray(values, dtype=float)
    signal = signal[np.isfinite(signal)]
    if signal.size < 8 or seconds_per_sample <= 0:
        return float("nan")
    signal = signal - np.mean(signal)
    spectrum = np.abs(np.fft.rfft(signal))
    frequencies = np.fft.rfftfreq(signal.size, d=seconds_per_sample)
    valid = (frequencies >= 0.25) & (frequencies <= 2.5)
    if not np.any(valid):
        return float("nan")
    return float(frequencies[valid][np.argmax(spectrum[valid])] * 60)


@dataclass
class PoseFeatureExtractor:
    sample_fps: float = 5.0
    min_visibility: float = 0.5

    def extract(self, video_path: str) -> dict[str, float]:
        capture = cv2.VideoCapture(video_path)
        fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        if fps <= 0 or not np.isfinite(fps):
            fps = 30.0
        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        stride = max(1, int(round(fps / self.sample_fps)))
        left_angles: list[float] = []
        right_angles: list[float] = []
        sampled = detected = 0

        pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.45,
            min_tracking_confidence=0.45,
        )
        try:
            frame_index = 0
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                if frame_index % stride:
                    frame_index += 1
                    continue
                frame_index += 1
                sampled += 1
                result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                if not result.pose_landmarks:
                    continue
                landmarks = result.pose_landmarks.landmark

                def point(index: int) -> np.ndarray:
                    value = landmarks[index]
                    return np.array([value.x, value.y], dtype=float)

                ids = mp.solutions.pose.PoseLandmark
                left_req = [ids.LEFT_HIP, ids.LEFT_KNEE, ids.LEFT_ANKLE]
                right_req = [ids.RIGHT_HIP, ids.RIGHT_KNEE, ids.RIGHT_ANKLE]
                left_ok = min(landmarks[i].visibility for i in left_req) >= self.min_visibility
                right_ok = min(landmarks[i].visibility for i in right_req) >= self.min_visibility

                if not (left_ok or right_ok):
                    continue
                detected += 1
                if left_ok:
                    left_angles.append(_angle(point(ids.LEFT_HIP), point(ids.LEFT_KNEE), point(ids.LEFT_ANKLE)))
                if right_ok:
                    right_angles.append(_angle(point(ids.RIGHT_HIP), point(ids.RIGHT_KNEE), point(ids.RIGHT_ANKLE)))
            if total_frames <= 0:
                total_frames = frame_index
        finally:
            pose.close()
            capture.release()

        seconds_per_sample = stride / fps
        result = {
            "video_fps": float(fps),
            "video_frames": float(total_frames),
            "sampled_frames": float(sampled),
            "pose_detection_rate": float(detected / sampled) if sampled else 0.0,
            **_summary(left_angles, "left_knee_angle"),
            **_summary(right_angles, "right_knee_angle"),
            "left_knee_frequency_cpm": _cadence_proxy(left_angles, seconds_per_sample),
            "right_knee_frequency_cpm": _cadence_proxy(right_angles, seconds_per_sample),
        }
        left_mean, right_mean = result["left_knee_angle_mean"], result["right_knee_angle_mean"]
        left_rom, right_rom = result["left_knee_angle_rom"], result["right_knee_angle_rom"]
        result["knee_angle_asymmetry"] = abs(left_mean - right_mean) if np.isfinite(left_mean + right_mean) else float("nan")
        result["knee_rom_asymmetry"] = abs(left_rom - right_rom) if np.isfinite(left_rom + right_rom) else float("nan")
        return result
