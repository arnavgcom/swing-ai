"""Bidirectional LSTM classifier for tennis movement classification.

Model architecture:
  Input  → (batch, SEQ_LEN, NUM_FEATURES)          [32 × 10]
  BiLSTM → 2 layers, hidden=128                     → (batch, SEQ_LEN, 256)
  Attention pool → weighted sum over timesteps       → (batch, 256)
  FC → dropout(0.3) → num_classes logits             → (batch, 5)

The attention mechanism lets the network focus on the most discriminative
frames of the swing (e.g. the contact point, peak backswing).
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import numpy as np

from python_analysis.temporal_features import (
    NUM_FEATURES,
    SEQ_LEN,
    extract_temporal_sequence,
    temporal_sequence_from_list,
)

# ---------- LABELS ----------------------------------------------------------
LABELS = ["forehand", "backhand", "serve", "volley", "unknown"]
LABEL_TO_IDX = {label: idx for idx, label in enumerate(LABELS)}

# ---------- Model paths -----------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_LSTM_MODEL_PATH = os.path.join(
    PROJECT_ROOT, "models", "tennis_movement_lstm.pt"
)


def resolve_lstm_model_path() -> str:
    override = str(
        os.environ.get("SWING_AI_LSTM_MODEL_PATH", "")
    ).strip()
    return override or DEFAULT_LSTM_MODEL_PATH


def lstm_is_available(model_path: Optional[str] = None) -> bool:
    resolved = model_path or resolve_lstm_model_path()
    if not os.path.exists(resolved):
        return False
    try:
        import torch  # noqa: F401
        return True
    except ImportError:
        return False


# ---------- PyTorch model definition ----------------------------------------
# Wrapped in a function so that the file can be imported even when torch is
# absent (the heuristic / RF-only path will be used instead).

def _build_model_class():
    import torch
    import torch.nn as nn

    class AttentionPool(nn.Module):
        def __init__(self, hidden_size: int):
            super().__init__()
            self.attn = nn.Linear(hidden_size, 1)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            # x: (batch, seq, hidden)
            weights = torch.softmax(self.attn(x), dim=1)  # (batch, seq, 1)
            return (x * weights).sum(dim=1)  # (batch, hidden)

    class MovementLSTM(nn.Module):
        def __init__(
            self,
            input_size: int = NUM_FEATURES,
            hidden_size: int = 64,
            num_layers: int = 2,
            num_classes: int = len(LABELS),
            dropout: float = 0.3,
        ):
            super().__init__()
            self.input_norm = nn.LayerNorm(input_size)
            self.lstm = nn.LSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
                bidirectional=True,
                dropout=dropout if num_layers > 1 else 0.0,
            )
            self.attention = AttentionPool(hidden_size * 2)
            self.dropout = nn.Dropout(dropout)
            self.fc = nn.Linear(hidden_size * 2, num_classes)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            # x: (batch, SEQ_LEN, NUM_FEATURES)
            x = self.input_norm(x)
            lstm_out, _ = self.lstm(x)  # (batch, seq, hidden*2)
            pooled = self.attention(lstm_out)  # (batch, hidden*2)
            pooled = self.dropout(pooled)
            return self.fc(pooled)  # (batch, num_classes)

    return MovementLSTM


# ---------- Model loading ---------------------------------------------------
_cached_model = None
_cached_model_path: Optional[str] = None


def load_lstm_model(model_path: Optional[str] = None):
    """Load the LSTM model from disk. Returns None if unavailable."""
    global _cached_model, _cached_model_path
    resolved = model_path or resolve_lstm_model_path()

    if _cached_model is not None and _cached_model_path == resolved:
        return _cached_model

    if not lstm_is_available(resolved):
        return None

    try:
        import torch
        MovementLSTM = _build_model_class()
        checkpoint = torch.load(resolved, map_location="cpu", weights_only=False)
        model = MovementLSTM(
            input_size=checkpoint.get("input_size", NUM_FEATURES),
            hidden_size=checkpoint.get("hidden_size", 64),
            num_layers=checkpoint.get("num_layers", 2),
            num_classes=checkpoint.get("num_classes", len(LABELS)),
        )
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        _cached_model = model
        _cached_model_path = resolved
        return model
    except Exception:
        return None


# ---------- Inference -------------------------------------------------------

def predict_lstm(
    pose_data: Optional[list] = None,
    temporal_sequence: Optional[np.ndarray] = None,
    fps: float = 30.0,
    frame_width: int = 1920,
    frame_height: int = 1080,
) -> Optional[Dict[str, Any]]:
    """Run LSTM inference on a single shot segment.

    Accepts either raw pose_data (will extract temporal features) or a
    pre-computed temporal_sequence ndarray of shape (SEQ_LEN, NUM_FEATURES).
    """
    model = load_lstm_model()
    if model is None:
        return None

    try:
        import torch

        if temporal_sequence is None:
            if pose_data is None:
                return None
            temporal_sequence = extract_temporal_sequence(
                pose_data, fps, frame_width, frame_height
            )

        x = torch.from_numpy(temporal_sequence).unsqueeze(0)  # (1, SEQ_LEN, F)
        with torch.no_grad():
            logits = model(x)
            probs = torch.softmax(logits, dim=-1).squeeze(0).numpy()

        probabilities = {
            label: float(probs[idx]) for idx, label in enumerate(LABELS)
        }
        label = max(probabilities, key=lambda k: probabilities[k])
        confidence = probabilities[label]
        sorted_probs = sorted(probabilities.values(), reverse=True)
        margin = confidence - (sorted_probs[1] if len(sorted_probs) > 1 else 0.0)

        return {
            "label": label,
            "confidence": confidence,
            "margin": margin,
            "probabilities": probabilities,
            "source": "lstm",
        }
    except Exception:
        return None


def predict_lstm_from_stored_sequence(
    sequence_data: List[List[float]],
) -> Optional[Dict[str, Any]]:
    """Predict from a stored JSON temporal sequence (e.g. from training DB)."""
    arr = temporal_sequence_from_list(sequence_data)
    return predict_lstm(temporal_sequence=arr)
