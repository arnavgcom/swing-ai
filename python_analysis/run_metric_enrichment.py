#!/usr/bin/env python3
import argparse
import json
import os
import sys
import traceback
from typing import Any, Dict, List, Optional, Tuple

from python_analysis.analysis_artifact import load_analysis_artifact
from python_analysis.sports.registry import get_analyzer


def _normalize_frame_ranges(raw_ranges: Any) -> Optional[List[Tuple[int, int]]]:
    if not isinstance(raw_ranges, list):
        return None

    normalized: List[Tuple[int, int]] = []
    for item in raw_ranges:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            start = int(item[0])
            end = int(item[1])
        elif isinstance(item, dict):
            start = int(item.get("startFrame", item.get("start", 0)))
            end = int(item.get("endFrame", item.get("end", -1)))
        else:
            continue

        if end < start:
            continue
        normalized.append((max(0, start), max(0, end)))

    return normalized or None


def _normalize_shot_speed(metric_values: Dict[str, Any]) -> None:
    speed_keys = (
        "shotSpeed",
        "ballSpeed",
        "avgBallSpeed",
        "shuttleSpeed",
    )

    for key in speed_keys:
        raw_value = metric_values.get(key)
        if isinstance(raw_value, (int, float)) and float(raw_value) > 0:
            metric_values["shotSpeed"] = round(float(raw_value), 2)
            return


def main() -> None:
    parser = argparse.ArgumentParser(description="Swing AI async metric enrichment")
    parser.add_argument("video_path", help="Path to the source video file")
    parser.add_argument("--analysis-artifact", required=True, help="Path to the saved analysis artifact")
    parser.add_argument("--config-key", required=True, help="Analyzer config key such as tennis-forehand")
    args = parser.parse_args()

    try:
        if not os.path.exists(args.video_path):
            raise FileNotFoundError(f"Video does not exist: {args.video_path}")

        artifact = load_analysis_artifact(args.analysis_artifact)
        pose_data = artifact.get("poseData") if isinstance(artifact.get("poseData"), list) else None
        analysis_fps_mode = str(artifact.get("analysisFpsMode") or "step1")
        include_frame_ranges = _normalize_frame_ranges(artifact.get("frameRangesUsedForScoring"))

        analyzer = get_analyzer(args.config_key)
        try:
            result = analyzer.analyze_video(
                args.video_path,
                include_frame_ranges=include_frame_ranges,
                precomputed_pose_data=pose_data,
                analysis_fps_mode=analysis_fps_mode,
                metric_computation_mode="full",
            )
        finally:
            analyzer.close()

        metric_values = result.get("metricValues") if isinstance(result.get("metricValues"), dict) else {}
        _normalize_shot_speed(metric_values)

        print(json.dumps({
            "configKey": result.get("configKey"),
            "metricValues": metric_values,
        }))
        sys.exit(0)
    except Exception as exc:
        print(json.dumps({
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()