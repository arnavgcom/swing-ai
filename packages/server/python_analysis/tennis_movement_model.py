import os
from functools import lru_cache
from typing import Any, Dict, List, Optional

import numpy as np

try:
    import joblib
except Exception:  # pragma: no cover - runtime fallback when sklearn stack is absent
    joblib = None


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "tennis_movement_classifier.joblib")
TENNIS_MOVEMENT_LABELS = ("forehand", "backhand", "serve", "volley", "unknown")

# Ensemble weight for LSTM when both models are available.
# Read at call time from env (set by server from DB settings).
def _get_lstm_ensemble_weight() -> float:
    return float(os.environ.get("SWING_AI_LSTM_ENSEMBLE_WEIGHT", "0.85"))

def _is_lstm_enabled() -> bool:
    return os.environ.get("SWING_AI_LSTM_ENABLED", "1") != "0"


def resolve_tennis_movement_model_path() -> str:
    override = str(
        os.environ.get("SWING_AI_DRIVE_MOVEMENT_CLASSIFICATION_MODEL_PATH", "")
        or os.environ.get("SWING_AI_CLASSIFICATION_MODEL_PATH", "")
        or ""
    ).strip()
    return override or DEFAULT_MODEL_PATH


def resolve_tennis_movement_model_version(model_path: Optional[str] = None) -> Optional[str]:
    override = str(
        os.environ.get("SWING_AI_DRIVE_MOVEMENT_CLASSIFICATION_MODEL_VERSION", "")
        or os.environ.get("SWING_AI_CLASSIFICATION_MODEL_VERSION", "")
        or ""
    ).strip()
    if override:
        return override

    path_value = str(model_path or resolve_tennis_movement_model_path())
    filename = os.path.basename(path_value)
    if filename == os.path.basename(DEFAULT_MODEL_PATH):
        return None

    prefix = "tennis_movement_classifier_"
    suffix = ".joblib"
    if filename.startswith(prefix) and filename.endswith(suffix):
        version = filename[len(prefix):-len(suffix)]
        version = version[1:] if version.lower().startswith("v") else version
        return version or None

    return None


def model_is_available(model_path: Optional[str] = None) -> bool:
    resolved_path = str(model_path or resolve_tennis_movement_model_path())
    return joblib is not None and os.path.exists(resolved_path)


@lru_cache(maxsize=8)
def load_tennis_movement_model(model_path: str) -> Optional[Any]:
    if not model_is_available(model_path):
        return None

    try:
        return joblib.load(model_path)
    except Exception:
        return None


def predict_tennis_movement(features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    model_path = resolve_tennis_movement_model_path()
    pipeline = load_tennis_movement_model(model_path)
    if pipeline is None:
        return None

    try:
        probabilities_raw = pipeline.predict_proba([features])[0]
        classes = list(getattr(pipeline, "classes_", []))
        if not classes:
            classifier = getattr(pipeline, "named_steps", {}).get("classifier")
            classes = list(getattr(classifier, "classes_", [])) if classifier is not None else []

        probabilities = {
            str(label): float(probabilities_raw[index])
            for index, label in enumerate(classes)
        }
        if not probabilities:
            return None

        label = max(probabilities, key=probabilities.get)
        confidence = float(probabilities[label])
        sorted_probs = sorted(probabilities.values(), reverse=True)
        margin = confidence - (sorted_probs[1] if len(sorted_probs) > 1 else 0.0)

        return {
            "label": label,
            "confidence": confidence,
            "margin": float(margin),
            "probabilities": probabilities,
            "modelVersion": resolve_tennis_movement_model_version(model_path),
            "source": "model",
        }
    except Exception:
        return None


def predict_tennis_movement_ensemble(
    features: Dict[str, Any],
    segment_data: Optional[List[Optional[Dict]]] = None,
    fps: float = 30.0,
    frame_width: int = 1920,
    frame_height: int = 1080,
) -> Optional[Dict[str, Any]]:
    """Ensemble prediction combining RF and LSTM models.

    When both models are available, probabilities are combined as a weighted
    average (LSTM_ENSEMBLE_WEIGHT for LSTM, 1-weight for RF). When only one
    model is available, that model's prediction is returned directly.
    """
    rf_pred = predict_tennis_movement(features)

    lstm_pred = None
    if segment_data is not None and _is_lstm_enabled():
        try:
            from python_analysis.lstm_model import predict_lstm
            lstm_pred = predict_lstm(
                pose_data=segment_data,
                fps=fps,
                frame_width=frame_width,
                frame_height=frame_height,
            )
        except Exception:
            pass

    if rf_pred is None and lstm_pred is None:
        return None

    if rf_pred is not None and lstm_pred is None:
        return rf_pred

    if rf_pred is None and lstm_pred is not None:
        return lstm_pred

    # Both models available — weighted ensemble
    rf_probs = rf_pred.get("probabilities", {})
    lstm_probs = lstm_pred.get("probabilities", {})

    # If LSTM is highly confident, trust it alone (RF can only hurt)
    lstm_confidence = lstm_pred.get("confidence", 0.0)
    if lstm_confidence >= 0.75:
        return {**lstm_pred, "source": "lstm_gated"}

    all_labels = set(rf_probs.keys()) | set(lstm_probs.keys())
    w_lstm = _get_lstm_ensemble_weight()
    w_rf = 1.0 - w_lstm

    ensemble_probs = {}
    for lbl in all_labels:
        ensemble_probs[lbl] = (
            w_rf * rf_probs.get(lbl, 0.0)
            + w_lstm * lstm_probs.get(lbl, 0.0)
        )

    if not ensemble_probs:
        return rf_pred

    label = max(ensemble_probs, key=lambda k: ensemble_probs[k])
    confidence = float(ensemble_probs[label])
    sorted_p = sorted(ensemble_probs.values(), reverse=True)
    margin = confidence - (sorted_p[1] if len(sorted_p) > 1 else 0.0)

    return {
        "label": label,
        "confidence": confidence,
        "margin": float(margin),
        "probabilities": ensemble_probs,
        "modelVersion": resolve_tennis_movement_model_version(),
        "source": "ensemble",
        "rfLabel": rf_pred.get("label"),
        "rfConfidence": rf_pred.get("confidence"),
        "lstmLabel": lstm_pred.get("label"),
        "lstmConfidence": lstm_pred.get("confidence"),
    }