#!/usr/bin/env python3
"""Train a bidirectional LSTM classifier for tennis movement classification.

Usage:
  # From JSON via stdin (production — invoked by the server):
  echo '{"rows": [...]}' | python -m python_analysis.train_lstm_movement_model \
      --dataset-json-stdin --model-out models/tennis_movement_lstm.pt

  # From CSV file (manual / local testing):
  python -m python_analysis.train_lstm_movement_model \
      --dataset path/to/dataset.csv --model-out models/tennis_movement_lstm.pt

When rows include a "temporalSequence" field (a 32×10 matrix), the LSTM is
trained directly on those sequences. When absent, the training is skipped for
that row (LSTM requires temporal data).

Output:  JSON summary compatible with the existing training pipeline format.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from python_analysis.lstm_model import (
    DEFAULT_LSTM_MODEL_PATH,
    LABELS,
    LABEL_TO_IDX,
    _build_model_class,
)
from python_analysis.temporal_features import NUM_FEATURES, SEQ_LEN

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def _load_rows_from_json(payload: Dict[str, Any]) -> Tuple[
    List[np.ndarray], List[int], List[str], str
]:
    """Parse JSON payload → (sequences, label_indices, groups, dataset_path)."""
    rows = payload.get("rows") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise SystemExit("dataset rows missing from stdin payload")

    sequences: List[np.ndarray] = []
    label_indices: List[int] = []
    groups: List[str] = []
    dataset_path = str(
        payload.get("datasetPath")
        or payload.get("datasetReference")
        or "database://tennis-training-datasets/latest"
    )

    for raw in rows:
        if not isinstance(raw, dict):
            continue

        label = str(raw.get("label", "")).strip().lower()
        if label not in LABEL_TO_IDX:
            continue

        # Temporal sequence — required for LSTM training
        seq_data = raw.get("temporalSequence")
        if not isinstance(seq_data, list) or len(seq_data) == 0:
            continue

        try:
            arr = np.array(seq_data, dtype=np.float32)
            if arr.ndim != 2 or arr.shape[1] != NUM_FEATURES:
                continue
            # Resample to SEQ_LEN if needed
            if arr.shape[0] != SEQ_LEN:
                from python_analysis.temporal_features import _resample
                arr = _resample(arr, SEQ_LEN)
        except Exception:
            continue

        sequences.append(arr)
        label_indices.append(LABEL_TO_IDX[label])
        groups.append(str(raw.get("groupKey") or "unknown"))

    return sequences, label_indices, groups, dataset_path


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(
    sequences: List[np.ndarray],
    label_indices: List[int],
    model_out: str,
    epochs: int = 80,
    batch_size: int = 32,
    lr: float = 1e-3,
    hidden_size: int = 64,
    num_layers: int = 2,
    patience: int = 12,
) -> Dict[str, Any]:
    """Train the LSTM and save a checkpoint. Returns evaluation metrics."""
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset

    X = np.stack(sequences, axis=0)  # (N, SEQ_LEN, NUM_FEATURES)
    y = np.array(label_indices, dtype=np.int64)

    num_classes = len(LABELS)

    # Stratified 80/20 split
    from sklearn.model_selection import StratifiedKFold, train_test_split

    unique, counts = np.unique(y, return_counts=True)
    min_count = counts.min()

    if len(X) >= 30 and min_count >= 2:
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y,
        )
    else:
        # Too few samples for stratified split — use all for train, skip val
        X_train, y_train = X, y
        X_val, y_val = X[:1], y[:1]  # dummy

    # Class weights for imbalanced data
    class_counts = np.bincount(y_train, minlength=num_classes).astype(np.float32)
    class_counts = np.maximum(class_counts, 1.0)
    class_weights = 1.0 / class_counts
    class_weights = class_weights / class_weights.sum() * num_classes
    weight_tensor = torch.from_numpy(class_weights)

    train_dataset = TensorDataset(
        torch.from_numpy(X_train), torch.from_numpy(y_train),
    )
    val_dataset = TensorDataset(
        torch.from_numpy(X_val), torch.from_numpy(y_val),
    )
    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True, drop_last=False,
    )
    val_loader = DataLoader(
        val_dataset, batch_size=batch_size, shuffle=False,
    )

    MovementLSTM = _build_model_class()
    model = MovementLSTM(
        input_size=NUM_FEATURES,
        hidden_size=hidden_size,
        num_layers=num_layers,
        num_classes=num_classes,
    )

    criterion = nn.CrossEntropyLoss(weight=weight_tensor)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_f1 = -1.0
    best_state = None
    no_improve = 0

    for epoch in range(epochs):
        # --- Train ---
        model.train()
        for xb, yb in train_loader:
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
        scheduler.step()

        # --- Validate ---
        model.eval()
        all_preds = []
        all_labels = []
        with torch.no_grad():
            for xb, yb in val_loader:
                preds = model(xb).argmax(dim=-1)
                all_preds.extend(preds.numpy().tolist())
                all_labels.extend(yb.numpy().tolist())

        from sklearn.metrics import f1_score
        val_f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)

        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            no_improve = 0
        else:
            no_improve += 1

        if no_improve >= patience:
            break

    # Restore best model
    if best_state is not None:
        model.load_state_dict(best_state)

    # Final evaluation on full data
    model.eval()
    X_all_tensor = torch.from_numpy(X)
    with torch.no_grad():
        all_logits = model(X_all_tensor)
        all_preds = all_logits.argmax(dim=-1).numpy()

    from sklearn.metrics import classification_report, confusion_matrix

    label_names = [LABELS[i] for i in sorted(set(y.tolist()) | set(all_preds.tolist()))]
    report = classification_report(
        y, all_preds, target_names=label_names, output_dict=True, zero_division=0,
    )
    matrix = confusion_matrix(y, all_preds).tolist()

    # Save checkpoint
    os.makedirs(os.path.dirname(model_out), exist_ok=True)
    checkpoint = {
        "model_state_dict": model.state_dict(),
        "input_size": NUM_FEATURES,
        "hidden_size": hidden_size,
        "num_layers": num_layers,
        "num_classes": num_classes,
        "labels": LABELS,
        "seq_len": SEQ_LEN,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "train_rows": len(X_train),
        "val_rows": len(X_val),
        "best_val_f1": best_val_f1,
        "epochs_trained": epoch + 1,
    }
    torch.save(checkpoint, model_out)

    return {
        "macroF1": report.get("macro avg", {}).get("f1-score"),
        "bestValF1": best_val_f1,
        "trainRows": len(X_train),
        "valRows": len(X_val),
        "epochsTrained": epoch + 1,
        "classificationReport": report,
        "confusionMatrix": matrix,
        "labels": label_names,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Train LSTM movement classifier")
    parser.add_argument("--model-out", default=DEFAULT_LSTM_MODEL_PATH)
    parser.add_argument("--metadata-out")
    parser.add_argument("--report-out")
    parser.add_argument("--dataset-json-stdin", action="store_true")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    if not args.dataset_json_stdin:
        raise SystemExit("LSTM training requires --dataset-json-stdin (temporal sequences from DB)")

    payload = json.loads(sys.stdin.read() or "{}")
    sequences, label_indices, groups, dataset_path = _load_rows_from_json(payload)

    if len(sequences) < 20:
        raise SystemExit(
            f"Need at least 20 rows with temporal sequences to train LSTM; found {len(sequences)}"
        )

    label_dist = dict(Counter(LABELS[i] for i in label_indices))

    result = train(
        sequences=sequences,
        label_indices=label_indices,
        model_out=args.model_out,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
    )

    metadata = {
        "modelType": "lstm",
        "modelVersion": "unsaved",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "datasetPath": dataset_path,
        "trainRows": result["trainRows"],
        "valRows": result["valRows"],
        "epochsTrained": result["epochsTrained"],
        "bestValF1": result["bestValF1"],
        "labelDistribution": label_dist,
        "labels": result["labels"],
    }

    report_payload = {
        "classificationReport": result["classificationReport"],
        "confusionMatrix": result["confusionMatrix"],
        "labels": result["labels"],
    }

    if args.metadata_out:
        with open(args.metadata_out, "w", encoding="utf-8") as handle:
            json.dump(metadata, handle, indent=2)

    if args.report_out:
        with open(args.report_out, "w", encoding="utf-8") as handle:
            json.dump(report_payload, handle, indent=2)

    print(json.dumps({
        "modelOut": args.model_out,
        "trainRows": result["trainRows"],
        "valRows": result["valRows"],
        "labels": label_dist,
        "macroF1": result["macroF1"],
        "bestValF1": result["bestValF1"],
        "metadata": metadata,
        "report": report_payload,
    }, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
