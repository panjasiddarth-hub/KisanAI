from pathlib import Path
import joblib
import pandas as pd


MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "crop_rec.pkl"

_artifact = joblib.load(MODEL_PATH)

model = _artifact["model"]
FEATURES = _artifact["features"]


def predict_crop(data: dict, top_k: int = 5):
    X = pd.DataFrame(
        [[data[feature] for feature in FEATURES]],
        columns=FEATURES
    )

    probabilities = model.predict_proba(X)[0]
    classes = model.classes_

    ranked = sorted(
        zip(classes, probabilities),
        key=lambda x: x[1],
        reverse=True
    )[:top_k]

    return {
        "prediction": ranked[0][0],
        "recommendations": [
            {
                "crop": crop,
                "score": round(float(score), 6)
            }
            for crop, score in ranked
        ]
    }