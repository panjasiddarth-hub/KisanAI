import { Router } from 'express';

const router = Router();

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

// These values will temporarily provide the historical features
// required by the trained XGBoost model.
const MARKET_INPUTS = [
  {
    crop: 'Wheat',
    commodity: 'Wheat',
    market: 'Karnal Mandi',
    state: 'Haryana',
    lastPrices: [2350, 2320, 2280],
  },
  {
    crop: 'Onion',
    commodity: 'Onion',
    market: 'Niphad Mandi',
    state: 'Maharashtra',
    lastPrices: [1850, 1800, 1780],
  },
  {
    crop: 'Tomato',
    commodity: 'Tomato',
    market: 'Guntur Mandi',
    state: 'Andhra Pradesh',
    lastPrices: [2100, 2150, 2200],
  },
  {
    crop: 'Soybean',
    commodity: 'Soybean',
    market: 'Indore Mandi',
    state: 'Madhya Pradesh',
    lastPrices: [4800, 4750, 4700],
  },
  {
    crop: 'Cotton',
    commodity: 'Cotton',
    market: 'Nagpur Mandi',
    state: 'Maharashtra',
    lastPrices: [7200, 7150, 7100],
  },
];

const NEARBY_MARKETS = [
  {
    name: 'Nashik APMC',
    distance: '12 km',
    rating: 4.5,
    speciality: 'Grapes, Onion, Tomato',
    timing: '6 AM – 2 PM',
    days: 'Mon–Sat',
  },
  {
    name: 'Lasalgaon APMC',
    distance: '28 km',
    rating: 4.8,
    speciality: "Asia's largest onion market",
    timing: '5 AM – 12 PM',
    days: 'All days',
  },
  {
    name: 'Pune APMC (Gultekdi)',
    distance: '75 km',
    rating: 4.3,
    speciality: 'Vegetables, Fruits, Grains',
    timing: '4 AM – 10 AM',
    days: 'All days',
  },
  {
    name: 'Ahmednagar APMC',
    distance: '95 km',
    rating: 4.1,
    speciality: 'Sugarcane, Soybean',
    timing: '7 AM – 3 PM',
    days: 'Mon–Fri',
  },
];

function getMarketFeatures(lastPrices) {
  const [lag1, lag2, lag3] = lastPrices;

  const values = [lag1, lag2, lag3];

  const mean =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const variance =
    values.reduce(
      (sum, value) => sum + Math.pow(value - mean, 2),
      0
    ) / values.length;

  return {
    lag_1: lag1,
    lag_2: lag2,
    lag_3: lag3,
    rolling_mean_3: mean,
    rolling_std_3: Math.sqrt(variance),
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const today = new Date();

    const month = today.getMonth() + 1;

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayOfYear =
      Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24)) + 1;

    const prices = await Promise.all(
      MARKET_INPUTS.map(async (item) => {
        const historical = getMarketFeatures(item.lastPrices);

        try {
          const mlResponse = await fetch(
            `${ML_SERVICE_URL}/predict/market`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...historical,
                month,
                day_of_year: dayOfYear,
                Commodity: item.commodity,
                Market: item.market,
                State: item.state,
              }),
            }
          );

          if (!mlResponse.ok) {
            throw new Error(
              `ML service returned ${mlResponse.status}`
            );
          }

          const prediction = await mlResponse.json();

          return {
            crop: item.crop,
            price: prediction.predicted_price,
            unit: '₹/quintal',
            market: item.market,
            quality: 'Standard',
            modelSource: prediction.modelSource,
          };
        } catch (error) {
          console.error(
            `Market ML prediction failed for ${item.crop}:`,
            error.message
          );

          return {
            crop: item.crop,
            price: null,
            unit: '₹/quintal',
            market: item.market,
            quality: 'Standard',
            modelSource: 'unavailable',
          };
        }
      })
    );

    res.json({
      prices,
      nearbyMarkets: NEARBY_MARKETS,
    });
  } catch (error) {
    next(error);
  }
});

export default router;