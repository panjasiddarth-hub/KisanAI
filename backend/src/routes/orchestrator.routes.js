import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { enforceAgentValidation, reviewCropContext, validateAgentRun } from '../agents/validationAgent.js';
import { aiAnswerFromSources } from '../agents/gemini.js';
import { dispatchAgent, resolveWorkflowStatus } from '../agents/orchestratorService.js';
import { buildFarmAgentPlan } from '../agents/farmAssessment.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateAgentInput } from '../agents/validationAgent.js';
import { farms } from '../database/repositories/store.js';
import { CROPS } from '../data/crops.js';
import { annotateCalendarSupport } from '../utils/cropCalendarSupport.js';

const router = Router();
router.use(requireAuth);
router.use(createRateLimiter({ name: 'orchestrator', windowMs: 15 * 60 * 1000, limit: 30 }));

router.post('/farm', async (req, res, next) => {
  try {
    const { farmId, environment, market } = req.body || {};
    const requested = req.body?.agents ?? ['crop', 'fertilizer'];
    if (typeof farmId !== 'string' || !farmId.trim() || farmId.length > 64) {
      return res.status(400).json({ success: false, error: 'Choose a saved farm to assess.' });
    }
    if (!Array.isArray(requested) || requested.length < 1 || requested.length > 3
      || requested.some((agent) => !['crop', 'fertilizer', 'market'].includes(agent))
      || new Set(requested).size !== requested.length) {
      return res.status(400).json({
        success: false,
        error: 'Select one or more supported agents: crop, fertilizer, or market.',
        unavailableAgents: { disease: 'Disease photo screening runs separately and is not included in this farm-profile assessment.' },
      });
    }
    if (environment !== undefined && (!environment || typeof environment !== 'object' || Array.isArray(environment))) {
      return res.status(400).json({ success: false, error: 'Environment readings must be a JSON object.' });
    }
    if (market !== undefined && (!market || typeof market !== 'object' || Array.isArray(market))) {
      return res.status(400).json({ success: false, error: 'Market history must be a JSON object.' });
    }

    const farm = await farms.get(req.user.id, farmId.trim());
    if (!farm) return res.status(404).json({ success: false, error: 'Saved farm not found.' });
    const plan = buildFarmAgentPlan(farm, { agents: requested, environment, market });
    const entries = await Promise.all(Object.entries(plan.inputs).map(async ([agent, agentInput]) => [
      agent,
      await dispatchAgent(agent, agentInput),
    ]));
    const agentRuns = Object.fromEntries(entries);
    const modelValidation = validateAgentRun(agentRuns);
    const validatedRuns = enforceAgentValidation(agentRuns, modelValidation);
    const checks = [...modelValidation.checks];
    for (const [agent, missing] of Object.entries(plan.needsInput)) {
      checks.push({
        agent,
        status: 'needs_input',
        issues: missing.missingInputs,
        message: missing.message,
        checked: ['saved farm profile', 'required model inputs'],
      });
    }
    const validation = {
      ...modelValidation,
      status: checks.some((check) => check.status === 'needs_review')
        ? 'needs_review'
        : checks.some((check) => check.status === 'failed') ? 'failed'
          : checks.some((check) => check.status === 'needs_input') ? 'needs_input' : 'passed',
      checks,
    };
    const cropContextReview = validatedRuns.crop && !validatedRuns.crop.error
      ? reviewCropContext(validatedRuns.crop.input, {
        farm,
        inputSources: plan.inputSources,
      })
      : null;
    const explanations = explainResults(validatedRuns, cropContextReview, plan.inputSources);
    const statuses = Object.fromEntries(requested.map((agent) => {
      const run = validatedRuns[agent];
      if (plan.needsInput[agent]) return [agent, { status: 'needs_input', ...plan.needsInput[agent] }];
      const check = checks.find((item) => item.agent === agent);
      if (run?.error) return [agent, { status: check?.status || 'failed', error: run.error, issues: check?.issues || [] }];
      const explanation = explanations.find((item) => item.agent === agent);
      return [agent, { status: 'completed', result: run?.result, explanation }];
    }));
    const completed = Object.values(statuses).filter((item) => item.status === 'completed').length;
    const workflowStatus = resolveWorkflowStatus(statuses, requested.length);

    return res.json({
      success: completed > 0,
      farm: plan.farmContext,
      agents: statuses,
      orchestration: {
        workflowStatus,
        requestedAgents: requested,
        availableAgents: Object.entries(statuses).filter(([, item]) => item.status === 'completed').map(([agent]) => agent),
        needsInputAgents: Object.entries(statuses).filter(([, item]) => item.status === 'needs_input').map(([agent]) => agent),
        failedAgents: Object.entries(statuses).filter(([, item]) => ['failed', 'needs_review'].includes(item.status)).map(([agent]) => agent),
        validation,
        explanations,
        unavailableAgents: { disease: 'Disease image screening runs separately and is not included in this farm-profile assessment.' },
        limitations: [
          'Validation checks input and response structure; it does not establish agronomic correctness.',
          'Crop ranking uses only its seven listed model inputs. Farm context is provided for review, not used to alter the ranking.',
          'Market forecasting requires verified recent price history and its output units and horizon remain undocumented.',
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

function explainResults(runs, cropContextReview = null, inputSources = {}) {
  const explanations = [];
  for (const [agent, run] of Object.entries(runs)) {
    if (run.error) continue;
    const result = run.result;
    if (agent === 'crop') {
      explanations.push({
        agent,
        statement: `The crop classifier ranked ${result.prediction} first.`,
        evidence: result.recommendations,
        source: result.modelSource || 'trained crop model',
        contextReview: cropContextReview,
      });
    } else if (agent === 'fertilizer') {
      explanations.push({
        agent,
        statement: 'The soil model returned nutrient rating categories for the submitted soil test.',
        evidence: result.ratings,
        inputs: Object.entries(run.input || {}).map(([field, value]) => ({
          field,
          value,
          source: inputSources[field] || 'source not recorded',
        })),
        source: result.modelSource || 'trained soil nutrient model',
        caveat: 'Ratings are not fertilizer dose recommendations. The model does not provide per-result feature attribution, so this evidence list shows its inputs without claiming which one caused a rating.',
      });
    } else if (agent === 'market') {
      explanations.push({
        agent,
        statement: `The market model returned a price value of ${result.predicted_price} for ${result.Commodity} at ${result.Market}, ${result.State}.`,
        evidence: {
          commodity: result.Commodity,
          market: result.Market,
          state: result.State,
          modelSource: result.modelSource,
        },
        caveat: 'The model’s currency, quantity unit, and forecast horizon are undocumented. This uses supplied sample features, not a live quote.',
      });
    } else if (agent === 'rag') {
      explanations.push({
        agent,
        statement: `Knowledge retrieval returned ${result.results.length} source documents.`,
        evidence: result.results,
        source: 'FAISS semantic retrieval',
      });
    }
  }
  return explanations;
}

router.post('/', async (req, res) => {
  const input = req.body || {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return res.status(400).json({ success: false, error: 'Request body must be a JSON object.' });
  }
  const request = { ...input };
  if (request.question && !request.rag) request.rag = { question: request.question, top_k: request.top_k ?? 3 };
  const supportedAgents = ['crop', 'fertilizer', 'market', 'rag'];
  const requested = supportedAgents.filter((agent) => request[agent]);
  if (!requested.length) {
    return res.status(400).json({
      success: false,
      error: 'Provide at least one supported agent input: crop, fertilizer, market, or rag.',
      supportedAgents,
      unavailableAgents: { disease: 'Disease image screening runs separately and is not included in this farm-profile assessment.' },
    });
  }
  const invalidAgents = requested.flatMap((agent) => {
    const agentInput = agent === 'rag'
      ? { question: request.rag.question, top_k: request.rag.top_k ?? 3 }
      : request[agent];
    return validateAgentInput(agent, agentInput).map((issue) => `${agent}: ${issue}`);
  });
  if (invalidAgents.length) {
    return res.status(400).json({ success: false, error: 'Invalid agent input.', details: invalidAgents });
  }

  const entries = await Promise.all(requested.map(async (agent) => {
    const agentInput = agent === 'rag'
      ? { question: request.rag.question, top_k: request.rag.top_k ?? 3 }
      : request[agent];
    return [agent, await dispatchAgent(agent, agentInput)];
  }));
  const agentRuns = Object.fromEntries(entries);
  const validation = validateAgentRun(agentRuns);
  const validatedRuns = enforceAgentValidation(agentRuns, validation);
  let savedFarm = null;
  const farmId = request.cropContext?.farmId;
  if (validatedRuns.crop && !validatedRuns.crop.error && typeof farmId === 'string' && farmId.length <= 64) {
    savedFarm = await farms.get(req.user.id, farmId);
  }
  const cropContextReview = validatedRuns.crop && !validatedRuns.crop.error
    ? reviewCropContext(validatedRuns.crop.input, {
      farm: savedFarm,
      inputSources: request.cropContext?.inputSources,
    })
    : null;
  const explanations = explainResults(validatedRuns, cropContextReview);
  const ragResult = validatedRuns.rag?.result;
  const answer = ragResult?.results?.length
    ? await aiAnswerFromSources(request.question || request.rag.question, ragResult.results, request.language || 'English')
    : null;
  const availableAgents = Object.entries(validatedRuns).filter(([, run]) => !run.error).map(([agent]) => agent);
  const failedAgents = Object.entries(validatedRuns).filter(([, run]) => run.error).map(([agent]) => agent);
  const agentResults = Object.fromEntries(Object.entries(validatedRuns).map(([agent, run]) => [
    agent,
    run.error ? { error: run.error } : run.result,
  ]));
  if (agentResults.crop && !agentResults.crop.error) {
    agentResults.crop = annotateCalendarSupport(agentResults.crop, CROPS.map((crop) => crop.name));
  }

  return res.json({
    success: availableAgents.length > 0,
    agentResults,
    orchestration: {
      requestedAgents: requested,
      availableAgents,
      failedAgents,
      validation,
      explanations,
      answer: answer ? { text: answer, source: 'gemini_grounded_in_retrieved_documents' } : ragResult ? {
        text: ragResult.results?.length
          ? 'I found these reference documents, but cannot compose a grounded answer right now. Please review the cited excerpts.'
          : 'I could not find a relevant verified source for that question. Try asking about a Soil Health Card, PM-KISAN, e-NAM, or crop insurance, or check the linked official portals.',
        source: ragResult.results?.length ? 'retrieved_documents_only' : 'no_relevant_sources',
      } : null,
      unavailableAgents: { disease: 'Disease photo screening runs separately and is not included in this agent request.' },
    },
  });
});

export default router;
