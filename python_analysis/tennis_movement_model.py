import json
import os
from functools import lru_cache
from typing import Any, Dict, Optional

try:
    import joblib
except Exception:  # pragma: no cover - runtime fallback when sklearn stack is absent
    joblib = None


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "tennis_movement_classifier.joblib")
METADATA_PATH = os.path.join(PROJECT_ROOT, "models", "tennis_movement_classifier_metadata.json")
TENNIS_MOVEMENT_LABELS = ("forehand", "backhand", "serve", "volley", "unknown")


def model_is_available() -> bool:
    return joblib is not None and os.path.exists(MODEL_PATH) and os.path.exists(METADATA_PATH)


@lru_cache(maxsize=1)
def load_tennis_movement_model() -> Optional[Dict[str, Any]]:
    if not model_is_available():
        return None

    try:
        pipeline = joblib.load(MODEL_PATH)
        with open(METADATA_PATH, "r", encoding="utf-8") as handle:
            metadata = json.load(handle)
        return {
            "pipeline": pipeline,
            "metadata": metadata,
        }
    except Exception:
        return None


def predict_tennis_movement(features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    bundle = load_tennis_movement_model()
    if bundle is None:
        return None

    pipeline = bundle["pipeline"]
    metadata = bundle.get("metadata", {})
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
            "modelVersion": metadata.get("modelVersion", "tennis-movement-v1"),
            "source": "model",
        }
    except Exception:
        return None