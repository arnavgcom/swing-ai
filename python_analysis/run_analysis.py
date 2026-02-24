#!/usr/bin/env python3
import sys
import json
import traceback


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: run_analysis.py <video_path>"}))
        sys.exit(1)

    video_path = sys.argv[1]

    try:
        from python_analysis.analyzer import ForehandAnalyzer

        analyzer = ForehandAnalyzer()
        result = analyzer.analyze_video(video_path)
        analyzer.close()

        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        error_info = {
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
        print(json.dumps(error_info), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
