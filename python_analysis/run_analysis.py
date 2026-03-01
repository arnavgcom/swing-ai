#!/usr/bin/env python3
import sys
import json
import argparse
import traceback


def main():
    parser = argparse.ArgumentParser(description="AceX AI Sport Analysis")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--sport", default="tennis", help="Sport name (e.g., tennis, golf)")
    parser.add_argument("--movement", default="forehand", help="Movement name (e.g., forehand, drive)")

    args = parser.parse_args()

    movement_aliases = {
        "iron-shot": "iron",
    }
    movement = args.movement.lower().replace(' ', '-').replace('_', '-')
    movement = movement_aliases.get(movement, movement)
    config_key = f"{args.sport.lower()}-{movement}"

    try:
        from python_analysis.sports.registry import get_analyzer

        analyzer = get_analyzer(config_key)
        result = analyzer.analyze_video(args.video_path)
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
