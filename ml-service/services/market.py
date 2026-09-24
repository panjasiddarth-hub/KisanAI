from pathlib import Path
from datetime import date

import joblib
import pandas as pd


MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "market_forecasting_model.pkl"
)

ENCODER_PATH = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "market_encoder.pkl"
)

model = joblib.load(MODEL_PATH)
encoder = joblib.load(ENCODER_PATH)


NUMERIC_FEATURES = [
    "lag_1",
    "lag_2",
    "lag_3",
    "rolling_mean_3",
    "rolling_std_3",
    "month",
    "day_of_year",
]

CATEGORICAL_FEATURES = [
    "Commodity",
    "Market",
    "State",
]


def predict_market(data: dict):
    # Create input row
    row = {
        "lag_1": float(data["lag_1"]),
        "lag_2": float(data["lag_2"]),
        "lag_3": float(data["lag_3"]),
        "rolling_mean_3": float(data["rolling_mean_3"]),
        "rolling_std_3": float(data["rolling_std_3"]),
        "month": int(data["month"]),
        "day_of_year": int(data["day_of_year"]),
        "Commodity": data["Commodity"],
        "Market": data["Market"],
        "State": data["State"],
    }

    input_df = pd.DataFrame([row])

    # One-hot encode categorical features
    encoded = encoder.transform(input_df[CATEGORICAL_FEATURES])

    encoded_df = pd.DataFrame(
        encoded,
        columns=encoder.get_feature_names_out(CATEGORICAL_FEATURES)
    )

    # Combine numeric + encoded categorical features
    model_input = pd.concat(
        [
            input_df[NUMERIC_FEATURES].reset_index(drop=True),
            encoded_df.reset_index(drop=True),
        ],
        axis=1,
    )

    # Force exact training feature order
    model_input = model_input[
        list(model.feature_names_in_)
    ]

    prediction = model.predict(model_input)[0]

    return {
        "predicted_price": round(float(prediction), 2),
        "Commodity": row["Commodity"],
        "Market": row["Market"],
        "State": row["State"],
        "modelSource": "market_xgboost"
    }