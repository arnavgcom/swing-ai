#!/usr/bin/env python3
"""Quick regression checks for tennis FH/BH classifier guardrails.

Run:
  PYTHONPATH=. .venv/bin/python scripts/check_tennis_classifier_regression.py
"""

from python_analysis.movement_classifier import _classify_tennis_forehand_backhand


def _run_case(name: str, features: dict, expected: str) -> bool:
    label, confidence, reasons = _classify_tennis_forehand_backhand(features)
    ok = label == expected
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: got={label} expected={expected} conf={confidence:.3f}")
    print(f"  reasons={reasons}")
    return ok


def main() -> int:
    cases = [
        (
            "backhand_cross_body_parity",
            {
                "dominant_side": "right",
                "dominant_side_confidence": 0.95,
                "max_rw_speed": 3.1,
                "max_lw_speed": 2.9,
                "swing_arc_ratio": 0.46,
                "is_cross_body": True,
                "is_compact_forward": False,
                "dominant_wrist_median_offset": -0.18,
                "dominant_wrist_opposite_ratio": 0.58,
                "dominant_wrist_same_ratio": 0.22,
                "shoulder_rotation_delta_deg": 14.0,
            },
            "backhand",
        ),
        (
            "backhand_cross_body_left_wrist_dominant",
            {
                "dominant_side": "right",
                "dominant_side_confidence": 0.95,
                "max_rw_speed": 2.2,
                "max_lw_speed": 3.8,
                "swing_arc_ratio": 0.42,
                "is_cross_body": True,
                "is_compact_forward": False,
                "dominant_wrist_median_offset": -0.20,
                "dominant_wrist_opposite_ratio": 0.66,
                "dominant_wrist_same_ratio": 0.20,
                "shoulder_rotation_delta_deg": 16.0,
            },
            "backhand",
        ),
        (
            "forehand_cross_body_followthrough",
            {
                "dominant_side": "right",
                "dominant_side_confidence": 0.95,
                "max_rw_speed": 5.5,
                "max_lw_speed": 3.6,
                "swing_arc_ratio": 0.52,
                "is_cross_body": True,
                "is_compact_forward": False,
                "dominant_wrist_median_offset": -0.12,
                "dominant_wrist_opposite_ratio": 0.46,
                "dominant_wrist_same_ratio": 0.32,
                "shoulder_rotation_delta_deg": -11.0,
            },
            "forehand",
        ),
    ]

    results = [_run_case(name, features, expected) for name, features, expected in cases]
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"\nResult: {passed}/{total} passed")
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
