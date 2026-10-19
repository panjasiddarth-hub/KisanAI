// src/hooks/usePlotPlan.js — a plot's Cultivation Plan (/api/farms/:farmId/plots/:plotId/...)
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { plotError } from './usePlots';

const base = (f, p) => `/farms/${f}/plots/${p}`;

export const planApi = {
  get: (f, p) => api.get(`${base(f, p)}/plan`).then((r) => r.data),
  recommend: (f, p, plannedSowingDate) => api.post(`${base(f, p)}/recommendations`, { plannedSowingDate }).then((r) => r.data),
  select: (f, p, recId, body) => api.post(`${base(f, p)}/recommendations/${recId}/select`, body).then((r) => r.data),
  assess: (f, p, agents) => api.post(`${base(f, p)}/assess`, agents ? { agents } : {}, { timeout: 60000 }).then((r) => r.data),
  createCalendar: (f, p, c) => api.post(`${base(f, p)}/cycles/${c}/calendar`).then((r) => r.data),
  regenerateCalendar: (f, p, c) => api.post(`${base(f, p)}/cycles/${c}/calendar/regenerate`).then((r) => r.data),
  tick: (f, p, c, eventId, done) => api.patch(`${base(f, p)}/cycles/${c}/calendar/events/${eventId}`, { done }).then((r) => r.data),
  updateCycle: (f, p, c, body) => api.patch(`${base(f, p)}/cycles/${c}`, body).then((r) => r.data),
};

export function usePlotPlan(farmId, plotId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    try {
      setData(await planApi.get(farmId, plotId));
      setError(null);
    } catch (e) {
      setError(plotError(e, 'Could not load the cultivation plan'));
    } finally {
      setLoading(false);
    }
  }, [farmId, plotId]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}
