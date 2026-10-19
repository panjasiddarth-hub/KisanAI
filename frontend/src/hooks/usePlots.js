// src/hooks/usePlots.js — plots of one farm (/api/farms/:farmId/plots)
import { useCallback, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';

export const plotApi = {
  list: (farmId) => api.get(`/farms/${farmId}/plots`, { params: { status: 'all' } }).then((r) => r.data),
  create: (farmId, body) => api.post(`/farms/${farmId}/plots`, body).then((r) => r.data),
  update: (farmId, plotId, body) => api.patch(`/farms/${farmId}/plots/${plotId}`, body).then((r) => r.data),
  remove: (farmId, plotId) => api.delete(`/farms/${farmId}/plots/${plotId}`).then((r) => r.data),
};

// API error → { message, details[] } (400s list every invalid field; 409s explain the conflict).
export const plotError = (err, fallback = 'Something went wrong') => ({
  message: apiErrorMessage(err, fallback),
  details: err?.response?.data?.details || [],
  status: err?.response?.status || null,
});

export const AREA_UNITS = [
  { value: 'acres', label: 'Acres' },
  { value: 'hectares', label: 'Hectares' },
  { value: 'guntha', label: 'Guntha (1/40 acre)' },
  { value: 'cents', label: 'Cents (1/100 acre)' },
  { value: 'sqm', label: 'Square metres' },
  { value: 'bigha', label: 'Bigha (not converted)' },
];
export const UNIT_SHORT = { acres: 'ac', hectares: 'ha', guntha: 'guntha', cents: 'cents', sqm: 'm²', bigha: 'bigha' };

// Server messages name fields by API path (machine-readable, e.g. "soilTest.ph must be …");
// show farmers the form labels instead.
const FIELD_LABELS = {
  name: 'Plot name', area: 'Area', areaUnit: 'Unit', soilType: 'Soil type',
  'soilTest.N': 'N (kg/ha)', 'soilTest.P': 'P (kg/ha)', 'soilTest.K': 'K (kg/ha)', 'soilTest.ph': 'pH', 'soilTest.ec': 'EC',
  'soilTest.oc': 'Organic carbon', 'soilTest.s': 'S', 'soilTest.zn': 'Zn', 'soilTest.b': 'B', 'soilTest.fe': 'Fe',
  'soilTest.cu': 'Cu', 'soilTest.mn': 'Mn', 'soilTest.testedOn': 'Soil test date',
  'waterAccess.source': 'Water source', 'waterAccess.method': 'Irrigation method',
};
const FIELD_KEYS = Object.keys(FIELD_LABELS).sort((a, b) => b.length - a.length);
export function friendlyMessage(msg) {
  const m = /^previousCrops\[(\d+)\]\.(crop|season|year)(.*)$/.exec(msg);
  if (m) return `Previous crop ${Number(m[1]) + 1}: ${m[2]}${m[3]}`;
  const key = FIELD_KEYS.find((k) => msg.startsWith(`${k} `));
  return key ? FIELD_LABELS[key] + msg.slice(key.length) : msg;
}
export const COPIED_LABELS = { soilType: 'soil type', soilTest: 'soil test', waterAccess: 'water access', previousCrops: 'previous crops' };

const r2 = (v) => Math.round(v * 100) / 100;
export function formatArea(plot) {
  const base = `${plot.area} ${UNIT_SHORT[plot.areaUnit] || plot.areaUnit}`;
  if (plot.areaAcres == null) return `${base} (not converted)`;
  return plot.areaUnit === 'acres' ? `${base} · ${r2(plot.areaHectares)} ha` : `${base} · ${r2(plot.areaAcres)} ac`;
}

export function usePlots(farmId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      setData(await plotApi.list(farmId));
      setError(null);
    } catch (e) {
      setError(plotError(e, 'Could not load plots'));
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}
