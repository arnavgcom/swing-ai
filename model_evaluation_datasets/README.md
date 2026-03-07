# Model Evaluation Datasets

This folder stores the manifest for videos used in scoring model evaluation.

- Keep dataset entries immutable after a model version is released.
- Add new datasets by appending to `manifest.json`.
- `filename` must match `analyses.video_filename`.
- `movementType` is the expected movement label for movement detection accuracy.
