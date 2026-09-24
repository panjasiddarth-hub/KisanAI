from pathlib import Path
import joblib
import pandas as pd


MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "fertilizer.pkl"
)

_artifact = joblib.load(MODEL_PATH)

model = _artifact["model"]
encoder = _artifact["encoder"]
target_encoders = _artifact["target_encoders"]

CONTEXT_NUMERIC = _artifact["context_numeric"]
CONTEXT_CATEGORICAL = _artifact["context_categorical"]
VALUE_COLS = _artifact["value_cols"]
TARGET_COLS = _artifact["target_cols"]
NUTRIENTS = _artifact["nutrients"]


def predict_fertilizer(data: dict):

    # --------------------------------------------------
    # Build exact input structure used during training
    # --------------------------------------------------

    row = {}

    # Context numeric features
    for feature in CONTEXT_NUMERIC:
        row[feature] = float(data[feature])

    # Nutrient value features
    for feature in VALUE_COLS:
        row[feature] = float(data[feature])

    # Categorical features
    for feature in CONTEXT_CATEGORICAL:
        row[feature] = data[feature]

    X = pd.DataFrame([row])

    # --------------------------------------------------
    # Encode categorical features
    # --------------------------------------------------

    encoded = encoder.transform(
        X[CONTEXT_CATEGORICAL]
    )

    encoded_df = pd.DataFrame(
        encoded,
        columns=encoder.get_feature_names_out(
            CONTEXT_CATEGORICAL
        )
    )

    # --------------------------------------------------
    # Combine features in EXACT training order
    # --------------------------------------------------

    model_input = pd.concat(
        [
            X[CONTEXT_NUMERIC + VALUE_COLS].reset_index(drop=True),
            encoded_df.reset_index(drop=True)
        ],
        axis=1
    )

    # Reorder according to model's training feature names
    model_input = model_input[
        list(model.estimators_[0].feature_names_in_)
    ]

    # --------------------------------------------------
    # Predict nutrient ratings
    # --------------------------------------------------

    predictions = model.predict(model_input)[0]

    ratings = {}

    for nutrient, target, value in zip(
        NUTRIENTS,
        TARGET_COLS,
        predictions
    ):

        decoder = target_encoders[target]

        try:
            rating = decoder.inverse_transform(
                [value]
            )[0]
        except Exception:
            rating = str(value)

        ratings[nutrient] = rating

    return {
        "ratings": ratings,
        "modelSource": "fertilizer_multioutput_classifier"
    }