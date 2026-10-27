"""Exercise the available prediction functions with synthetic contract samples.

This checks that artifacts load and return structurally valid outputs. It does
not measure model accuracy or validate these synthetic values for farm use.
"""

from importlib.metadata import PackageNotFoundError, version
import math
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.crop import predict_crop
from services.fertilizer import predict_fertilizer
from services.market import predict_market


def installed_version(package: str) -> str:
    try:
        return version(package)
    except PackageNotFoundError:
        return "not installed"


def check_crop() -> None:
    result = predict_crop(
        {
            "N": 90,
            "P": 42,
            "K": 43,
            "temperature": 25.5,
            "humidity": 80,
            "ph": 6.5,
            "rainfall": 200,
        }
    )
    recommendations = result["recommendations"]
    assert len(recommendations) == 3, "crop model did not return three recommendations"
    assert [item["rank"] for item in recommendations] == [1, 2, 3]
    assert all(math.isfinite(item["confidence"]) for item in recommendations)
    assert result["prediction"] == recommendations[0]["crop"]
    print(f"OK crop: top result {result['prediction']}; 3 ranked outputs")


def check_fertilizer() -> None:
    result = predict_fertilizer(
        {
            "pH": 6.5,
            "EC_dS_per_m": 0.5,
            "OC_percent": 0.7,
            "N_kg_per_ha": 100,
            "P_kg_per_ha": 40,
            "K_kg_per_ha": 80,
            "S_ppm": 15,
            "Zn_ppm": 1.2,
            "B_ppm": 0.5,
            "Fe_ppm": 5,
            "Cu_ppm": 1,
            "Mn_ppm": 3,
            "Soil_Type": "Alluvial",
            "Season": "Kharif",
        }
    )
    expected = {"N", "P", "K", "S", "Zn", "B", "Fe", "Cu", "Mn"}
    assert set(result["ratings"]) == expected, "fertilizer model returned unexpected nutrients"
    allowed = {"Low", "Medium", "High"}
    assert set(result["ratings"].values()) <= allowed, "fertilizer model returned unknown rating"
    print("OK fertilizer: nine nutrient ratings returned")


def check_market() -> None:
    result = predict_market(
        {
            "lag_1": 2000,
            "lag_2": 1950,
            "lag_3": 2050,
            "rolling_mean_3": 2000,
            "rolling_std_3": 50,
            "month": 7,
            "day_of_year": 190,
            "Commodity": "Bajra",
            "Market": "Akbarpur Mandi",
            "State": "Uttar Pradesh",
        }
    )
    assert math.isfinite(result["predicted_price"]) and result["predicted_price"] > 0
    assert result["Commodity"] == "Bajra"
    print(f"OK market: positive finite forecast {result['predicted_price']}")


def main() -> int:
    print(
        "Runtime versions: "
        f"Python {sys.version.split()[0]}, "
        f"scikit-learn {installed_version('scikit-learn')}, "
        f"XGBoost {installed_version('xgboost')}"
    )
    if installed_version("scikit-learn") != "1.6.1":
        print("WARNING: runtime does not match pinned scikit-learn 1.6.1")
    xgboost_version = installed_version("xgboost")
    try:
        if xgboost_version != "not installed" and int(xgboost_version.split(".", 1)[0]) >= 3:
            print("WARNING: runtime XGBoost version is outside the declared <3.0 range")
    except ValueError:
        print(f"WARNING: could not compare XGBoost version {xgboost_version!r} with requirements")
    check_crop()
    check_fertilizer()
    check_market()
    print("Smoke checks passed; these checks do not establish model accuracy.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Smoke check failed: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1) from error
