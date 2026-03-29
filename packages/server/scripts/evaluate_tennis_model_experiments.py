#!/usr/bin/env python3
import argparse
import csv
import io
import json
import os
import subprocess
from collections import Counter
from typing import Any, Dict, Iterable, List, Tuple

from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, VotingClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import GroupKFold, LeaveOneGroupOut, StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline

LABELS = ("forehand", "backhand", "serve", "volley")

CORE_FEATURES = [
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
]

EXTENDED_FEATURES = CORE_FEATURES + [
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
]


def _run_psql_copy(query: str) -> str:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL is required")

    command = [
        "psql",
        database_url,
        "-At",
        "-F",
        ",",
        "-c",
        f"copy ({query}) to stdout with csv header",
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return result.stdout


def _load_rows(dataset_id: str) -> List[Dict[str, Any]]:
    query = f"""
      select label, group_key, feature_values::text as feature_values
      from model_training_dataset_rows
      where dataset_id = '{dataset_id}'
      order by created_at, shot_index
    """
    raw_csv = _run_psql_copy(query)
    reader = csv.DictReader(io.StringIO(raw_csv))
    rows: List[Dict[str, Any]] = []
    for row in reader:
      label = str(row.get("label") or "").strip().lower()
      if label not in LABELS:
          continue
      feature_values = json.loads(row.get("feature_values") or "{}")
      rows.append(
          {
              "label": label,
              "group_key": str(row.get("group_key") or "unknown"),
              "feature_values": feature_values,
          }
      )
    return rows


def _latest_dataset_id() -> str:
    query = """
      select dataset_id
      from model_training_jobs
      where status = 'succeeded' and dataset_id is not null
      order by requested_at desc
      limit 1
    """
    raw_csv = _run_psql_copy(query)
    reader = csv.DictReader(io.StringIO(raw_csv))
    row = next(reader, None)
    if not row or not row.get("dataset_id"):
        raise SystemExit("No succeeded training dataset found")
    return str(row["dataset_id"])


def _coerce_feature_map(raw: Dict[str, Any], allowed_keys: Iterable[str] | None) -> Dict[str, Any]:
    allowed = set(allowed_keys) if allowed_keys else None
    result: Dict[str, Any] = {}
    for key, value in raw.items():
        if allowed is not None and key not in allowed:
            continue
        if value is None:
            continue
        if isinstance(value, bool):
            result[key] = 1.0 if value else 0.0
            continue
        if isinstance(value, (int, float)):
            result[key] = float(value)
            continue
        text = str(value).strip()
        if not text:
            continue
        lower = text.lower()
        if lower in {"true", "false"}:
            result[key] = 1.0 if lower == "true" else 0.0
            continue
        try:
            result[key] = float(text)
        except ValueError:
            result[key] = text
    return result


def _prepare_matrix(rows: List[Dict[str, Any]], feature_keys: Iterable[str] | None) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    samples: List[Dict[str, Any]] = []
    labels: List[str] = []
    groups: List[str] = []
    for row in rows:
        sample = _coerce_feature_map(row["feature_values"], feature_keys)
        if not sample:
            continue
        samples.append(sample)
        labels.append(row["label"])
        groups.append(row["group_key"])
    return samples, labels, groups


def _describe_features(samples: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
    feature_keys = sorted({key for sample in samples for key in sample.keys()})
    numeric_keys: List[str] = []
    categorical_keys: List[str] = []
    for key in feature_keys:
        values = [sample.get(key) for sample in samples if key in sample]
        if all(isinstance(value, (int, float)) for value in values):
            numeric_keys.append(key)
        else:
            categorical_keys.append(key)
    return numeric_keys, categorical_keys


def _evaluate(samples: List[Dict[str, Any]], labels: List[str], groups: List[str], name: str, model: Any, cv_name: str, cv: Any) -> Dict[str, Any]:
    numeric_keys, categorical_keys = _describe_features(samples)
    pipeline = Pipeline([
        ("vectorizer", DictVectorizer(sparse=False)),
        ("classifier", model),
    ])
    kwargs = {"X": samples, "y": labels, "cv": cv, "n_jobs": 1}
    if groups and (cv_name.startswith("group") or cv_name == "leave-one-group-out"):
        kwargs["groups"] = groups
    predictions = cross_val_predict(pipeline, **kwargs)
    macro_f1 = f1_score(labels, predictions, average="macro")
    weighted_f1 = f1_score(labels, predictions, average="weighted")
    report = classification_report(labels, predictions, digits=3, zero_division=0, output_dict=True)
    return {
        "model": name,
        "cv": cv_name,
        "macroF1": macro_f1,
        "weightedF1": weighted_f1,
        "featureCount": len(numeric_keys) + len(categorical_keys),
        "numericFeatureCount": len(numeric_keys),
        "categoricalFeatureCount": len(categorical_keys),
        "report": report,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate tennis movement model experiments")
    parser.add_argument("--dataset-id")
    args = parser.parse_args()

    dataset_id = args.dataset_id or _latest_dataset_id()
    rows = _load_rows(dataset_id)
    print(json.dumps({
        "datasetId": dataset_id,
        "rows": len(rows),
        "labelDistribution": Counter(row["label"] for row in rows),
        "groupCount": len({row["group_key"] for row in rows}),
    }, default=str, indent=2))

    experiments = {
        "rf_core": (CORE_FEATURES, RandomForestClassifier(n_estimators=600, max_depth=None, min_samples_leaf=1, class_weight="balanced_subsample", random_state=42, n_jobs=-1)),
        "rf_extended": (EXTENDED_FEATURES, RandomForestClassifier(n_estimators=800, max_depth=None, min_samples_leaf=1, class_weight="balanced_subsample", random_state=42, n_jobs=-1)),
        "et_core": (CORE_FEATURES, ExtraTreesClassifier(n_estimators=600, max_depth=None, min_samples_leaf=1, class_weight="balanced", random_state=42, n_jobs=-1)),
        "et_extended": (EXTENDED_FEATURES, ExtraTreesClassifier(n_estimators=800, max_depth=None, min_samples_leaf=1, class_weight="balanced", random_state=42, n_jobs=-1)),
        "vote_extended": (
            EXTENDED_FEATURES,
            VotingClassifier(
                estimators=[
                    ("rf", RandomForestClassifier(n_estimators=600, max_depth=None, min_samples_leaf=1, class_weight="balanced_subsample", random_state=42, n_jobs=-1)),
                    ("et", ExtraTreesClassifier(n_estimators=600, max_depth=None, min_samples_leaf=1, class_weight="balanced", random_state=42, n_jobs=-1)),
                ],
                voting="soft",
            ),
        ),
    }

    results: List[Dict[str, Any]] = []
    for name, (feature_keys, model) in experiments.items():
        samples, labels, groups = _prepare_matrix(rows, feature_keys)
        if len(set(labels)) < 2:
            continue
        unique_groups = len(set(groups))
        if unique_groups >= 2:
            group_splits = min(5, unique_groups)
            results.append(
                _evaluate(samples, labels, groups, name, model, f"group-{group_splits}fold", GroupKFold(n_splits=group_splits))
            )
            results.append(
                _evaluate(samples, labels, groups, name, model, "leave-one-group-out", LeaveOneGroupOut())
            )
        min_class = min(Counter(labels).values())
        if min_class >= 2:
            splits = min(5, min_class)
            results.append(
                _evaluate(samples, labels, groups, name, model, f"stratified-{splits}fold", StratifiedKFold(n_splits=splits, shuffle=True, random_state=42))
            )

    results.sort(key=lambda item: item["macroF1"], reverse=True)
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())