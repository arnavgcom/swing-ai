import json
import subprocess
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest_path = root / "model_evaluation_datasets" / "manifest.json"
manifest = json.loads(manifest_path.read_text())

videos = []
for dataset in manifest.get("datasets", []):
    if dataset.get("name") != "manual-annotations":
        continue
    for video in dataset.get("videos", []):
        videos.append(
            (
                video.get("videoId"),
                video.get("filename"),
                str(video.get("movementType") or "").strip().lower(),
            )
        )

python_exe = str(root / ".venv" / "bin" / "python")
rows = []

for video_id, filename, expected in videos:
    video_path = root / str(filename)
    if not video_path.exists():
        rows.append({
            "videoId": video_id,
            "file": filename,
            "expected": expected,
            "error": "missing_file",
        })
        continue

    cmd = [
        python_exe,
        "-m",
        "python_analysis.run_diagnostics",
        str(video_path),
        "--sport",
        "tennis",
        "--movement",
        "auto-detect",
        "--dominant-profile",
        "right",
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
    except subprocess.TimeoutExpired:
        rows.append({
            "videoId": video_id,
            "file": filename,
            "expected": expected,
            "error": "timeout",
        })
        continue

    if proc.returncode != 0:
        rows.append({
            "videoId": video_id,
            "file": filename,
            "expected": expected,
            "error": "nonzero_exit",
            "stderrTail": proc.stderr[-200:],
        })
        continue

    stdout = proc.stdout.strip()
    json_start = stdout.find("{")
    if json_start < 0:
        rows.append({
            "videoId": video_id,
            "file": filename,
            "expected": expected,
            "error": "json_not_found",
            "stdoutTail": stdout[-200:],
        })
        continue

    try:
        diagnostics = json.loads(stdout[json_start:])
    except Exception:
        rows.append({
            "videoId": video_id,
            "file": filename,
            "expected": expected,
            "error": "json_parse_error",
            "stdoutTail": stdout[-200:],
        })
        continue

    detected = str(diagnostics.get("detectedMovement") or "").strip().lower()
    shot_segments = diagnostics.get("shotSegments") or []
    labels = [str(s.get("label") or "unknown").lower() for s in shot_segments]
    counts = Counter(labels)

    rows.append({
        "videoId": video_id,
        "file": filename,
        "expected": expected,
        "detected": detected,
        "match": detected == expected,
        "shotCount": len(labels),
        "forehandShots": counts.get("forehand", 0),
        "backhandShots": counts.get("backhand", 0),
        "labels": labels,
    })

valid_rows = [row for row in rows if "error" not in row]
movement_matches = sum(1 for row in valid_rows if row.get("match"))
summary = {
    "totalVideos": len(rows),
    "validVideos": len(valid_rows),
    "movementMatches": movement_matches,
    "movementMismatches": len(valid_rows) - movement_matches,
    "movementAccuracyPct": round((movement_matches / len(valid_rows) * 100.0), 1) if valid_rows else 0.0,
}

print(json.dumps({"summary": summary, "rows": rows}, indent=2))
