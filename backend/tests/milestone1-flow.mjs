#!/usr/bin/env node
// Milestone 1 — farm → recommendation → selection → calendar → weather, end to end over HTTP.
//
// Runs against a live stack (backend + ML service + internet for Open-Meteo):
//   node tests/milestone1-flow.mjs
// Env: API_BASE (default http://localhost:5000/api), ML_BASE (default http://127.0.0.1:8000),
//      KEEP=1 to keep the test data (prints/writes the ids), STATE_FILE=path to write them as JSON.
//
// It registers two throwaway accounts (m1-*@kisanai.test) and only touches their data.
// Unless KEEP=1, it deletes the farms and plans it created (farm deletion also removes their
// recommendation history). The two test user accounts remain (there is no delete-user endpoint).
import fs from 'node:fs';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const ML = process.env.ML_BASE || 'http://127.0.0.1:8000';
const KEEP = process.env.KEEP === '1';
const results = [];
const created = { farms: [], plans: [] };

const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const call = async (method, path, token, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
};
const register = async (tag) => {
  const r = await call('POST', '/auth/register', null, {
    name: `M1 Test ${tag}`, email: `m1-${tag}-${Date.now()}@kisanai.test`, password: 'm1-test-pass-123',
  });
  return { token: r.data?.token, id: r.data?.user?.id, email: r.data?.user?.email, status: r.status };
};
const near = (a, b, tol = 0.051) => Math.abs(a - b) <= tol;

// Independent recomputation of the season climate from Open-Meteo (verifies nothing is invented)
async function recomputeClimate(lat, lon, startsOn, years, days) {
  const windows = years.map((y) => {
    const ws = new Date(`${y}-${startsOn}T00:00:00Z`);
    return [ws, new Date(ws.getTime() + (days - 1) * 86400000)];
  });
  const from = windows[0][0].toISOString().slice(0, 10);
  const to = windows[windows.length - 1][1].toISOString().slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${from}&end_date=${to}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&timezone=auto`;
  const d = (await (await fetch(url)).json()).daily;
  let t = 0, tn = 0, h = 0, hn = 0; const rains = [];
  for (const [ws, we] of windows) {
    let r = 0;
    d.time.forEach((day, i) => {
      const dt = new Date(`${day}T00:00:00Z`);
      if (dt < ws || dt > we) return;
      if (d.temperature_2m_mean[i] != null) { t += d.temperature_2m_mean[i]; tn++; }
      if (d.relative_humidity_2m_mean[i] != null) { h += d.relative_humidity_2m_mean[i]; hn++; }
      if (d.precipitation_sum[i] != null) r += d.precipitation_sum[i];
    });
    rains.push(r);
  }
  const seasonRain = rains.reduce((a, b) => a + b, 0) / rains.length;
  const r1 = (n) => Math.round(n * 10) / 10;
  return { temperature: r1(t / tn), humidity: r1(h / hn), rainfall: r1(seasonRain / (days / 30)) };
}

const FARM_BASE = { location: 'Warangal, Telangana', areaUnit: 'acres', soilType: 'Black Cotton', waterSource: 'Borewell' };
const WARANGAL = { lat: 17.9689, lon: 79.5941 };

async function main() {
  console.log(`Milestone 1 flow test → ${API}\n`);
  const health = await call('GET', '/health');
  console.log(`(database mode: ${health.data?.mode})\n`);

  // ---------------- 10a. Registration / login still work ----------------
  const A = await register('a');
  const B = await register('b');
  check('Registration works (two throwaway accounts)', A.status === 201 && B.status === 201 && A.token && B.token);
  const login = await call('POST', '/auth/login', null, { email: A.email, password: 'm1-test-pass-123' });
  check('Login works', login.status === 200 && !!login.data?.token);
  const me = await call('GET', '/auth/me', A.token);
  check('GET /auth/me returns the logged-in user', me.status === 200 && me.data?.user?.id === A.id);

  // ---------------- Farm CRUD + validation ----------------
  const farmRes = await call('POST', '/farms', A.token, {
    ...FARM_BASE, name: 'M1 Main Farm', area: 2.5, crops: ['Wheat'],
    coordinates: { ...WARANGAL, source: 'manual', label: 'Warangal (test)', confirmed: true },
    soilTest: { N: 90, P: 42, K: 43, ph: 6.8, testedOn: '2026-09-01' },
    userId: B.id, // must be ignored
  });
  const farm = farmRes.data;
  if (farm?.id) created.farms.push({ token: A.token, id: farm.id });
  check('Create farm (MongoDB mode bug fixed: owner set from token)', farmRes.status === 201 && farm.userId === A.id, `HTTP ${farmRes.status}`);
  check('Create farm ignores a userId sent in the body', farm?.userId === A.id && farm?.userId !== B.id);
  check('Confirmed coordinates + soil test are stored', farm?.coordinates?.confirmedAt && farm?.soilTest?.N === 90 && farm?.soilTest?.ph === 6.8);

  const list = await call('GET', '/farms', A.token);
  check('1. Farmer sees the farm in their farm list', list.status === 200 && list.data.some((f) => f.id === farm.id));
  const one = await call('GET', `/farms/${farm.id}`, A.token);
  check('1. Farmer opens the existing farm (GET /farms/:id)', one.status === 200 && one.data.id === farm.id && one.data.name === 'M1 Main Farm');

  const upd = await call('PATCH', `/farms/${farm.id}`, A.token, { area: 3, userId: B.id, selectedCrop: { crop: 'hacked' } });
  check('Update farm works and ignores userId / selectedCrop in the body', upd.status === 200 && upd.data.area === 3 && upd.data.userId === A.id && !upd.data.selectedCrop?.crop);
  check('Invalid coordinates rejected (400)', (await call('POST', '/farms', A.token, { ...FARM_BASE, name: 'Bad', area: 1, coordinates: { lat: 200, lon: 10, confirmed: true } })).status === 400);
  check('Invalid soil pH rejected (400)', (await call('POST', '/farms', A.token, { ...FARM_BASE, name: 'Bad', area: 1, soilTest: { ph: 20 } })).status === 400);
  check('Malformed farm id → 404, not 500', (await call('PATCH', '/farms/not-an-id', A.token, { area: 2 })).status === 404);

  const temp = await call('POST', '/farms', A.token, { ...FARM_BASE, name: 'M1 Temp Farm', area: 1 });
  const del = await call('DELETE', `/farms/${temp.data.id}`, A.token);
  check('Delete farm works', del.status === 200 && (await call('GET', `/farms/${temp.data.id}`, A.token)).status === 404);

  // ---------------- 2–5. Recommendations (ML path) ----------------
  const recRes = await call('POST', `/farms/${farm.id}/recommendations`, A.token, { plannedSowingDate: '2027-06-20' });
  const rec = recRes.data;
  check('2. Farmer requests crop recommendations (201, saved with an id)', recRes.status === 201 && !!rec?.id, `status=${rec?.status} engine=${rec?.engine}`);
  check('3. Backend loaded the correct farm profile', rec.farmId === farm.id && rec.userId === A.id
    && rec.inputs.soilTest.N === 90 && rec.inputs.soilTest.ph === 6.8 && rec.inputs.soilType.usedAs === 'black'
    && rec.inputs.waterSource.usedAs === 'irrigated' && rec.inputs.cropHistory.includes('Wheat'));
  const cl = rec.inputs.climate;
  check('3. Climate comes from the farm’s own confirmed coordinates (no default location)',
    cl && cl.farmCoordinates.lat === WARANGAL.lat && cl.farmCoordinates.lon === WARANGAL.lon && cl.kind === 'historical-reanalysis');
  const indep = await recomputeClimate(WARANGAL.lat, WARANGAL.lon, cl.window.startsOn, cl.window.years, cl.window.days);
  check('4. Climate values match an independent Open-Meteo ERA5 recomputation',
    near(indep.temperature, cl.temperature) && near(indep.humidity, cl.humidity) && near(indep.rainfall, cl.rainfall, 0.11),
    `T ${cl.temperature}/${indep.temperature}, RH ${cl.humidity}/${indep.humidity}, rain ${cl.rainfall}/${indep.rainfall}`);
  check('4. The ML crop model was actually used', rec.engine === 'ml' && rec.model?.used === true);
  const mlDirect = await (await fetch(`${ML}/predict/crop`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rec.model.features, top_k: 22 }),
  })).json();
  const prob = Object.fromEntries(mlDirect.recommendations.map((r) => [r.crop, r.score]));
  check('4. Every shortlist score equals the ML service’s probability for those exact inputs',
    rec.shortlist.length > 0 && rec.shortlist.every((s) => s.score.kind === 'ml-probability' && prob[s.crop] === s.score.value),
    rec.shortlist.map((s) => `${s.crop}=${s.score.value}`).join(', '));
  check('4. Model inputs = farm soil test + recomputed climate',
    rec.model.features.N === 90 && rec.model.features.K === 43 && rec.model.features.rainfall === cl.rainfall);
  check('5. At most three crops, no duplicates', rec.shortlist.length <= 3 && new Set(rec.shortlist.map((s) => s.crop)).size === rec.shortlist.length);
  check('5. Shortlist follows model order (excluded crops explained)',
    rec.shortlist.every((s, i, a) => i === 0 || a[i - 1].score.value >= s.score.value) && rec.excluded.every((e) => e.reason));
  check('5. Every item has reasons, a limitations list and an honest cost field',
    rec.shortlist.every((s) => s.reasons.length > 0 && Array.isArray(s.limitations) && s.estimatedCost === null && /not available/i.test(s.costNote)));
  check('5. Crops outside the knowledge base are flagged as unchecked',
    rec.shortlist.filter((s) => !s.inKnowledgeBase).every((s) => s.limitations.some((l) => /not in the KisanAI knowledge base/i.test(l))));
  check('5. Global limitations explain what the scores are', rec.limitations.some((l) => /not yield or profit/i.test(l)));

  // ---------------- Missing information & fallback ----------------
  const bare = await call('POST', '/farms', A.token, { ...FARM_BASE, name: 'M1 Bare Farm', area: 1 });
  created.farms.push({ token: A.token, id: bare.data.id });
  const bareRec = (await call('POST', `/farms/${bare.data.id}/recommendations`, A.token, { plannedSowingDate: '2027-06-20' })).data;
  const missingFields = bareRec.missing.map((m) => m.field);
  check('No soil test + no location → nothing ranked, missing info explained',
    bareRec.status === 'insufficient_data' && bareRec.engine === 'none' && bareRec.shortlist.length === 0
    && ['coordinates', 'soilTest.N', 'soilTest.P', 'soilTest.K', 'soilTest.ph'].every((f) => missingFields.includes(f)),
    missingFields.join(', '));
  check('Unconfirmed farm has no climate lookup (no default location used)', !bareRec.inputs.climate);

  const shc = await call('POST', '/farms', A.token, {
    ...FARM_BASE, name: 'M1 Out-of-range Farm', area: 1,
    coordinates: { ...WARANGAL, source: 'manual', confirmed: true }, soilTest: { N: 280, P: 42, K: 43, ph: 6.8 },
  });
  created.farms.push({ token: A.token, id: shc.data.id });
  const shcRec = (await call('POST', `/farms/${shc.data.id}/recommendations`, A.token, { plannedSowingDate: '2027-06-20' })).data;
  check('Input outside the model’s range → model withheld, rule-engine fallback clearly labelled',
    shcRec.engine === 'rule-engine' && shcRec.model.used === false && shcRec.model.outOfRange.some((o) => o.feature === 'N')
    && shcRec.limitations.some((l) => /Crop model not used: Soil N = 280/.test(l))
    && shcRec.shortlist.every((s) => s.score.kind === 'rule-suitability'));

  // ---------------- 6. Selection ----------------
  const pick = rec.shortlist[0];
  const bad = await call('POST', `/farms/${farm.id}/recommendations/${rec.id}/select`, A.token, { crop: 'not-a-shortlisted-crop' });
  check('6. Selecting a crop that was not shortlisted is rejected (400)', bad.status === 400);
  const sel = await call('POST', `/farms/${farm.id}/recommendations/${rec.id}/select`, A.token, { crop: pick.crop });
  check('6. Farmer selects a crop → saved on the farm and the recommendation', sel.status === 200
    && sel.data.farm.selectedCrop.crop === pick.crop && sel.data.farm.selectedCrop.recommendationId === rec.id
    && sel.data.recommendation.selectedCrop === pick.crop && sel.data.calendarPrefill.farmId === farm.id, `${pick.displayName}`);
  const history = await call('GET', `/farms/${farm.id}/recommendations`, A.token);
  check('Recommendation history is listed for the farm', history.status === 200 && history.data.recommendations.some((r) => r.id === rec.id && r.selectedCrop === pick.crop));

  // ---------------- 7. Farm-specific calendar ----------------
  const genBody = { farmId: farm.id, recommendationId: rec.id, crop: sel.data.calendarPrefill.crop, sowingDate: sel.data.calendarPrefill.sowingDate };
  const gen1 = await call('POST', '/calendar/generate', A.token, genBody);
  const plan = gen1.data?.plan;
  if (plan?.id) created.plans.push({ token: A.token, id: plan.id });
  check('7. Farm-specific plan generated (201) and linked to the farm + recommendation', gen1.status === 201
    && plan.farmId === farm.id && plan.recommendationId === rec.id && plan.farmName === 'M1 Main Farm', `${plan?.crop}, ${plan?.events?.length} events`);
  check('7. Area taken from the farm (acres)', plan.areaAcres === 3);
  const gen2 = await call('POST', '/calendar/generate', A.token, genBody);
  check('7. Repeating the same request (refresh / resubmit) returns the same plan, no duplicate', gen2.status === 200 && gen2.data.existing === true && gen2.data.plan.id === plan.id);
  const race = await Promise.all([1, 2, 3].map(() => call('POST', '/calendar/generate', A.token, { ...genBody, sowingDate: '2027-07-01' })));
  const raceIds = new Set(race.map((r) => r.data?.plan?.id));
  raceIds.forEach((id) => id && created.plans.push({ token: A.token, id }));
  check('7. Three simultaneous identical requests create exactly one plan', raceIds.size === 1 && race.filter((r) => r.status === 201).length === 1,
    race.map((r) => r.status).join('/'));
  const farmPlans = (await call('GET', `/calendar?farmId=${farm.id}`, A.token)).data.plans;
  check('8. Calendar list filtered by farm returns only that farm’s plans', farmPlans.length === 2 && farmPlans.every((p) => p.farmId === farm.id));
  check('8. Other farm has no plans', (await call('GET', `/calendar?farmId=${bare.data.id}`, A.token)).data.plans.length === 0);

  const tick = await call('PATCH', `/calendar/${plan.id}/events/0`, A.token, { done: true });
  const reread = (await call('GET', '/calendar', A.token)).data.plans.find((p) => p.id === plan.id);
  check('7. Event tick still works and persists on the farm plan', tick.status === 200 && reread.events[0].done === true);

  // ---------------- 8. Weather for the selected farm ----------------
  const fw = await call('GET', `/farms/${farm.id}/weather`, A.token);
  check('8. Farm weather uses the farm’s confirmed coordinates', fw.status === 200 && fw.data.meta.coordinates.lat === WARANGAL.lat
    && fw.data.meta.coordinates.lon === WARANGAL.lon && fw.data.farm.id === farm.id && fw.data.isDefaultLocation === false);
  check('8. Current vs forecast data are labelled', fw.data.current?.kind === 'model-estimate'
    && fw.data.forecast.every((d) => d.kind === 'forecast') && fw.data.hourly.every((h) => h.kind === 'forecast'));
  const noLoc = await call('GET', `/farms/${bare.data.id}/weather`, A.token);
  check('8. Farm without confirmed location → 422 with what is missing (no default)', noLoc.status === 422 && noLoc.data.missing.includes('coordinates'));

  // ---------------- 9. Authorisation ----------------
  const fid = farm.id;
  const denied = [
    ['GET farm', await call('GET', `/farms/${fid}`, B.token)],
    ['PATCH farm', await call('PATCH', `/farms/${fid}`, B.token, { name: 'pwned' })],
    ['DELETE farm', await call('DELETE', `/farms/${fid}`, B.token)],
    ['POST recommendations', await call('POST', `/farms/${fid}/recommendations`, B.token, { plannedSowingDate: '2027-06-20' })],
    ['GET recommendations', await call('GET', `/farms/${fid}/recommendations`, B.token)],
    ['select crop', await call('POST', `/farms/${fid}/recommendations/${rec.id}/select`, B.token, { crop: pick.crop })],
    ['farm weather', await call('GET', `/farms/${fid}/weather`, B.token)],
    ['generate plan for A’s farm', await call('POST', '/calendar/generate', B.token, { ...genBody, sowingDate: '2027-08-01' })],
    ['tick A’s plan', await call('PATCH', `/calendar/${plan.id}/events/1`, B.token, { done: true })],
  ];
  denied.forEach(([what, r]) => check(`9. Other farmer cannot ${what} (404)`, r.status === 404, `HTTP ${r.status}`));
  await call('DELETE', `/calendar/${plan.id}`, B.token);
  const aStill = (await call('GET', '/calendar', A.token)).data.plans.some((p) => p.id === plan.id);
  check('9. Other farmer’s DELETE does not remove A’s plan', aStill);
  const bFarms = (await call('GET', '/farms', B.token)).data;
  check('9. Other farmer’s farm list does not include A’s farms', Array.isArray(bFarms) && !bFarms.some((f) => f.userId === A.id));
  const afterB = (await call('GET', `/farms/${fid}`, A.token)).data;
  check('9. A’s farm unchanged after B’s attempts', afterB.name === 'M1 Main Farm' && afterB.selectedCrop.crop === pick.crop);
  check('9. No token → 401', (await call('GET', `/farms/${fid}`)).status === 401 && (await call('POST', `/farms/${fid}/recommendations`)).status === 401);

  // ---------------- 10. Existing calendar / agents / weather keep working ----------------
  const legacy1 = await call('POST', '/calendar/generate', A.token, { crop: 'Wheat', sowingDate: '2026-11-20', areaAcres: 2 });
  const legacy2 = await call('POST', '/calendar/generate', A.token, { crop: 'Wheat', sowingDate: '2026-11-20', areaAcres: 2 });
  [legacy1, legacy2].forEach((r) => r.data?.plan?.id && created.plans.push({ token: A.token, id: r.data.plan.id }));
  check('10. Original calendar flow (no farm) unchanged', legacy1.status === 201 && legacy2.status === 201 && !legacy1.data.plan.farmId);
  const legacyDel = await call('DELETE', `/calendar/${legacy2.data.plan.id}`, A.token);
  check('10. Plan delete works', legacyDel.status === 200 && !(await call('GET', '/calendar', A.token)).data.plans.some((p) => p.id === legacy2.data.plan.id));
  const agent = await call('POST', '/agents/crop', A.token, { N: 90, P: 42, K: 43, temperature: 20.9, humidity: 82, ph: 6.5, rainfall: 202.9 });
  check('10. Existing Crop Suggester endpoint unchanged (5 results)', agent.status === 200 && agent.data.recommendations?.length === 5);
  const genW = await call('GET', '/weather', A.token);
  check('10. General weather without a location still works, flagged as default', genW.status === 200 && genW.data.isDefaultLocation === true);
  const genW2 = await call('GET', `/weather?lat=${WARANGAL.lat}&lon=${WARANGAL.lon}&location=Warangal`, A.token);
  check('10. General weather with coordinates works', genW2.status === 200 && genW2.data.isDefaultLocation === false && genW2.data.current.location === 'Warangal');
  check('Weather rejects malformed coordinates (400)', (await call('GET', '/weather?lat=abc&lon=1', A.token)).status === 400);
  const geo = await call('GET', '/weather/geocode?q=Warangal', A.token);
  check('Manual location search (geocode) works', geo.status === 200 && geo.data.results.some((r) => /Warangal/.test(r.name)));

  // ---------------- Summary / cleanup ----------------
  const state = { A: { id: A.id, email: A.email, token: A.token }, B: { id: B.id, email: B.email, token: B.token }, farmId: farm.id, recommendationId: rec.id, planId: plan.id, selectedCrop: pick.crop, created };
  if (KEEP) {
    if (process.env.STATE_FILE) fs.writeFileSync(process.env.STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`\nKEEP=1 → test data kept (accounts ${A.email}, ${B.email}).`);
  } else {
    for (const p of created.plans) await call('DELETE', `/calendar/${p.id}`, p.token);
    for (const f of created.farms) await call('DELETE', `/farms/${f.id}`, f.token);
    console.log(`\nCleaned up ${created.farms.length} farms (with their recommendation history) and ${created.plans.length} plans. Test accounts left: ${A.email}, ${B.email}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(' | ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('Test run crashed:', e); process.exit(2); });
