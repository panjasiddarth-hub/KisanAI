import { Router } from 'express';

const router = Router();

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

// Synthetic sample data for development and UI testing only.
// These values are NOT live mandi prices.
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

// Existing nearby market examples are retained.
// Verify distance, ratings and operating hours before production use.
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
    values.reduce((sum, value) => sum + value, 0) /
    values.length;

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

// Deterministic fallback derived from existing sample values.
// This is a demo reference price, not a live quote or forecast.
function getSyntheticPrice(lastPrices) {
  return Math.round(
    lastPrices.reduce((sum, value) => sum + value, 0) /
      lastPrices.length
  );
}

function buildPriceResponse(item, price, modelSource, isDemoData) {
  return {
    crop: item.crop,
    price,
    unit: '₹/quintal',
    market: item.market,
    quality: 'Standard',
    modelSource,
    isDemoData,
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayOfYear =
      Math.floor(
        (today.getTime() - startOfYear.getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;

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
              signal: AbortSignal.timeout(5000),
            }
          );

          if (!mlResponse.ok) {
            throw new Error(
              `ML service returned HTTP ${mlResponse.status}`
            );
          }

          const prediction = await mlResponse.json();
          const predictedPrice = Number(prediction.predicted_price);

          if (
            !Number.isFinite(predictedPrice) ||
            predictedPrice <= 0
          ) {
            throw new Error('ML service returned an invalid price');
          }

          return buildPriceResponse(
            item,
            predictedPrice,
            prediction.modelSource || 'ml_model',
            false
          );
        } catch (error) {
          console.warn(
            `Using synthetic demo price for ${item.crop}: ${error.message}`
          );

          return buildPriceResponse(
            item,
            getSyntheticPrice(item.lastPrices),
            'synthetic_demo',
            true
          );
        }
      })
    );

    res.json({
      dataMode: 'synthetic_demo',
      notice:
        'Demo prices only. These are not live mandi prices or verified selling-price recommendations.',
      prices,
      nearbyMarkets: NEARBY_MARKETS,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
