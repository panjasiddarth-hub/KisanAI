import unittest
from unittest.mock import patch

from services import market


class MarketOutputSafetyTests(unittest.TestCase):
    def test_rejects_non_positive_model_forecast(self):
        sample = {
            "lag_1": 2000, "lag_2": 1950, "lag_3": 2050,
            "rolling_mean_3": 2000, "rolling_std_3": 50,
            "month": 7, "day_of_year": 190,
            "Commodity": "Bajra", "Market": "Akbarpur Mandi", "State": "Uttar Pradesh",
        }
        with patch.object(market.model, "predict", return_value=[-1]):
            with self.assertRaises(market.InvalidMarketForecastError):
                market.predict_market(sample)


if __name__ == "__main__":
    unittest.main()
