#!/usr/bin/env python3
import argparse
import csv
import json
import os
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.pipeline import Pipeline


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DATASET = os.path.join(PROJECT_ROOT, "model_evaluation_datasets", "tennis_movement_shots.csv")
DEFAULT_MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "tennis_movement_classifier.joblib")
DEFAULT_METADATA_PATH = os.path.join(PROJECT_ROOT, "models", "tennis_movement_classifier_metadata.json")
DEFAULT_REPORT_PATH = os.path.join(PROJECT_ROOT, "models", "tennis_movement_classifier_report.json")

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


def _coerce_value(value: str) -> Any:
    text = str(value or "").strip()
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


def _build_pipeline() -> Pipeline:
    return Pipeline([
        ("vectorizer", DictVectorizer(sparse=False)),
        (
            "classifier",
            RandomForestClassifier(
                n_estimators=320,
                max_depth=18,
                min_samples_leaf=2,
                class_weight="balanced_subsample",
                random_state=42,
                n_jobs=-1,
            ),
        ),
    ])


def main() -> int:
    parser = argparse.ArgumentParser(description="Train tennis movement classifier")
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--model-out", default=DEFAULT_MODEL_PATH)
    parser.add_argument("--metadata-out", default=DEFAULT_METADATA_PATH)
    parser.add_argument("--report-out", default=DEFAULT_REPORT_PATH)
    args = parser.parse_args()

    samples, labels, groups = _load_rows(args.dataset)
    if len(samples) < 20:
        raise SystemExit(f"Need at least 20 labeled shot rows to train; found {len(samples)}")

    unique_groups = len(set(groups))
    if unique_groups >= 4:
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        train_idx, test_idx = next(splitter.split(samples, labels, groups))
        train_x = [samples[i] for i in train_idx]
        train_y = [labels[i] for i in train_idx]
        test_x = [samples[i] for i in test_idx]
        test_y = [labels[i] for i in test_idx]
    else:
        train_x, test_x, train_y, test_y = train_test_split(
            samples,
            labels,
            test_size=0.2,
            random_state=42,
            stratify=labels if len(set(labels)) > 1 else None,
        )

    pipeline = _build_pipeline()
    pipeline.fit(train_x, train_y)
    predicted = pipeline.predict(test_x)

    label_order = list(getattr(pipeline.named_steps["classifier"], "classes_", []))
    report = classification_report(test_y, predicted, output_dict=True, zero_division=0)
    matrix = confusion_matrix(test_y, predicted, labels=label_order)

    os.makedirs(os.path.dirname(args.model_out), exist_ok=True)
    joblib.dump(pipeline, args.model_out)

    vectorizer = pipeline.named_steps["vectorizer"]
    metadata = {
        "modelVersion": "tennis-movement-v1",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "datasetPath": os.path.abspath(args.dataset),
        "trainRows": len(train_x),
        "testRows": len(test_x),
        "groupedSplit": unique_groups >= 4,
        "rawFeatureKeys": sorted({key for row in samples for key in row.keys()}),
        "vectorizedFeatureNames": list(getattr(vectorizer, "feature_names_", [])),
        "labelOrder": label_order,
        "labelDistribution": dict(Counter(labels)),
    }

    with open(args.metadata_out, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)

    with open(args.report_out, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "classificationReport": report,
                "confusionMatrix": matrix.tolist(),
                "labels": label_order,
            },
            handle,
            indent=2,
        )

    print(json.dumps({
        "modelOut": args.model_out,
        "metadataOut": args.metadata_out,
        "reportOut": args.report_out,
        "trainRows": len(train_x),
        "testRows": len(test_x),
        "labels": dict(Counter(labels)),
        "macroF1": report.get("macro avg", {}).get("f1-score"),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())