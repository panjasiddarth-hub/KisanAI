import { validateAgentInput } from './validationAgent.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const AGENT_ENDPOINTS = {
  crop: '/predict/crop',
  fertilizer: '/predict/fertilizer',
  market: '/predict/market',
  rag: '/predict/rag',
};

export function resolveWorkflowStatus(statuses, requestedCount = Object.keys(statuses).length) {
  const items = Object.values(statuses);
  const completed = items.filter((item) => item.status === 'completed').length;
  if (completed === requestedCount) return 'completed';
  if (completed > 0) return 'partial';
  if (items.some((item) => item.status === 'needs_review')) return 'needs_review';
  if (items.some((item) => item.status === 'failed')) return 'failed';
  return 'needs_input';
}

export async function dispatchAgent(agent, input) {
  const endpoint = AGENT_ENDPOINTS[agent];
  if (!endpoint) return { input, error: `Unknown or unavailable agent: ${agent}` };

  const preflightIssues = validateAgentInput(agent, input);
  if (preflightIssues.length) {
    return {
      input,
      error: `Validation blocked request: ${preflightIssues.join('; ')}`,
      preflightIssues,
    };
  }

  try {
    const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = Array.isArray(payload.detail)
        ? payload.detail.map((item) => `${item.loc?.at(-1) || 'input'}: ${item.msg}`).join('; ')
        : payload.detail || payload.error;
      return { input, error: detail || `${endpoint} returned ${response.status}` };
    }
    return { input, result: payload };
  } catch (error) {
    return { input, error: `ML service unavailable: ${error.message}` };
  }
}
