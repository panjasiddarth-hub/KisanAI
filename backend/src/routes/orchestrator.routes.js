import { Router } from 'express';

const router = Router();

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';


async function callML(endpoint, body) {
  const response = await fetch(
    `${ML_SERVICE_URL}${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `${endpoint} returned ${response.status}: ${errorText}`
    );
  }

  return response.json();
}


// ============================================================
// ORCHESTRATOR
// ============================================================

router.post('/', async (req, res, next) => {
  try {
    const input = req.body || {};

    console.log('Orchestrator request:', input);

    const results = {};

    // --------------------------------------------------------
    // 1. Crop Agent
    // --------------------------------------------------------

    if (input.crop) {
      try {
        results.crop = await callML(
          '/predict/crop',
          {
            N: Number(input.crop.N),
            P: Number(input.crop.P),
            K: Number(input.crop.K),
            temperature: Number(input.crop.temperature),
            humidity: Number(input.crop.humidity),
            ph: Number(input.crop.ph),
            rainfall: Number(input.crop.rainfall),
          }
        );
      } catch (error) {
        results.crop = {
          error: error.message,
        };
      }
    }


    // --------------------------------------------------------
    // 2. Fertilizer Agent
    // --------------------------------------------------------

    if (input.fertilizer) {
      try {
        results.fertilizer = await callML(
          '/predict/fertilizer',
          input.fertilizer
        );
      } catch (error) {
        results.fertilizer = {
          error: error.message,
        };
      }
    }


    // --------------------------------------------------------
    // 3. Market Agent
    // --------------------------------------------------------

    if (input.market) {
      try {
        results.market = await callML(
          '/predict/market',
          input.market
        );
      } catch (error) {
        results.market = {
          error: error.message,
        };
      }
    }


    // --------------------------------------------------------
    // 4. RAG Agent
    // --------------------------------------------------------

    if (input.question) {
      try {
        results.rag = await callML(
          '/predict/rag',
          {
            question: input.question,
            top_k: input.top_k || 3,
          }
        );
      } catch (error) {
        results.rag = {
          error: error.message,
        };
      }
    }


    // --------------------------------------------------------
    // Final orchestrator response
    // --------------------------------------------------------

    res.json({
      success: true,
      agentResults: results,
    });

  } catch (error) {
    next(error);
  }
});


export default router;