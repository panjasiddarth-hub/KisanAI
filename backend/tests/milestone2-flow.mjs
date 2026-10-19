#!/usr/bin/env node
// Milestone 2 — fertilizer, irrigation and market agents connected to the farm.
//
// Runs against a live stack (backend + ML service + internet for Open-Meteo):
//   node tests/milestone2-flow.mjs
// Env: API_BASE (default http://localhost:5000/api), ML_BASE (default http://127.0.0.1:8000),
//      KEEP=1 to keep the test data, SKIP_CONTRACT=1 to skip the data.gov.in contract test.
//
// Uses throwaway accounts (m2-*@kisanai.test) and only touches their data. Unless KEEP=1 it deletes
// the farms and plans it created. Parts:
//   A. HTTP flow on the running API (soil test → recommendation → selection → calendar →
//      fertilizer / irrigation / market), every number recomputed independently.
//   B. Unit test of the irrigation rain rule with synthetic weather (in-process, in-memory store).
//   C. Contract test of the data.gov.in client against a local mock that serves the documented
//      record format, on a temporary in-memory API instance (port 5056).
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cropRule } from '../src/agents/fertilizerAgent.js';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const ML = process.env.ML_BASE || 'http://127.0.0.1:8000';
const KEEP = process.env.KEEP === '1';
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const created = { farms: [], plans: [] };

const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const callAt = (base) => async (method, p, token, body) => {
  const res = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
};
const call = callAt(API);
const register = async (c, tag) => {
  const r = await c('POST', '/auth/register', null, {
    name: `M2 Test ${tag}`, email: `m2-${tag}-${Date.now()}@kisanai.test`, password: 'm2-test-pass-123',
  });
  return { token: r.data?.token, email: r.data?.user?.email };
};
const near = (a, b, tol = 0.051) => a !== null && b !== null && Math.abs(a - b) <= tol;
const r1 = (v) => Math.round(v * 10) / 10;
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const todayUTC = () => new Date().toISOString().slice(0, 10);

const WARANGAL = { lat: 17.9689, lon: 79.5941, source: 'geocoded', label: 'Warangal, Telangana, India', confirmed: true };
const FULL_CARD = { N: 210, P: 18, K: 260, ph: 7.8, ec: 0.4, oc: 0.42, s: 9, zn: 0.5, b: 0.6, fe: 6.2, cu: 0.9, mn: 4.1, testedOn: '2026-03-02' };
const ML_FEATURES = { ph: 'pH', ec: 'EC_dS_per_m', oc: 'OC_percent', N: 'N_kg_per_ha', P: 'P_kg_per_ha', K: 'K_kg_per_ha', s: 'S_ppm', zn: 'Zn_ppm', b: 'B_ppm', fe: 'Fe_ppm', cu: 'Cu_ppm', mn: 'Mn_ppm' };
// ICAR-IISS limits, written out again independently of the service
const shc3 = (k, v) => { const [lo, hi] = { N: [280, 560], P: [10, 25], K: [120, 280], oc: [0.5, 0.75] }[k]; return v < lo ? 'Low' : v > hi ? 'High' : 'Medium'; };
const FACTOR = { Low: 1.25, Medium: 1, High: 0.75 };

async function newFarm(user, body) {
  const r = await call('POST', '/farms', user.token, { location: 'Warangal, Telangana', areaUnit: 'acres', waterSource: 'Borewell', ...body });
  if (r.data?.id) created.farms.push({ id: r.data.id, token: user.token });
  return r;
}
async function newPlan(user, body) {
  const r = await call('POST', '/calendar/generate', user.token, body);
  if (r.data?.plan?.id && !r.data.existing) created.plans.push({ id: r.data.plan.id, token: user.token });
  return r;
}

// ---------------------------------------------------------------- A. HTTP flow
async function partA() {
  console.log(`\n=== A. HTTP flow → ${API}`);
  const health = await call('GET', '/health');
  console.log(`(database mode: ${health.data?.mode})`);
  const A = await register(call, 'a');
  const B = await register(call, 'b');
  check('A0. Two test accounts registered', A.token && B.token);

  // --- Soil Health Card: all 12 values round-trip, validation ---
  const fa = await newFarm(A, { name: 'M2 Rabi Farm', area: 2, areaUnit: 'hectares', soilType: 'Red Laterite', coordinates: WARANGAL, soilTest: FULL_CARD });
  const saved = fa.data?.soilTest || {};
  check('A1. All 12 Soil Health Card values + test date are saved', fa.status === 201 && Object.keys(FULL_CARD).every((k) => saved[k] === FULL_CARD[k]), JSON.stringify(saved));
  const bad = await call('PATCH', `/farms/${fa.data.id}`, A.token, { soilTest: { ...FULL_CARD, zn: -1, ec: 'abc', mn: 5000 } });
  check('A2. Invalid soil values rejected with a 400 naming each field', bad.status === 400 && ['zn', 'ec', 'mn'].every((k) => JSON.stringify(bad.data).includes(`soilTest.${k}`)), JSON.stringify(bad.data?.details || bad.data?.error));
  const sneaky = await call('PATCH', `/farms/${fa.data.id}`, A.token, { soilTest: { ...FULL_CARD, evil: 1, $where: 'x' } });
  check('A3. Unknown soil-test keys are dropped', sneaky.status === 200 && !('evil' in (sneaky.data?.soilTest || {})) && !('$where' in (sneaky.data?.soilTest || {})));

  // --- Fertilizer before a crop is chosen ---
  const f0 = await call('GET', `/farms/${fa.data.id}/fertilizer`, A.token);
  check('A4. No crop yet → insufficient_data, crop listed as missing, no doses', f0.status === 200 && f0.data.status === 'insufficient_data' && f0.data.plan === null && f0.data.missing.some((m) => m.field === 'crop'));
  const fUnknown = await call('GET', `/farms/${fa.data.id}/fertilizer?crop=Moonbeans`, A.token);
  check('A5. Unknown crop name → 400', fUnknown.status === 400);

  // --- recommendation → selection → calendar → fertilizer ---
  const rec = await call('POST', `/farms/${fa.data.id}/recommendations`, A.token, { plannedSowingDate: '2026-11-20' });
  const pick = rec.data?.shortlist?.[0];
  const sel = pick && await call('POST', `/farms/${fa.data.id}/recommendations/${rec.data.id}/select`, A.token, { crop: pick.crop });
  const gen = sel && await newPlan(A, { ...sel.data.calendarPrefill, farmId: fa.data.id, recommendationId: rec.data.id });
  check('A6. Recommendation → selection → calendar generated', rec.status === 201 && sel?.status === 200 && gen?.status === 201, `${pick?.displayName} sown ${sel?.data?.calendarPrefill?.sowingDate}`);
  const plan = gen?.data?.plan;

  const f1 = await call('GET', `/farms/${fa.data.id}/fertilizer`, A.token);
  const F = f1.data;
  const cropName = sel.data.calendarPrefill.crop;
  check('A7. Fertilizer plan uses the selected crop, the farm area in acres and the sowing-date season',
    f1.status === 200 && F.crop?.name === cropName && F.crop.source === 'selected' && near(F.area.acres, 4.94, 0.006) && F.season.name === 'rabi' && F.season.basis.includes('2026-11-20'),
    `${F.crop?.name}, ${F.area?.acres} ac, ${F.season?.name}`);
  const byKey = Object.fromEntries(F.ratings.nutrients.map((n) => [n.key, n]));
  check('A8. N / P / K / OC ratings follow the ICAR-IISS limits', ['N', 'P', 'K', 'oc'].every((k) => byKey[k].rating === shc3(k, FULL_CARD[k])),
    ['N', 'P', 'K', 'oc'].map((k) => `${k}=${byKey[k].rating}`).join(' '));
  check('A9. Micronutrients rated against critical limits (S 9 < 10 and Zn 0.5 < 0.6 deficient; Fe/Cu/Mn/B sufficient)',
    byKey.s.rating === 'Deficient' && byKey.zn.rating === 'Deficient' && ['fe', 'cu', 'mn', 'b'].every((k) => byKey[k].rating === 'Sufficient'));
  check('A10. pH 7.8 → Alkaline, EC 0.4 → Normal', F.ratings.soilReaction.ph.class === 'Alkaline' && F.ratings.soilReaction.ec.class === 'Normal');

  // Model ratings must be the model's actual outputs (both soil classes tried for "Red Laterite")
  const features = Object.fromEntries(Object.entries(ML_FEATURES).map(([k, f]) => [f, FULL_CARD[k]]));
  const direct = await Promise.all(['Red', 'Laterite'].map(async (cls) => (await fetch(`${ML}/predict/fertilizer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...features, Soil_Type: cls, Season: 'Rabi' }),
  })).json()));
  const sameAsModel = ['N', 'P', 'K'].every((k) => {
    const agree = direct[0].ratings[k] === direct[1].ratings[k];
    return agree ? byKey[k].model?.rating === direct[0].ratings[k] && near(byKey[k].model.confidence, Math.min(direct[0].confidence[k], direct[1].confidence[k]), 1e-6) : byKey[k].model?.rating === null;
  });
  check('A11. ML ratings are the model’s own outputs (direct ML call, Red + Laterite)', F.model.used && sameAsModel && F.model.soilClasses.join() === 'Red,Laterite',
    ['N', 'P', 'K'].map((k) => `${k}:${byKey[k].model?.rating}@${byKey[k].model?.confidence}`).join(' '));

  const rule = cropRule(cropName);
  const exp = { N: r1(rule.n * FACTOR[shc3('N', 210)]), P2O5: r1(rule.p * FACTOR[shc3('P', 18)]), K2O: r1(rule.k * FACTOR[shc3('K', 260)]) };
  const got = F.plan?.perAcre?.nutrients;
  check('A12. Dose = crop dose × soil-test factor (Low ×1.25, Medium ×1, High ×0.75)', got && got.N === exp.N && got.P2O5 === exp.P2O5 && got.K2O === exp.K2O, `${JSON.stringify(got)} vs ${JSON.stringify(exp)}`);
  // Exact targets; products follow from them and are rounded only for display (totals from exact values).
  const nT = rule.n * FACTOR[shc3('N', 210)], pT = rule.p * FACTOR[shc3('P', 18)], kT = rule.k * FACTOR[shc3('K', 260)];
  const dapX = pT / 0.46, nDap = dapX * 0.18, ureaX = Math.max(0, nT - nDap) / 0.46, mopX = kT / 0.6;
  check('A13. Products and farm totals follow from the dose (all P from DAP, its N counted; rest of N from urea; K from MOP)',
    F.plan.perAcre.products['DAP (18-46-0)'] === r1(dapX) && F.plan.perAcre.products['Urea (46% N)'] === r1(ureaX) && F.plan.perAcre.products['MOP (60% K2O)'] === r1(mopX) &&
    F.plan.totals['Urea (46% N)'] === r1(ureaX * F.area.acres) && F.plan.totals['MOP (60% K2O)'] === r1(mopX * F.area.acres),
    `urea ${r1(ureaX)}/ac, totals ${JSON.stringify(F.plan.totals)}`);
  // Schedule and nutrient balance verified together: the sowing dose carries DAP's N, so basal urea only
  // tops it up to the basal share; the splits add up to the N applied, which equals the target.
  const fr = rule.splits.map((x) => x[2]);
  const wantN = fr.map((f) => nT * f);   // DAP-N is below the basal share for this card
  const gotN = F.plan.schedule.map((x) => x.nutrientsPerAcre?.N);
  const basalUrea = parseFloat(F.plan.schedule[0].productsPerAcre.Urea);
  check('A13b. Split N = share × target, basal N = DAP-N + basal urea-N, splits sum to the N applied (= target), shares sum to 100%',
    nDap < wantN[0] && gotN.every((n, i) => near(n, r1(wantN[i]), 0.051)) && near(basalUrea, r1((wantN[0] - nDap) / 0.46), 0.051) &&
    near(F.plan.balance.nApplied, r1(nT), 0.051) && near(F.plan.balance.nFromDap, r1(nDap), 0.051) && F.plan.balance.nExcess === 0 &&
    near(F.plan.schedule.reduce((a, x) => a + x.nShare, 0), 1, 1e-9) && F.plan.schedule.map((x) => x.share).join() === fr.map((f) => `${Math.round(f * 100)}% of N`).join(),
    `N per split ${gotN.join(' + ')} (target ${r1(nT)}, DAP-N ${r1(nDap)})`);
  const calFert = plan.events.filter((e) => e.type === 'fertilizer').map((e) => e.date).sort();
  const schedDates = F.plan.schedule.map((s) => s.date).sort();
  check('A14. Every split has a date that matches a fertilizer event in the farm calendar',
    JSON.stringify(calFert) === JSON.stringify(schedDates) && F.plan.schedule.every((s) => s.calendarEvent), schedDates.join(' '));
  check('A15. Crop-specific vs generic dose is disclosed', F.doseBasis === (['sunflower', 'jowar', 'bajra', 'pigeonpea', 'turmeric', 'banana'].some((k) => cropName.toLowerCase().includes(k)) ? 'generic' : 'crop-specific')
    && (F.doseBasis === 'crop-specific' || F.limitations.some((l) => l.includes('no crop-specific fertilizer dose'))), `${cropName}: ${F.doseBasis}`);
  check('A16. Deficient micronutrients get an advisory, never a dose', F.advisories.some((a) => a.startsWith('Sulphur')) && F.advisories.some((a) => a.startsWith('Zinc')) && !F.advisories.some((a) => /\bkg\b/.test(a)));
  check('A17. Sources cited (ICAR-IISS limits, ±25% rule)', F.sources.some((s) => s.url?.includes('iiss.res.in')) && F.sources.some((s) => s.url?.includes('cwejournal.org')));

  // Boundaries and out-of-range
  const fb = await newFarm(A, { name: 'M2 Boundary Farm', area: 1, soilType: 'Black Cotton', soilTest: { N: 280, P: 25, K: 280.5, ph: 6.5 } });
  const fbr = await call('GET', `/farms/${fb.data.id}/fertilizer?crop=Wheat`, A.token);
  const adj = Object.fromEntries((fbr.data.plan?.adjustments || []).map((a) => [a.nutrient, a]));
  check('A18. Limits are inclusive for Medium (N 280 → Medium, P 25 → Medium, K 280.5 → High)', adj.N?.rating === 'Medium' && adj.P2O5?.rating === 'Medium' && adj.K2O?.rating === 'High' && adj.K2O.factor === 0.75);
  check('A19. With a soil-test N value the black-soil N heuristic is not stacked on top', fbr.data.plan?.perAcre?.nutrients?.N === cropRule('Wheat').n);
  check('A20. Partial card → model not used, reason lists the missing values', fbr.data.model.used === false && /EC.*Organic carbon.*S, Zn, B, Fe, Cu, Mn/.test(fbr.data.model.reason), fbr.data.model.reason);
  const fo = await newFarm(A, { name: 'M2 High-N Farm', area: 1, soilType: 'Alluvial', soilTest: { ...FULL_CARD, N: 600 } });
  const fob = await call('GET', `/farms/${fo.data.id}/fertilizer?crop=Maize`, A.token);
  check('A21. N 600 is outside the model’s training range → model withheld; SHC rating High → N ×0.75',
    fob.data.model.used === false && fob.data.model.outOfRange?.[0]?.feature === 'N_kg_per_ha' && fob.data.plan.adjustments[0].rating === 'High' && fob.data.plan.perAcre.nutrients.N === r1(cropRule('Maize').n * 0.75),
    fob.data.model.reason);
  const fbig = await newFarm(A, { name: 'M2 Bigha Farm', area: 5, areaUnit: 'bigha', soilType: 'Alluvial', soilTest: { N: 300, P: 12, K: 150, ph: 7 } });
  const fbg = await call('GET', `/farms/${fbig.data.id}/fertilizer?crop=Wheat`, A.token);
  check('A22. Area in bigha is not guessed → insufficient_data with the area listed as missing', fbg.data.status === 'insufficient_data' && fbg.data.plan === null && fbg.data.missing.some((m) => m.field === 'area'));
  const generic = await call('POST', '/agents/fertilizer', A.token, { crop: 'Cotton', areaAcres: 2, soilType: 'black' });
  check('A23. Generic Fertilizer Agent unchanged and no longer prints an invented soil-test date',
    generic.status === 200 && generic.data.perAcre.nutrients.N === 47.5 && !JSON.stringify(generic.data).includes('12 May 2024'));

  // --- Irrigation ---
  const noLoc = await newFarm(A, { name: 'M2 No-Location Farm', area: 1, soilType: 'Black Cotton' });
  const iNo = await call('GET', `/farms/${noLoc.data.id}/irrigation`, A.token);
  check('A24. Irrigation needs a confirmed location → 422 (no default location)', iNo.status === 422 && iNo.data.missing?.includes('coordinates'));

  const pf = await newFarm(A, { name: 'M2 Paddy Farm', area: 3, soilType: 'Black Cotton', waterSource: 'Canal', coordinates: WARANGAL });
  const sowing = addDays(todayUTC(), -94); // day 96 irrigation event falls 2 days from now
  const pg = await newPlan(A, { crop: 'Paddy (Rice)', sowingDate: sowing, farmId: pf.data.id });
  const irr = await call('GET', `/farms/${pf.data.id}/irrigation`, A.token);
  const I = irr.data;
  check('A25. Irrigation uses the farm calendar crop and sowing date', irr.status === 200 && I.crop?.name === 'Paddy (Rice)' && I.crop.planId === pg.data.plan.id && I.crop.das === 94 + (I.today > todayUTC() ? 1 : I.today < todayUTC() ? -1 : 0), `DAS ${I.crop?.das}, ${I.crop?.stage}, Kc ${I.crop?.kcToday}`);
  // independent FAO-56 recomputation (Table 12 rice 1.05/1.20/0.75, Table 11 30/30/60/30 scaled to 120 days)
  const L = [30, 30, 60, 30].map((x) => (x * 120) / 150);
  const kcOf = (das) => (das < 0 ? null : das <= L[0] ? 1.05 : das <= L[0] + L[1] ? 1.05 + ((das - L[0]) / L[1]) * 0.15 : das <= L[0] + L[1] + L[2] ? 1.2 : das <= 120 ? 1.2 + ((das - 96) / 24) * (0.75 - 1.2) : null);
  const kcOk = I.days.every((d) => { const k = kcOf(Math.round((new Date(d.date) - new Date(sowing)) / 86400000)); return k === null ? d.kc === null : near(d.kc, k, 0.006); });
  check('A26. Kc each day matches an independent FAO-56 recomputation', kcOk, I.days.map((d) => d.kc).join(' '));
  check('A27. ETc = Kc × ET0 every day', I.days.every((d) => (d.etcMm === null) === (d.kc === null || d.et0Mm === null) && (d.etcMm === null || near(d.etcMm, d.kc * d.et0Mm, 0.06))));
  const om = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${WARANGAL.lat}&longitude=${WARANGAL.lon}&daily=precipitation_sum,et0_fao_evapotranspiration&past_days=2&forecast_days=7&timezone=auto`)).json();
  const omOk = om.daily.time.every((t, i) => { const d = I.days.find((x) => x.date === t); return d && near(d.rainMm, om.daily.precipitation_sum[i], 0.5) && near(d.et0Mm, om.daily.et0_fao_evapotranspiration[i], 0.3); });
  check('A28. Rain and ET0 match a fresh Open-Meteo request for the farm’s coordinates', omOk && I.days.length === 9);
  check('A29. Past days labelled as model estimates, the rest as forecast', I.days.slice(0, 2).every((d) => d.kind === 'recent-model-estimate') && I.days.slice(2).every((d) => d.kind === 'forecast'));
  const fc = I.days.filter((d) => d.kind === 'forecast');
  const etcSum = r1(fc.reduce((s, d) => s + d.etcMm, 0));
  const rainSum = r1(fc.reduce((s, d) => s + d.rainMm, 0));
  const netExp = r1(Math.max(0, etcSum - rainSum));
  check('A30. Weekly outlook adds up (ETc − rain → net mm → litres for 3 acres)', near(I.outlook.etcMm, etcSum, 0.11) && near(I.outlook.netMm, netExp, 0.11) && Math.abs(I.outlook.netLitres - I.outlook.netMm * 3 * 4046.86) <= 50,
    `ETc ${I.outlook.etcMm} − rain ${I.outlook.rainOnCropDaysMm} = ${I.outlook.netMm} mm ≈ ${I.outlook.netLitres} L`);
  const calIrr = pg.data.plan.events.filter((e) => e.type === 'irrigation' && e.date >= I.today && e.date <= I.days[8].date).map((e) => e.date);
  const evOk = I.events.length === calIrr.length && I.events.every((e) => {
    const r48 = r1(I.days.find((d) => d.date === addDays(e.date, -2)).rainMm + I.days.find((d) => d.date === addDays(e.date, -1)).rainMm);
    return near(e.rain48hMm, r48) && e.decision === (r48 > 25 ? 'skip' : 'irrigate');
  });
  check('A31. Each upcoming calendar irrigation event is judged by the calendar rule (skip if > 25 mm in 48 h)', evOk && calIrr.length > 0, I.events.map((e) => `${e.date}: ${e.decision} (${e.rain48hMm} mm)`).join('; '));
  check('A32. Limitations say soil moisture is not measured and past rain is a model estimate', I.limitations.some((l) => l.includes('does not measure')) && I.limitations.some((l) => l.includes('not a rain-gauge reading')));

  const tf = await newFarm(A, { name: 'M2 Turmeric Farm', area: 1, soilType: 'Red Laterite', waterSource: 'Rain-fed', coordinates: WARANGAL });
  await newPlan(A, { crop: 'Turmeric', sowingDate: addDays(todayUTC(), -60), farmId: tf.data.id });
  const it = await call('GET', `/farms/${tf.data.id}/irrigation`, A.token);
  check('A33. Crop without FAO-56 coefficients → reference ET0 only, stated; rain-fed farm noted',
    it.status === 200 && it.data.status === 'partial' && it.data.outlook.etcMm === null && it.data.days.every((d) => d.kc === null && d.et0Mm !== null)
    && it.data.limitations.some((l) => l.includes('FAO-56 has no crop coefficient for Turmeric')) && it.data.limitations.some((l) => l.includes('rain-fed')));

  // --- Market ---
  const meta = await (await fetch(`${ML}/meta/market`)).json();
  const mk = await call('GET', `/farms/${fa.data.id}/market`, A.token);
  const M = mk.data;
  const expectedCrops = [cropName, ...rec.data.shortlist.map((s) => s.calendarCrop || s.displayName)].filter((v, i, a) => a.indexOf(v) === i);
  check('A34. Market covers the selected crop + the latest recommendation shortlist', mk.status === 200 && JSON.stringify(M.crops.map((c) => c.crop)) === JSON.stringify(expectedCrops), M.crops.map((c) => `${c.crop}[${c.sources}]`).join(', '));
  check('A35. State read from the farm location', M.state === 'Telangana');
  const MAP = { 'Paddy (Rice)': 'Paddy(Dhan)', 'Chickpea (Chana)': 'Gram(Chana)', 'Jowar (Sorghum)': 'Jowar', 'Bajra (Pearl Millet)': 'Bajra' };
  const covOk = M.crops.every((c) => c.model.supported === meta.Commodity.includes(MAP[c.crop] || c.crop));
  check('A36. Price-model coverage matches the model artifact’s commodity list (“no price model” otherwise)', covOk && M.crops.every((c) => c.model.forecast === null),
    M.crops.map((c) => `${c.crop}:${c.model.supported}`).join(' '));
  check('A37. Without DATA_GOV_IN_API_KEY live prices are reported as not configured — nothing estimated',
    M.live.status === 'not_configured' && M.crops.every((c) => c.live.status === 'not_configured' && !c.live.records));
  const mNone = await call('GET', `/farms/${fb.data.id}/market`, A.token);
  check('A38. Farm without recommendation or selection → insufficient_data, crops listed as missing', mNone.data.status === 'insufficient_data' && mNone.data.missing.some((m) => m.field === 'crops'));

  const g = await call('GET', '/market', A.token);
  const changesOk = g.data.prices.every((p) => p.change === null ? p.forecast === null : Number.isFinite(p.change) && p.change === Math.round(((p.forecast - p.lastPrice) / p.lastPrice) * 1000) / 10);
  check('A39. Generic Market: change is finite and = forecast vs last input price (no NaN)', g.status === 200 && changesOk, g.data.prices.map((p) => `${p.crop} ${p.change}%`).join(' '));
  check('A40. Generic Market labels its inputs as sample data, not live', g.data.dataSource?.prices === 'sample' && g.data.prices.every((p) => p.inputs?.basis === 'sample') && /static sample/i.test(g.data.nearbyMarketsBasis));

  // --- Ownership ---
  const own = await Promise.all(['fertilizer', 'irrigation', 'market'].map((x) => call('GET', `/farms/${fa.data.id}/${x}`, B.token)));
  check('A41. Another farmer gets 404 for fertilizer / irrigation / market of A’s farm', own.every((r) => r.status === 404));
  const bogus = await call('GET', '/farms/not-a-real-id/fertilizer', A.token);
  const unauth = await call('GET', `/farms/${fa.data.id}/market`);
  check('A42. Malformed farm id → 404; no token → 401', bogus.status === 404 && unauth.status === 401);
  return { A, B };
}

// ---------------------------------------------------------------- B. rain-rule unit test
async function partB() {
  console.log('\n=== B. Irrigation rain rule with synthetic weather (in-process, in-memory store)');
  const { plans } = await import('../src/database/repositories/store.js');
  const { irrigationForFarm } = await import('../src/services/farmIrrigation.js');
  const t = todayUTC();
  const dates = Array.from({ length: 9 }, (_, i) => addDays(t, i - 2));
  //               t-2  t-1  t   t+1  t+2   t+3 t+4 t+5 t+6
  const rain = [20, 10, 30, 0, null, 0, 0, 25, 1];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (!String(url).startsWith('https://api.open-meteo.com/')) return realFetch(url, opts);
    return new Response(JSON.stringify({
      timezone: 'Asia/Kolkata',
      daily: { time: dates, precipitation_sum: rain, precipitation_probability_max: rain.map(() => 50), et0_fao_evapotranspiration: rain.map(() => 5) },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const farm = { id: 'unit-farm', name: 'Unit Farm', area: 2, areaUnit: 'acres', waterSource: 'Borewell', coordinates: { lat: 17.97, lon: 79.59, confirmedAt: new Date() } };
    const ev = (date, done = false) => ({ date, title: `Irrigation ${date}`, type: 'irrigation', notes: '', done });
    await plans.create({ userId: 'unit-user', farmId: 'unit-farm', crop: 'Wheat', sowingDate: addDays(t, -25), events: [ev(t), ev(addDays(t, 1)), ev(addDays(t, 3)), ev(addDays(t, 5), true), ev(addDays(t, 6))] });
    const out = await irrigationForFarm({ userId: 'unit-user', farm });
    const by = Object.fromEntries(out.events.map((e) => [e.date, e]));
    check('B1. 20 + 10 = 30 mm in the 48 h before today → skip (model-estimate basis)', by[t]?.decision === 'skip' && by[t].rain48hMm === 30 && by[t].basis === 'recent-model-estimate');
    check('B2. 10 + 30 = 40 mm before tomorrow → skip (forecast basis)', by[addDays(t, 1)]?.decision === 'skip' && by[addDays(t, 1)].basis === 'forecast');
    check('B3. Missing rain value in the window → unknown, not guessed', by[addDays(t, 3)]?.decision === 'unknown');
    check('B4. Event already ticked done → done', by[addDays(t, 5)]?.decision === 'done');
    check('B5. Exactly 25 mm → irrigate (rule is "more than 25 mm")', by[addDays(t, 6)]?.decision === 'irrigate' && by[addDays(t, 6)].rain48hMm === 25);
    // Wheat: Table 12 0.3/1.15/0.325, Table 11 15/25/50/30 scaled to 110 days → stages end on days
    // 13.75 / 36.7 / 82.5 / 110, so day 25 is in the development stage
    const L = [15, 25, 50, 30].map((x) => (x * 110) / 120);
    const kc25 = 0.3 + ((25 - L[0]) / L[1]) * (1.15 - 0.3);
    check('B6. Wheat Kc on day 25 (development stage) = FAO-56 interpolation', out.crop.stage === 'development' && near(out.crop.kcToday, kc25, 0.006), `${out.crop.kcToday} vs ${kc25.toFixed(3)}`);
    const n = out.outlook;
    check('B7. Outlook: missing-rain day counted as 0 only in sums, net = ETc − rain ≥ 0', n.rainMm === 56 && n.netMm === r1(Math.max(0, n.etcMm - n.rainOnCropDaysMm)));
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ---------------------------------------------------------------- C. data.gov.in contract test
async function partC() {
  console.log('\n=== C. data.gov.in client against a local mock (documented record format)');
  const KEY = 'contract-test-key-not-a-secret';
  const seen = [];
  let mode = 'ok';
  const records = [
    { state: 'Telangana', district: 'Hyderabad', market: 'Bowenpally', commodity: 'Paddy(Dhan)(Common)', variety: 'Common', grade: 'FAQ', arrival_date: '14/10/2026', min_price: '2100', max_price: '2300', modal_price: '2200' },
    { state: 'Telangana', district: 'Warangal', market: 'Warangal', commodity: 'Paddy(Dhan)(Common)', variety: 'Common', grade: 'FAQ', arrival_date: '14/10/2026', min_price: '2050', max_price: '2250', modal_price: '2180' },
    { state: 'Telangana', district: 'Warangal', market: 'Enumamula', commodity: 'Maize', variety: 'Hybrid/Local', grade: 'FAQ', arrival_date: '15/10/2026', min_price: 1900, max_price: 2100, modal_price: 2050 },
    { state: 'Telangana', district: 'Nalgonda', market: 'Miryalaguda', commodity: 'Paddy(Dhan)(Common)', variety: 'Sona', grade: 'FAQ', arrival_date: '15/10/2026', min_price: '2150', max_price: '2400', modal_price: '2350' },
    { state: 'Telangana', district: 'Warangal', market: 'Warangal', commodity: 'Onion Green', variety: 'Other', grade: 'FAQ', arrival_date: '15/10/2026', min_price: '1000', max_price: '1400', modal_price: '1200' },
    { state: 'Telangana', district: 'Warangal', market: 'Warangal', commodity: 'Cotton', variety: 'Other', grade: 'FAQ', arrival_date: '15/10/2026', min_price: '', max_price: '', modal_price: '' },
  ];
  const mock = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    seen.push(Object.fromEntries(u.searchParams));
    if (mode === 'forbidden') { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end('{"error":"Invalid key"}'); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', total: records.length, count: records.length, updated_date: '2026-10-15', records: records.filter((r) => r.state === u.searchParams.get('filters[state.keyword]')) }));
  });
  await new Promise((r) => mock.listen(5099, '127.0.0.1', r));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: '5056', MONGODB_URI: '', DATA_GOV_IN_API_KEY: KEY, DATA_GOV_IN_BASE_URL: 'http://127.0.0.1:5099/resource' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  try {
    const c = callAt('http://127.0.0.1:5056/api');
    for (let i = 0; i < 40; i++) { try { if ((await c('GET', '/health')).status === 200) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 250)); }
    const U = await register(c, 'contract');
    // Soil test in the crop model's range → the model ranks Paddy first for Warangal kharif (see Milestone 1)
    const farm = (await c('POST', '/farms', U.token, { name: 'Contract Farm', location: 'Warangal, Telangana', area: 2, areaUnit: 'acres', soilType: 'Black Cotton', waterSource: 'Borewell', coordinates: WARANGAL, soilTest: { N: 90, P: 42, K: 43, ph: 6.5 } })).data;
    const rec = (await c('POST', `/farms/${farm.id}/recommendations`, U.token, { plannedSowingDate: '2027-06-20' })).data;
    const pick = rec.shortlist?.find((s) => /paddy|rice/i.test(s.calendarCrop || s.displayName)) || rec.shortlist?.[0];
    if (pick) await c('POST', `/farms/${farm.id}/recommendations/${rec.id}/select`, U.token, { crop: pick.crop });
    const m = (await c('GET', `/farms/${farm.id}/market`, U.token)).data;
    const q = seen[0] || {};
    check('C1. Request sends the key as api-key, JSON format, and filters[state.keyword]=Telangana', q['api-key'] === KEY && q.format === 'json' && q['filters[state.keyword]'] === 'Telangana');
    check('C2. The API key never appears in the API response', !JSON.stringify(m).includes(KEY));
    const paddy = m.crops?.find((x) => /paddy/i.test(x.crop));
    check('C3. Live status ok; records normalised (dd/mm/yyyy → ISO dates, string prices → numbers)', m.live?.status === 'ok' && paddy?.live?.status === 'ok'
      && paddy.live.records.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.arrivalDate) && typeof r.modalPrice === 'number'), paddy ? `${paddy.live.markets} paddy markets` : 'no paddy in shortlist');
    check('C4. Records from the farm’s district first, then newest', paddy?.live?.records?.[0]?.district === 'Warangal' && paddy.live.records[0].nearFarm === true && paddy.live.records[1].market === 'Miryalaguda');
    check('C5. Summary = min / max modal price across matching markets', paddy?.live?.modalMin === 2180 && paddy.live.modalMax === 2350 && paddy.live.latestArrivalDate === '2026-10-15');
    check('C6. Paddy rows only contain paddy commodities', paddy?.live?.records?.every((r) => /paddy/i.test(r.commodity)));

    // Normalisation + keyword matching, called directly with the same mock data
    process.env.DATA_GOV_IN_API_KEY = KEY;
    process.env.DATA_GOV_IN_BASE_URL = 'http://127.0.0.1:5099/resource';
    const { fetchStatePrices, commodityPattern, stateFromFarm } = await import('../src/services/mandiPrices.js');
    const direct = await fetchStatePrices('Telangana');
    check('C7. Rows without a modal price are dropped (5 of 6 kept)', direct.status === 'ok' && direct.records.length === 5 && !direct.records.some((r) => r.commodity === 'Cotton'));
    check('C8. Keyword matching: "Onion Green" is not Onion; Agmarknet paddy / gram / arhar names match',
      !commodityPattern('Onion').test('Onion Green') && commodityPattern('Onion').test('Onion') && commodityPattern('Paddy (Rice)').test('Paddy(Dhan)(Common)')
      && commodityPattern('Chickpea (Chana)').test('Bengal Gram(Gram)(Whole)') && commodityPattern('Pigeonpea (Tur)').test('Arhar (Tur/Red Gram)(Whole)') && commodityPattern('Soybean').test('Soyabean'));
    check('C9. State parsing: location text, geocoded label, aliases; unknown → null',
      stateFromFarm({ location: 'Nashik, Maharashtra' })?.state === 'Maharashtra' && stateFromFarm({ location: 'My village', coordinates: { label: 'Guntur, Andhra Pradesh, India' } })?.state === 'Andhra Pradesh'
      && stateFromFarm({ location: 'Cuttack, Orissa' })?.state === 'Odisha' && stateFromFarm({ location: 'Somewhere' }) === null);
    delete process.env.DATA_GOV_IN_API_KEY;
    delete process.env.DATA_GOV_IN_BASE_URL;

    mode = 'forbidden';
    const NASHIK = { lat: 19.9975, lon: 73.7898, source: 'geocoded', label: 'Nashik, Maharashtra, India', confirmed: true };
    const f2 = (await c('POST', '/farms', U.token, { name: 'Contract Farm 2', location: 'Nashik, Maharashtra', area: 1, soilType: 'Black Cotton', waterSource: 'Borewell', coordinates: NASHIK, soilTest: { N: 90, P: 42, K: 43, ph: 6.5 } })).data; // recommendations need a soil test (Milestone 1)
    const rec2 = (await c('POST', `/farms/${f2.id}/recommendations`, U.token, { plannedSowingDate: '2027-06-20' })).data;
    if (rec2.shortlist?.[0]) await c('POST', `/farms/${f2.id}/recommendations/${rec2.id}/select`, U.token, { crop: rec2.shortlist[0].crop });
    const m2 = (await c('GET', `/farms/${f2.id}/market`, U.token)).data;
    check('C10. Upstream 403 → status unavailable with a key hint; nothing estimated', m2.live?.status === 'unavailable' && /DATA_GOV_IN_API_KEY/.test(m2.live.message) && m2.crops.length > 0 && m2.crops.every((x) => !x.live.records),
      m2.live?.message);
  } finally {
    child.kill('SIGTERM');
    mock.close();
  }
}

async function main() {
  console.log('Milestone 2 flow test');
  const { A, B } = await partA();
  await partB();
  if (process.env.SKIP_CONTRACT !== '1') await partC();

  if (KEEP) console.log(`\nKEEP=1 → test data kept (accounts ${A.email}, ${B.email}).`);
  else {
    for (const p of created.plans) await call('DELETE', `/calendar/${p.id}`, p.token);
    for (const f of created.farms) await call('DELETE', `/farms/${f.id}`, f.token);
    console.log(`\nCleaned up ${created.farms.length} farms and ${created.plans.length} plans (test accounts remain).`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.log('Failed:', failed.map((f) => f.name).join('\n  ')); process.exit(1); }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
