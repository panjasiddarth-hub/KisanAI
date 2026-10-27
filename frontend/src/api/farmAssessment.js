import { api } from './client';

export async function runFarmAssessment(farmId, { agents, environment, market } = {}) {
  const { data } = await api.post('/orchestrator/farm', { farmId, agents, environment, market });
  return data;
}
