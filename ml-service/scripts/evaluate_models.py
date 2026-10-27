"""Evaluate included models against farmer/reviewer supplied labeled datasets.

This script deliberately does not download or invent evaluation data. See the
script help and DEPLOYMENT_CHECKLIST.md for required CSV/image-folder schemas.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error, mean_squared_error
import xgboost as xgb

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.crop import FEATURES as CROP_FEATURES, model as crop_model
from services.fertilizer import (
    CONTEXT_CATEGORICAL,
    CONTEXT_NUMERIC,
    NUTRIENTS,
    TARGET_COLS,
    VALUE_COLS,
    encoder as fertilizer_encoder,
    model as fertilizer_model,
    target_encoders,
)
from services.market import CATEGORICAL_FEATURES, NUMERIC_FEATURES, encoder as market_encoder, model as market_model


def _load_csv(path: Path, required: list[str]) -> pd.DataFrame:
    frame = pd.read_csv(path)
    missing = sorted(set(required) - set(frame.columns))
    if frame.empty or missing:
        raise ValueError(f"{path}: expected a nonempty CSV containing columns {required}; missing {missing}")
    return frame.dropna(subset=required).reset_index(drop=True)


def _group_accuracy(frame: pd.DataFrame, predicted: np.ndarray, target: str, group: str | None) -> dict:
    result = {"accuracy": float(accuracy_score(frame[target], predicted)), "rows": len(frame)}
    if group and group in frame:
        result["by_group"] = {
            str(name): {"accuracy": float(accuracy_score(part[target], predicted[part.index])), "rows": len(part)}
            for name, part in frame.groupby(group)
        }
    return result


def evaluate_crop(path: Path) -> dict:
    frame = _load_csv(path, CROP_FEATURES + ["actual_crop"])
    predicted = crop_model.predict(frame[CROP_FEATURES])
    return {
        "rows": len(frame),
        "accuracy": float(accuracy_score(frame.actual_crop, predicted)),
        "classification_report": classification_report(frame.actual_crop, predicted, output_dict=True, zero_division=0),
        "by_state": _group_accuracy(frame, predicted, "actual_crop", "state"),
    }


def _fertilizer_input(frame: pd.DataFrame) -> pd.DataFrame:
    categorical = fertilizer_encoder.transform(frame[CONTEXT_CATEGORICAL])
    encoded = pd.DataFrame(categorical, columns=fertilizer_encoder.get_feature_names_out(CONTEXT_CATEGORICAL))
    raw = pd.concat([frame[CONTEXT_NUMERIC + VALUE_COLS].reset_index(drop=True), encoded], axis=1)
    return raw[list(fertilizer_model.estimators_[0].feature_names_in_)]


def evaluate_fertilizer(path: Path) -> dict:
    required = CONTEXT_NUMERIC + VALUE_COLS + CONTEXT_CATEGORICAL + TARGET_COLS
    frame = _load_csv(path, required)
    predicted = fertilizer_model.predict(_fertilizer_input(frame))
    metrics = {}
    for index, (nutrient, target) in enumerate(zip(NUTRIENTS, TARGET_COLS)):
        decoder = target_encoders[target]
        expected = frame[target].astype(str).to_numpy()
        actual = decoder.inverse_transform(predicted[:, index]).astype(str)
        metrics[nutrient] = {
            "accuracy": float(accuracy_score(expected, actual)),
            "rows": len(frame),
            "labels": classification_report(expected, actual, output_dict=True, zero_division=0),
        }
    return {"rows": len(frame), "per_nutrient": metrics}


def evaluate_market(path: Path) -> dict:
    target = "actual_price"
    date_column = "observation_date"
    required = NUMERIC_FEATURES + CATEGORICAL_FEATURES + [target, date_column]
    frame = _load_csv(path, required)
    frame[date_column] = pd.to_datetime(frame[date_column], errors="coerce")
    frame = frame.dropna(subset=[date_column]).sort_values(date_column).reset_index(drop=True)
    if len(frame) < 5:
        raise ValueError("Market evaluation needs at least five dated rows for a chronological holdout")
    holdout_start = max(1, int(len(frame) * 0.8))
    frame = frame.iloc[holdout_start:].reset_index(drop=True)
    encoded = market_encoder.transform(frame[CATEGORICAL_FEATURES])
    encoded_frame = pd.DataFrame(encoded, columns=market_encoder.get_feature_names_out(CATEGORICAL_FEATURES))
    model_input = pd.concat([frame[NUMERIC_FEATURES].reset_index(drop=True), encoded_frame], axis=1)
    model_input = model_input[list(market_model.feature_names)]
    predicted = market_model.predict(xgb.DMatrix(model_input))
    actual = frame[target].to_numpy(dtype=float)
    errors = predicted - actual
    result = {
        "rows": len(frame),
        "mae": float(mean_absolute_error(actual, predicted)),
        "rmse": float(np.sqrt(mean_squared_error(actual, predicted))),
        "bias": float(np.mean(errors)),
        "actual_price_unit": "MUST_BE_DOCUMENTED_BY_DATA_OWNER",
        "holdout": "last 20% of sorted observation_date rows",
        "holdout_start": frame[date_column].min().date().isoformat(),
    }
    if "state" in frame:
        result["by_state"] = {
            str(name): {"rows": len(group), "mae": float(mean_absolute_error(group[target], predicted[group.index]))}
            for name, group in frame.groupby("state")
        }
    return result


def evaluate_disease(root: Path) -> dict:
    from services.disease import CLASS_NAMES, load_disease_model
    from PIL import Image

    model = load_disease_model()
    actual, predicted = [], []
    for index, label in enumerate(CLASS_NAMES):
        folder = root / label
        if not folder.is_dir():
            continue
        for path in sorted(folder.iterdir()):
            if path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                continue
            with Image.open(path) as image:
                pixels = np.asarray(image.convert("RGB").resize((224, 224)), dtype=np.float32)[None, ...]
            predicted.append(int(np.argmax(model(pixels, training=False)[0])))
            actual.append(index)
    if not actual:
        raise ValueError(f"No labeled images found in class-named subfolders under {root}")
    return {
        "rows": len(actual),
        "accuracy": float(accuracy_score(actual, predicted)),
        "classification_report": classification_report(actual, predicted, labels=list(range(len(CLASS_NAMES))), target_names=CLASS_NAMES, output_dict=True, zero_division=0),
        "note": "Group split by farm/field and capture date before interpreting metrics; near-duplicate leakage inflates scores.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--crop-csv", type=Path, help="CSV with model features, actual_crop, and optional state")
    parser.add_argument("--fertilizer-csv", type=Path, help="CSV with fertilizer inputs and all nine target rating columns")
    parser.add_argument("--market-csv", type=Path, help="CSV with market inputs, actual_price, observation_date; last 20%% held out by date")
    parser.add_argument("--disease-dir", type=Path, help="Image root with one subfolder per exact class label")
    parser.add_argument("--output", type=Path, default=Path("evaluation-report.json"))
    args = parser.parse_args()
    report = {"generated_at": datetime.now(timezone.utc).isoformat(), "evaluations": {}}
    for name, path, evaluator in (
        ("crop", args.crop_csv, evaluate_crop),
        ("fertilizer", args.fertilizer_csv, evaluate_fertilizer),
        ("market", args.market_csv, evaluate_market),
        ("disease", args.disease_dir, evaluate_disease),
    ):
        if path:
            report["evaluations"][name] = evaluator(path)
    if not report["evaluations"]:
        parser.error("Supply at least one labeled dataset. No model quality metrics will be fabricated.")
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote evaluation results to {args.output.resolve()}")


if __name__ == "__main__":
    main()
