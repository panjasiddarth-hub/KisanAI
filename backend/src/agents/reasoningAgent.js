// backend/src/agents/reasoningAgent.js

export function reasonAboutFarm(agentResults) {
  const reasoning = [];

  // -------------------------
  // Crop reasoning
  // -------------------------
  if (agentResults.crop && !agentResults.crop.error) {
    const crop = agentResults.crop;

    reasoning.push({
      agent: "crop",
      observation: `The crop model recommends ${crop.prediction} as the top-ranked crop.`,
      evidence: crop.recommendations || [],
    });
  }

  // -------------------------
  // Market reasoning
  // -------------------------
  if (agentResults.market && !agentResults.market.error) {
    const market = agentResults.market;

    reasoning.push({
      agent: "market",
      observation:
        `The market forecasting model predicts a price of ₹${market.predicted_price} for ${market.Commodity} at ${market.Market}, ${market.State}.`,
      evidence: {
        commodity: market.Commodity,
        market: market.Market,
        state: market.State,
        predictedPrice: market.predicted_price,
      },
    });
  }

  // -------------------------
  // RAG reasoning
  // -------------------------
  if (agentResults.rag && !agentResults.rag.error) {
    const rag = agentResults.rag;

    reasoning.push({
      agent: "rag",
      observation:
        `The knowledge retrieval agent found ${rag.results?.length || 0} relevant government-scheme documents.`,
      evidence: rag.results || [],
    });
  }

  // -------------------------
  // Missing agents
  // -------------------------
  const availableAgents = Object.keys(agentResults).filter(
    (key) => agentResults[key] && !agentResults[key].error
  );

  const failedAgents = Object.keys(agentResults).filter(
    (key) => agentResults[key]?.error
  );

  return {
    summary:
      "Agricultural information has been combined from the available specialist agents.",
    reasoning,
    availableAgents,
    failedAgents,
    requiresValidation: true,
  };
}