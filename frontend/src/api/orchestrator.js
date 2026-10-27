import { api } from './client';

export async function runOrchestratedAgent(agent, input, context = undefined) {
  const payload = { [agent]: input };
  if (context) payload.cropContext = context;
  const { data } = await api.post('/orchestrator', payload);
  const result = data.agentResults?.[agent];
  if (!data.success || result?.error) {
    const issues = data.orchestration?.validation?.checks
      ?.find((check) => check.agent === agent)?.issues;
    throw new Error(result?.error || issues?.join('; ') || `The ${agent} agent could not complete this request.`);
  }

  const explanation = data.orchestration?.explanations?.find((item) => item.agent === agent);
  return {
    ...result,
    explanation: explanation?.statement || 'The result passed the orchestrator’s structural validation.',
    explanationSource: 'orchestrator_evidence',
    contextReview: explanation?.contextReview || null,
    orchestration: data.orchestration,
  };
}
