#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import joblib
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import GroupKFold, StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "tennis_movement_classifier.joblib")

RESERVED_COLUMNS = {
    "analysis_id",
    "user_id",
    "video_filename",
    "shot_index",
    "label",
    "group_key",
    "heuristic_label",
    "heuristic_confidence",
    "heuristic_reasons",
}

SELECTED_FEATURE_KEYS = {
    "dominant_side",
    "dominant_side_confidence",
    "is_cross_body",
    "is_serve",
    "is_compact_forward",
    "is_overhead",
    "is_downward_motion",
    "max_wrist_speed",
    "max_rw_speed",
    "max_lw_speed",
    "swing_arc_ratio",
    "contact_height_ratio",
    "dominant_wrist_median_offset",
    "dominant_wrist_opposite_ratio",
    "dominant_wrist_same_ratio",
    "shoulder_rotation_delta_deg",
    "valid_pose_frames",
    "dominant_wrist_mean_speed",
    "dominant_wrist_speed_std",
    "dominant_wrist_speed_p90",
    "dominant_wrist_accel_p90",
    "peak_speed_frame_ratio",
    "dominant_wrist_horizontal_range_ratio",
    "dominant_wrist_vertical_range_ratio",
    "wrist_height_range",
    "peak_wrist_height_frame_ratio",
    "contact_height_std",
    "shoulder_rotation_range_deg",
    "shoulder_rotation_std_deg",
    "dominant_wrist_offset_std",
    "segment_frames",
    "segment_duration_sec",
    "valid_pose_frame_ratio",
    "wrist_speed_balance_ratio",
    "wrist_speed_gap",
    "arc_speed_product",
    "contact_arc_product",
    "serve_height_product",
    "overhead_contact_product",
    "shoulder_rotation_abs_deg",
}


def _coerce_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if text == "":
        return None
    lower = text.lower()
    if lower in {"true", "false"}:
        return 1.0 if lower == "true" else 0.0
    try:
        return float(text)
    except ValueError:
        return text


def _load_rows(csv_path: str) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    samples: List[Dict[str, Any]] = []
    labels: List[str] = []
    groups: List[str] = []
    with open(csv_path, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            label = str(raw.get("label", "")).strip().lower()
            if label not in {"forehand", "backhand", "serve", "volley", "unknown"}:
                continue

            feature_row: Dict[str, Any] = {}
            for key, value in raw.items():
                if key in RESERVED_COLUMNS:
                    continue
                if key not in SELECTED_FEATURE_KEYS:
                    continue
                coerced = _coerce_value(value)
                if coerced is None:
                    continue
                feature_row[key] = coerced

            if not feature_row:
                continue

            samples.append(feature_row)
            labels.append(label)
            groups.append(
                str(raw.get("user_id") or raw.get("analysis_id") or raw.get("video_filename") or "unknown")
            )

    return samples, labels, groups


def _load_rows_from_json_payload(payload: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str], List[str], str]:
    rows = payload.get("rows") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise SystemExit("dataset rows missing from stdin payload")

    samples: List[Dict[str, Any]] = []
    labels: List[str] = []
    groups: List[str] = []
    dataset_path = str(payload.get("datasetPath") or payload.get("datasetReference") or "database://tennis-training-datasets/latest")

    for raw in rows:
        if not isinstance(raw, dict):
            continue
        label = str(raw.get("label", "")).strip().lower()
        if label not in {"forehand", "backhand", "serve", "volley", "unknown"}:
            continue

        feature_values = raw.get("featureValues")
        if not isinstance(feature_values, dict):
            continue

        feature_row: Dict[str, Any] = {}
        for key, value in feature_values.items():
            if str(key) not in SELECTED_FEATURE_KEYS:
                continue
            coerced = _coerce_value(value)
            if coerced is None:
                continue
            feature_row[str(key)] = coerced

        if not feature_row:
            continue

        samples.append(feature_row)
        labels.append(label)
        groups.append(str(raw.get("groupKey") or "unknown"))

    return samples, labels, groups, dataset_path


def _build_pipeline() -> Pipeline:
    return Pipeline([
        ("vectorizer", DictVectorizer(sparse=False)),
        ("scaler", StandardScaler()),
        (
            "classifier",
            GradientBoostingClassifier(
                n_estimators=300,
                max_depth=4,
                min_samples_leaf=3,
                learning_rate=0.05,
                subsample=0.8,
                random_state=42,
            ),
        ),
    ])


def main() -> int:
    parser = argparse.ArgumentParser(description="Train tennis movement classifier")
    parser.add_argument("--dataset")
    parser.add_argument("--model-out", default=DEFAULT_MODEL_PATH)
    parser.add_argument("--metadata-out")
    parser.add_argument("--report-out")
    parser.add_argument("--dataset-json-stdin", action="store_true")
    args = parser.parse_args()

    if args.dataset_json_stdin:
        payload = json.loads(sys.stdin.read() or "{}")
        samples, labels, groups, dataset_path = _load_rows_from_json_payload(payload)
    else:
        if not args.dataset:
            raise SystemExit("Provide --dataset when not using --dataset-json-stdin")
        samples, labels, groups = _load_rows(args.dataset)
        dataset_path = os.path.abspath(args.dataset)

    if len(samples) < 20:
        raise SystemExit(f"Need at least 20 labeled shot rows to train; found {len(samples)}")

    unique_groups = len(set(groups))
    min_class_count = min(Counter(labels).values())
    evaluation_mode = "holdout"
    grouped_evaluation = False

    # Compute sample weights for class imbalance
    import numpy as np
    label_counts = Counter(labels)
    total = len(labels)
    num_classes = len(label_counts)
    class_weights = {cls: total / (num_classes * cnt) for cls, cnt in label_counts.items()}
    sample_weights = np.array([class_weights[label] for label in labels])

    if unique_groups >= 4:
        evaluation_mode = f"group-{unique_groups}fold"
        grouped_evaluation = True
        evaluation_pipeline = _build_pipeline()
        predicted = cross_val_predict(
            evaluation_pipeline,
            X=samples,
            y=labels,
            groups=groups,
            cv=GroupKFold(n_splits=unique_groups),
            n_jobs=1,
            params={"classifier__sample_weight": sample_weights},
        )
        train_x = samples
        train_y = labels
        test_x = samples
        test_y = labels
    elif min_class_count >= 2:
        splits = min(5, min_class_count)
        evaluation_mode = f"stratified-{splits}fold"
        evaluation_pipeline = _build_pipeline()
        predicted = cross_val_predict(
            evaluation_pipeline,
            X=samples,
            y=labels,
            cv=StratifiedKFold(n_splits=splits, shuffle=True, random_state=42),
            n_jobs=1,
            params={"classifier__sample_weight": sample_weights},
        )
        train_x = samples
        train_y = labels
        test_x = samples
        test_y = labels
    else:
        train_x, test_x, train_y, test_y, train_weights, _ = train_test_split(
            samples,
            labels,
            sample_weights,
            test_size=0.2,
            random_state=42,
            stratify=labels if len(set(labels)) > 1 else None,
        )

        pipeline = _build_pipeline()
        pipeline.fit(train_x, train_y, classifier__sample_weight=train_weights)
        predicted = pipeline.predict(test_x)

    pipeline = _build_pipeline()
    pipeline.fit(samples, labels, classifier__sample_weight=sample_weights)

    label_order = list(getattr(pipeline.named_steps["classifier"], "classes_", []))
    report = classification_report(test_y, predicted, output_dict=True, zero_division=0)
    matrix = confusion_matrix(test_y, predicted, labels=label_order)

    os.makedirs(os.path.dirname(args.model_out), exist_ok=True)
    joblib.dump(pipeline, args.model_out)

    vectorizer = pipeline.named_steps["vectorizer"]
    metadata = {
        "modelVersion": "unsaved",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "datasetPath": dataset_path,
        "trainRows": len(train_x),
        "testRows": len(test_x),
        "groupedSplit": grouped_evaluation,
        "evaluationMode": evaluation_mode,
        "groupCount": unique_groups,
        "rawFeatureKeys": sorted({key for row in samples for key in row.keys()}),
        "vectorizedFeatureNames": list(getattr(vectorizer, "feature_names_", [])),
        "labelOrder": label_order,
        "labelDistribution": dict(Counter(labels)),
    }

    report_payload = {
        "classificationReport": report,
        "confusionMatrix": matrix.tolist(),
        "labels": label_order,
    }

    if args.metadata_out:
        with open(args.metadata_out, "w", encoding="utf-8") as handle:
            json.dump(metadata, handle, indent=2)

    if args.report_out:
        with open(args.report_out, "w", encoding="utf-8") as handle:
            json.dump(report_payload, handle, indent=2)

    print(json.dumps({
        "modelOut": args.model_out,
        "trainRows": len(train_x),
        "testRows": len(test_x),
        "labels": dict(Counter(labels)),
        "macroF1": report.get("macro avg", {}).get("f1-score"),
        "metadata": metadata,
        "report": report_payload,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())