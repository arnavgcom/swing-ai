from __future__ import annotations

import os
import pickle
import tempfile
from typing import Any, Dict


ARTIFACT_VERSION = 1


def save_analysis_artifact(payload: Dict[str, Any]) -> str:
    fd, artifact_path = tempfile.mkstemp(prefix="swingai-analysis-artifact-", suffix=".pkl")
    os.close(fd)

    with open(artifact_path, "wb") as fh:
        pickle.dump(
            {
                "version": ARTIFACT_VERSION,
                **payload,
            },
            fh,
            protocol=pickle.HIGHEST_PROTOCOL,
        )

    return artifact_path


def load_analysis_artifact(artifact_path: str) -> Dict[str, Any]:
    with open(artifact_path, "rb") as fh:
        payload = pickle.load(fh)

    if not isinstance(payload, dict):
        raise ValueError("Invalid analysis artifact payload")

    version = int(payload.get("version", 0) or 0)
    if version != ARTIFACT_VERSION:
        raise ValueError(f"Unsupported analysis artifact version: {version}")

    return payload