import os
from functools import lru_cache
from typing import Any, Dict, Optional

try:
    import joblib
except Exception:  # pragma: no cover - runtime fallback when sklearn stack is absent
    joblib = None


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "tennis_movement_classifier.joblib")
TENNIS_MOVEMENT_LABELS = ("forehand", "backhand", "serve", "volley", "unknown")


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