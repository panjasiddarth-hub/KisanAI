import { Router } from 'express';
import { dispatchAgent } from '../agents/orchestratorService.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(createRateLimiter({ name: 'market', windowMs: 15 * 60 * 1000, limit: 30 }));

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
          const run = await dispatchAgent('market', {
            ...historical,
            month,
            day_of_year: dayOfYear,
            Commodity: item.commodity,
            Market: item.market,
            State: item.state,
          });
          if (run.error) throw new Error(run.error);
          const prediction = run.result;

          return {
            crop: item.crop,
            price: prediction.predicted_price,
            unit: '₹/quintal',
            market: item.market,
            quality: 'Standard',
            modelSource: prediction.modelSource,
            inputSource: 'sample_historical_prices',
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
            inputSource: 'sample_historical_prices',
          };
        }
      })
    );

    res.json({
      prices,
      inputNotice: 'Forecast inputs are sample historical prices, not live mandi data.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
