#!/usr/bin/env node
// Milestone 3 — plot and crop-cycle data model (backward compatible).
//
//   node tests/milestone3-plots.mjs
// Env: API_BASE (default http://localhost:5000/api), KEEP=1 keeps test data, SKIP_MEMORY=1 skips the
//      in-memory run.
//
// A. The full HTTP scenario on the running API (MongoDB mode when configured).
// B. The same scenario on a temporary in-memory API instance (port 5057) — both storage modes.
// C. In-process checks: farm deletion cascade in the store, id uniqueness, unit and date rules.
//
// Uses throwaway accounts (m3-*@kisanai.test) and only touches their data. Unless KEEP=1 it deletes
// the farms it created (plots and crop cycles go with them). Expected values (seasons, unit
// conversions, allocation sums) are written out independently of the code under test.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const KEEP = process.env.KEEP === '1';
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEM_PORT = 5057;

const results = [];
let MODE = '';
const check = (name, cond, detail = '') => {
  results.push({ name: `[${MODE}] ${name}`, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  [${MODE}] ${name}${detail ? `  — ${detail}` : ''}`);
};
const callAt = (base) => async (method, p, token, body) => {
  const res = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
};

const todayUTC = () => new Date().toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// Season rule written out independently: Jun–Oct kharif, Nov–Mar rabi, Apr–May zaid.
const seasonFor = (s) => { const m = Number(s.slice(5, 7)); return m >= 6 && m <= 10 ? 'kharif' : m >= 11 || m <= 3 ? 'rabi' : 'zaid'; };
const near = (a, b, tol = 0.00051) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;
const has = (r, ...fields) => r.status === 400 && fields.every((f) => (r.data?.details || []).some((d) => d.includes(f)));

async function scenario(base) {
  const call = callAt(base);
  const created = { farms: [], crops: [] };
  const reg = async (tag) => {
    const r = await call('POST', '/auth/register', null, { name: `M3 Test ${tag}`, email: `m3-${tag}-${Date.now()}@kisanai.test`, password: 'm3-test-pass-123' });
    return { token: r.data?.token, id: r.data?.user?.id };
  };
  const A = await reg('a');
  const B = await reg('b');
  check('Two test accounts registered', A.token && B.token && A.id !== B.id);
  const as = (u) => (method, p, body) => call(method, p, u.token, body);
  const a = as(A), b = as(B);
  const newFarm = async (u, body) => {
    const r = await call('POST', '/farms', u.token, { location: 'Warangal, Telangana', ...body });
    if (r.data?.id) created.farms.push({ id: r.data.id, token: u.token });
    return r.data;
  };

  // ---- Legacy farm (whole-farm details only) ------------------------------------------------
  const legacySoil = { N: 250, P: 12, K: 300, ph: 7.9, testedOn: '2026-02-01' };
  const F1 = await newFarm(A, { name: 'M3 Two Plot Farm', area: 2, areaUnit: 'acres', soilType: 'Black Cotton', waterSource: 'Borewell', crops: ['Cotton', 'Soybean'] });
  await a('PATCH', `/farms/${F1.id}`, { soilTest: legacySoil });
  const f1Before = (await a('GET', `/farms/${F1.id}`)).data;
  let r = await a('GET', `/farms/${F1.id}/plots`);
  check('P1. Farm without plots: empty plot list, whole-farm details summarised, full area unallocated',
    r.status === 200 && r.data.plots.length === 0 && r.data.wholeFarm.hasFarmLevelData && r.data.wholeFarm.soilCardValues === 4 &&
    r.data.allocation.farmAcres === 2 && r.data.allocation.allocatedAcres === 0 && r.data.allocation.unallocatedAcres === 2,
    JSON.stringify(r.data.allocation));
  check('P2. Farm detail and list carry a plot summary (0 plots)',
    f1Before.plotSummary?.count === 0 && (await a('GET', '/farms')).data.find((f) => f.id === F1.id)?.plotSummary?.count === 0);

  // ---- The product example: two 1-acre plots, different crops/soils -------------------------
  r = await a('POST', `/farms/${F1.id}/plots`, { name: 'Plot A', area: 1, areaUnit: 'acres', copyFromFarm: true });
  const PA = r.data;
  check('P3. Plot A created with opt-in copy of the whole-farm soil, water and crop history',
    r.status === 201 && PA.soilType === 'Black Cotton' && JSON.stringify(PA.soilTest) === JSON.stringify(legacySoil) &&
    PA.waterAccess.source === 'Borewell' && PA.waterAccess.irrigated === true && PA.previousCrops.map((p) => p.crop).join() === 'Cotton,Soybean' &&
    PA.previousCrops.every((p) => /^[a-f0-9]{24}$/.test(p.id)) && ['soilType', 'soilTest', 'waterAccess', 'previousCrops'].every((f) => PA.copiedFromFarm?.fields.includes(f)),
    `copied: ${PA.copiedFromFarm?.fields}`);
  const f1After = (await a('GET', `/farms/${F1.id}`)).data;
  check('P4. Copying never modifies the farm record (soil, crops, updatedAt identical)',
    JSON.stringify(f1After.soilTest) === JSON.stringify(f1Before.soilTest) && JSON.stringify(f1After.crops) === JSON.stringify(f1Before.crops) &&
    f1After.updatedAt === f1Before.updatedAt && f1After.soilType === f1Before.soilType);

  const soilB = { N: 180, P: 30, K: 150, ph: 6.2, oc: 0.6, testedOn: '2026-01-15' };
  r = await a('POST', `/farms/${F1.id}/plots`, {
    name: 'Plot B', area: 40, areaUnit: 'guntha', soilType: 'Red Laterite', soilTest: soilB,
    waterAccess: { source: 'Canal', method: 'Furrow' }, previousCrops: [{ crop: 'Maize', season: 'kharif', year: 2025 }],
  });
  const PB = r.data;
  check('P5. Plot B: 40 guntha = 1 acre = 0.4047 ha; its own soil, water and crop history',
    r.status === 201 && PB.areaAcres === 1 && near(PB.areaHectares, 0.4047) && PB.soilTest.N === 180 && PB.waterAccess.method === 'Furrow' &&
    PB.previousCrops[0].crop === 'Maize' && PB.previousCrops[0].year === 2025 && PB.copiedFromFarm === null);
  r = await a('GET', `/farms/${F1.id}/plots`);
  check('P6. List: both plots in creation order; 2 of 2 acres allocated',
    r.data.plots.map((p) => p.name).join() === 'Plot A,Plot B' && r.data.allocation.allocatedAcres === 2 && r.data.allocation.unallocatedAcres === 0 && r.data.allocation.checkable);

  const pbBefore = (await a('GET', `/farms/${F1.id}/plots/${PB.id}`)).data;
  r = await a('PATCH', `/farms/${F1.id}/plots/${PA.id}`, { soilTest: { ...legacySoil, ph: 7.2 } });
  const pbAfter = (await a('GET', `/farms/${F1.id}/plots/${PB.id}`)).data;
  check('P7. Isolation: editing Plot A’s soil changes only Plot A (revision 1 → 2; Plot B untouched)',
    r.status === 200 && r.data.soilTest.ph === 7.2 && r.data.inputsRevision === 2 && r.data.changedInputs.join() === 'soilTest' &&
    JSON.stringify(pbAfter.soilTest) === JSON.stringify(pbBefore.soilTest) && pbAfter.inputsRevision === 1 && pbAfter.updatedAt === pbBefore.updatedAt);
  r = await a('PATCH', `/farms/${F1.id}/plots/${PA.id}`, { name: 'Plot A', soilTest: { ...legacySoil, ph: 7.2 }, previousCrops: PA.previousCrops });
  check('P8. Re-sending identical values changes nothing (revision stays 2, previous-crop ids kept)',
    r.status === 200 && r.data.inputsRevision === 2 && r.data.changedInputs.length === 0 && r.data.previousCrops.map((p) => p.id).join() === PA.previousCrops.map((p) => p.id).join());

  // ---- Area allocation ----------------------------------------------------------------------
  r = await a('POST', `/farms/${F1.id}/plots`, { name: 'Plot C', area: 0.5, areaUnit: 'acres' });
  check('P9. A plot beyond the farm area is refused (2.5 > 2 acres) with the allocation explained',
    r.status === 409 && r.data.code === 'AREA_EXCEEDS_FARM' && r.data.allocation.allocatedAcres === 2.5, r.data?.error);
  r = await a('PATCH', `/farms/${F1.id}/plots/${PB.id}`, { area: 1.5, areaUnit: 'acres' });
  check('P10. Enlarging Plot B beyond the farm is refused; Plot B unchanged',
    r.status === 409 && (await a('GET', `/farms/${F1.id}/plots/${PB.id}`)).data.areaAcres === 1);
  r = await a('PATCH', `/farms/${F1.id}`, { area: 1.5 });
  const shrinkRefused = r.status === 409 && r.data.code === 'AREA_BELOW_PLOTS' && (await a('GET', `/farms/${F1.id}`)).data.area === 2;
  r = await a('PATCH', `/farms/${F1.id}`, { area: 3 });
  const grown = r.status === 200;
  r = await a('POST', `/farms/${F1.id}/plots`, { name: 'Plot C', area: 0.5, areaUnit: 'acres' });
  const PC = r.data;
  check('P11. Farm can’t shrink below its plots (1.5 < 2 refused); after growing to 3 acres Plot C fits',
    shrinkRefused && grown && r.status === 201 && PC.areaAcres === 0.5);

  const F2 = await newFarm(A, { name: 'M3 Hectare Farm', area: 2, areaUnit: 'hectares' });
  const e1 = await a('POST', `/farms/${F2.id}/plots`, { name: 'East', area: 1, areaUnit: 'hectares' });
  const e2 = await a('POST', `/farms/${F2.id}/plots`, { name: 'West', area: 1, areaUnit: 'hectares' });
  const e3 = await a('POST', `/farms/${F2.id}/plots`, { name: 'Corner', area: 100, areaUnit: 'sqm' });
  check('P12. Units: 2 × 1 ha fill a 2 ha farm exactly (rounding tolerated); 100 m² more is refused',
    e1.status === 201 && e2.status === 201 && near(e1.data.areaAcres, 2.4711) && e3.status === 409, `third: ${e3.status}`);
  const F3 = await newFarm(A, { name: 'M3 Bigha Farm', area: 5, areaUnit: 'bigha' });
  const bg = await a('POST', `/farms/${F3.id}/plots`, { name: 'Bigha plot', area: 2, areaUnit: 'bigha' });
  check('P13. Bigha is never converted: plot saved with areaAcres null, area check reported as not possible',
    bg.status === 201 && bg.data.areaAcres === null && bg.data.allocation.checkable === false && bg.data.warnings.some((w) => /bigha/i.test(w)));

  // ---- Validation -----------------------------------------------------------------------------
  r = await a('POST', `/farms/${F1.id}/plots`, {
    name: '', area: 0, areaUnit: 'furlong', soilTest: { ph: 15, testedOn: '2026-02-31' }, previousCrops: [{ crop: 'Maize', season: 'monsoon', year: 1980 }],
    waterAccess: { source: 'Lake' },
  });
  check('P14. Invalid input → 400 naming every bad field (name, area, unit, pH, impossible date, season, year, water source)',
    has(r, 'name', 'area must', 'areaUnit', 'soilTest.ph', 'soilTest.testedOn', 'season', 'year', 'waterAccess.source'), r.data?.details?.length + ' errors');
  const futureTest = await a('PATCH', `/farms/${F1.id}/plots/${PA.id}`, { soilTest: { ph: 7, testedOn: addDays(todayUTC(), 3) } });
  const rainfedDrip = await a('PATCH', `/farms/${F1.id}/plots/${PA.id}`, { waterAccess: { source: 'Rain-fed', method: 'Drip' } });
  const htmlName = await a('PATCH', `/farms/${F1.id}/plots/${PA.id}`, { name: '<script>x</script>' });
  check('P15. Future soil-test date, rain-fed plot with drip, and markup in a name are rejected',
    has(futureTest, 'future') && has(rainfedDrip, 'rain-fed') && has(htmlName, 'name'));
  r = await a('POST', `/farms/${F1.id}/plots`, { name: '  plot   a ', area: 0.1, areaUnit: 'acres' });
  const telugu = await a('POST', `/farms/${F1.id}/plots`, { name: 'తూర్పు పొలం', area: 0.1, areaUnit: 'acres' });
  check('P16. Names are unique per farm ignoring case/spaces (409); names in Telugu are accepted',
    r.status === 409 && r.data.code === 'DUPLICATE_NAME' && telugu.status === 201, `${r.status} ${telugu.status}`);
  r = await a('POST', `/farms/${F1.id}/plots`, {
    name: 'Sneaky', area: 0.1, areaUnit: 'acres', userId: B.id, farmId: F2.id, inputsRevision: 99, status: 'archived', id: 'x', nameKey: 'zzz',
  });
  const SN = r.data;
  check('P17. Owner, farm, status, revision and ids are never taken from the body',
    r.status === 201 && SN.farmId === F1.id && SN.status === 'active' && SN.inputsRevision === 1 && /^[a-f0-9]{24}$/.test(SN.id));

  // ---- Ownership ------------------------------------------------------------------------------
  const FB = await newFarm(B, { name: 'M3 B Farm', area: 1, areaUnit: 'acres' });
  const cyA = (await a('POST', `/farms/${F1.id}/plots/${PA.id}/cycles`, { crop: 'cotton', plannedSowingDate: addDays(todayUTC(), 20) })).data;
  const probes = [
    ['GET', `/farms/${F1.id}/plots`], ['POST', `/farms/${F1.id}/plots`, { name: 'Intruder', area: 0.1, areaUnit: 'acres' }],
    ['GET', `/farms/${F1.id}/plots/${PA.id}`], ['PATCH', `/farms/${F1.id}/plots/${PA.id}`, { name: 'Hacked' }],
    ['DELETE', `/farms/${F1.id}/plots/${SN.id}`], ['GET', `/farms/${FB.id}/plots/${PA.id}`], ['PATCH', `/farms/${FB.id}/plots/${PA.id}`, { name: 'Hacked' }],
    ['GET', `/farms/${F1.id}/plots/${PA.id}/cycles`], ['POST', `/farms/${F1.id}/plots/${PA.id}/cycles`, { crop: 'Maize', plannedSowingDate: addDays(todayUTC(), 30) }],
    ['GET', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA.id}`], ['PATCH', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA.id}`, { status: 'abandoned' }],
    ['POST', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA.id}/observations`, { text: 'x' }], ['GET', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA.id}/observations`],
  ];
  const statuses = [];
  for (const [m, p, body] of probes) statuses.push((await b(m, p, body)).status);
  const paStill = (await a('GET', `/farms/${F1.id}/plots/${PA.id}`)).data;
  const cyStill = (await a('GET', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA.id}`)).data;
  check(`P18. Another farmer gets 404 on all ${probes.length} plot / cycle / observation endpoints of A’s farm; nothing changed`,
    statuses.every((s) => s === 404) && paStill.name === 'Plot A' && cyStill.status === 'planned' && (await a('GET', `/farms/${F1.id}/plots/${SN.id}`)).status === 200,
    statuses.join(','));
  const unauth = await call('GET', `/farms/${F1.id}/plots`, null);
  const bad = await Promise.all([a('GET', '/farms/not-an-id/plots'), a('GET', `/farms/${F1.id}/plots/xyz`), a('GET', `/farms/${F1.id}/plots/${PA.id}/cycles/123`)]);
  check('P19. No token → 401; malformed farm / plot / cycle ids → 404', unauth.status === 401 && bad.every((x) => x.status === 404), bad.map((x) => x.status).join(','));
  const viaWrongPlot = await a('GET', `/farms/${F1.id}/plots/${PB.id}/cycles/${cyA.id}`);
  const patchWrongPlot = await a('PATCH', `/farms/${F1.id}/plots/${PB.id}/cycles/${cyA.id}`, { status: 'abandoned' });
  const plotViaWrongFarm = await a('GET', `/farms/${F2.id}/plots/${PA.id}`);
  check('P20. A cycle is never reachable through another plot, nor a plot through another farm — even for its owner',
    viaWrongPlot.status === 404 && patchWrongPlot.status === 404 && plotViaWrongFarm.status === 404 &&
    (await a('GET', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA.id}`)).data.status === 'planned');

  // ---- Crop cycles ----------------------------------------------------------------------------
  const plannedDate = addDays(todayUTC(), 20);
  check('P21. Planned cycle: crop resolved to the knowledge base ("cotton" → Cotton), season from the planned date, plot revision recorded',
    cyA.status === 'planned' && cyA.isOpen === true && cyA.cropKey === 'Cotton' && cyA.season === seasonFor(plannedDate) && cyA.plotRevisionAtStart === 2 && cyA.plotId === PA.id,
    `${cyA.cropKey} ${cyA.season}`);
  r = await a('POST', `/farms/${F1.id}/plots/${PA.id}/cycles`, { crop: 'Maize', plannedSowingDate: addDays(todayUTC(), 40) });
  check('P22. A second open cycle on the same plot → 409', r.status === 409 && r.data.code === 'OPEN_CYCLE_EXISTS');
  const race = await Promise.all([...Array(5)].map((_, i) => a('POST', `/farms/${F1.id}/plots/${PB.id}/cycles`, { crop: 'Wheat', plannedSowingDate: addDays(todayUTC(), 30 + i) })));
  const raceCodes = race.map((x) => x.status).sort();
  const openB = (await a('GET', `/farms/${F1.id}/plots/${PB.id}/cycles`)).data.items.filter((c) => c.isOpen);
  check('P23. Five simultaneous "start cycle" requests on one plot → exactly one created', raceCodes.join() === '201,409,409,409,409' && openB.length === 1, raceCodes.join(','));
  const cyB = openB[0];
  const v = await Promise.all([
    a('POST', `/farms/${F1.id}/plots/${PC.id}/cycles`, { plannedSowingDate: plannedDate }),
    a('POST', `/farms/${F1.id}/plots/${PC.id}/cycles`, { crop: 'Maize' }),
    a('POST', `/farms/${F1.id}/plots/${PC.id}/cycles`, { crop: 'Maize', plannedSowingDate: addDays(todayUTC(), 500) }),
    a('POST', `/farms/${F1.id}/plots/${PC.id}/cycles`, { crop: 'Maize', status: 'active' }),
    a('POST', `/farms/${F1.id}/plots/${PC.id}/cycles`, { crop: 'Maize', sowingDate: addDays(todayUTC(), 2) }),
    a('POST', `/farms/${F1.id}/plots/${PC.id}/cycles`, { crop: 'Maize', plannedSowingDate: plannedDate, season: 'monsoon' }),
  ]);
  check('P24. Cycle validation: crop, planned date, date range, sowing date (not in the future) and season are checked',
    has(v[0], 'crop') && has(v[1], 'plannedSowingDate') && has(v[2], 'plannedSowingDate') && has(v[3], 'sowingDate') && has(v[4], 'future') && has(v[5], 'season'));

  const T = (body) => a('PATCH', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA.id}`, body);
  const sowed = addDays(todayUTC(), -1);
  const t1 = await T({ status: 'harvested', harvest: { date: todayUTC() } });
  const t2 = await T({ status: 'active' });
  const t3 = await T({ status: 'active', sowingDate: sowed });
  const t4 = await T({ status: 'harvested', harvest: { date: addDays(sowed, -1) } });
  const t5 = await T({ status: 'harvested', harvest: { date: todayUTC(), quantity: 12, unit: 'quintal' } });
  const t6 = await T({ status: 'active' });
  const t7 = await T({ sowingDate: addDays(todayUTC(), -3) });
  const t8 = await T({ notes: 'Good harvest despite late rain' });
  check('P25. Status rules: planned→harvested refused; sowing date needed to go active; harvest not before sowing',
    t1.status === 409 && t2.status === 400 && t3.status === 200 && t3.data.status === 'active' && t3.data.sowingDate === sowed && has(t4, 'harvest.date'),
    [t1, t2, t3, t4].map((x) => x.status).join(','));
  check('P26. Harvest closes the cycle (isOpen false, quantity kept); a closed cycle only accepts notes',
    t5.status === 200 && t5.data.status === 'harvested' && t5.data.isOpen === false && !!t5.data.closedAt && t5.data.harvest.quantity === 12 &&
    t6.status === 409 && t7.status === 409 && t8.status === 200 && t8.data.notes.startsWith('Good harvest'), [t5, t6, t7, t8].map((x) => x.status).join(','));
  r = await a('POST', `/farms/${F1.id}/plots/${PA.id}/cycles`, { crop: 'Wheat', plannedSowingDate: addDays(todayUTC(), 25) });
  const cyA2 = r.data;
  const cropEdit = await a('PATCH', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA2.id}`, { crop: 'Brinjal' });
  await a('PATCH', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA2.id}`, { status: 'active', sowingDate: todayUTC() });
  const cropEditActive = await a('PATCH', `/farms/${F1.id}/plots/${PA.id}/cycles/${cyA2.id}`, { crop: 'Maize' });
  check('P27. After the harvest a new cycle can start; crop can change only while planned (unknown crop → cropKey null)',
    r.status === 201 && cropEdit.status === 200 && cropEdit.data.crop === 'Brinjal' && cropEdit.data.cropKey === null && cropEditActive.status === 409);

  for (let i = 0; i < 3; i++) {
    const c = await a('POST', `/farms/${F1.id}/plots/${PC.id}/cycles`, { crop: ['Maize', 'Onion', 'Tomato'][i], plannedSowingDate: addDays(todayUTC(), 10 + i) });
    await a('PATCH', `/farms/${F1.id}/plots/${PC.id}/cycles/${c.data.id}`, { status: 'abandoned' });
  }
  const pg1 = await a('GET', `/farms/${F1.id}/plots/${PC.id}/cycles?limit=2`);
  const pg2 = await a('GET', `/farms/${F1.id}/plots/${PC.id}/cycles?limit=2&cursor=${pg1.data.nextCursor}`);
  const crops = [...pg1.data.items, ...pg2.data.items].map((c) => c.crop);
  const badCursor = await a('GET', `/farms/${F1.id}/plots/${PC.id}/cycles?cursor=zzz`);
  const badLimit = await a('GET', `/farms/${F1.id}/plots/${PC.id}/cycles?limit=0`);
  check('P28. Cycle history pages newest-first with a cursor (2 + 1, no repeats); bad cursor / limit → 400',
    crops.join() === 'Tomato,Onion,Maize' && pg2.data.nextCursor === null && pg1.data.items.every((c) => c.latestObservations === undefined) &&
    badCursor.status === 400 && badLimit.status === 400, crops.join());

  const O = (body) => a('POST', `/farms/${F1.id}/plots/${PB.id}/cycles/${cyB.id}/observations`, body);
  const o1 = await O({ date: addDays(todayUTC(), -10), type: 'growth_stage', text: 'Land prepared' });
  const o2 = await O({ date: addDays(todayUTC(), -5), type: 'pest', text: 'Aphids on 5% of plants', value: 5, unit: '%' });
  const o3 = await O({ type: 'note', text: 'Field visit' });
  const op1 = await a('GET', `/farms/${F1.id}/plots/${PB.id}/cycles/${cyB.id}/observations?limit=2`);
  const op2 = await a('GET', `/farms/${F1.id}/plots/${PB.id}/cycles/${cyB.id}/observations?limit=2&cursor=${op1.data.nextCursor}`);
  check('P29. Observations get stable ids and page newest-first (today, −5 d | −10 d)',
    [o1, o2, o3].every((x) => x.status === 201 && /^[a-f0-9]{24}$/.test(x.data.id)) && op1.data.items.map((o) => o.id).join() === [o3.data.id, o2.data.id].join() &&
    op2.data.items[0]?.id === o1.data.id && op2.data.nextCursor === null && op1.data.total === 3 && o2.data.value === 5);
  const ov = await Promise.all([O({ date: addDays(todayUTC(), 1), text: 'x' }), O({ type: 'rumour', text: 'x' }), O({ text: '' }), O({ text: 'x'.repeat(1001) }), O({ text: 'x', value: 'abc' })]);
  const del1 = await a('DELETE', `/farms/${F1.id}/plots/${PB.id}/cycles/${cyB.id}/observations/${o1.data.id}`);
  const del2 = await a('DELETE', `/farms/${F1.id}/plots/${PB.id}/cycles/${cyB.id}/observations/${o1.data.id}`);
  const cyBView = (await a('GET', `/farms/${F1.id}/plots/${PB.id}/cycles/${cyB.id}`)).data;
  check('P30. Observation validation (future date, type, empty/long text, value); delete by id once; counts kept',
    ov.every((x) => x.status === 400) && del1.status === 200 && del2.status === 404 && cyBView.observationCount === 2 && cyBView.latestObservations.length === 2,
    ov.map((x) => x.status).join(','));

  // ---- Archive / delete -------------------------------------------------------------------------
  const delWithHistory = await a('DELETE', `/farms/${F1.id}/plots/${PC.id}`);
  const archiveOpen = await a('PATCH', `/farms/${F1.id}/plots/${PB.id}`, { status: 'archived' });
  const archC = await a('PATCH', `/farms/${F1.id}/plots/${PC.id}`, { status: 'archived' });
  const allocAfterArchive = (await a('GET', `/farms/${F1.id}/plots`)).data;
  const editArchived = await a('PATCH', `/farms/${F1.id}/plots/${PC.id}`, { name: 'Renamed' });
  const cycleOnArchived = await a('POST', `/farms/${F1.id}/plots/${PC.id}/cycles`, { crop: 'Maize', plannedSowingDate: plannedDate });
  const restoreC = await a('PATCH', `/farms/${F1.id}/plots/${PC.id}`, { status: 'active' });
  check('P31. Plot with history can’t be deleted (409) but can be archived; a plot with an open cycle can’t be archived',
    delWithHistory.status === 409 && delWithHistory.data.code === 'PLOT_HAS_HISTORY' && archiveOpen.status === 409 && archiveOpen.data.code === 'OPEN_CYCLE' && archC.status === 200 && archC.data.status === 'archived');
  check('P32. Archived plots leave the allocation, can’t be edited or get cycles, and can be restored',
    near(allocAfterArchive.allocation.allocatedAcres, 2.2) && allocAfterArchive.counts.archived === 1 && !allocAfterArchive.plots.some((p) => p.id === PC.id) &&
    editArchived.status === 409 && cycleOnArchived.status === 409 && restoreC.status === 200 && restoreC.data.status === 'active',
    `allocated ${allocAfterArchive.allocation.allocatedAcres}`);
  const delSN = await a('DELETE', `/farms/${F1.id}/plots/${SN.id}`);
  check('P33. A plot without history can be deleted', delSN.status === 200 && (await a('GET', `/farms/${F1.id}/plots/${SN.id}`)).status === 404);
  await a('PATCH', `/farms/${F1.id}/plots/${telugu.data.id}`, { status: 'archived' });
  const reuse = await a('POST', `/farms/${F1.id}/plots`, { name: 'తూర్పు పొలం', area: 0.1, areaUnit: 'acres' });
  const restoreDup = await a('PATCH', `/farms/${F1.id}/plots/${telugu.data.id}`, { status: 'active' });
  check('P34. An archived plot’s name can be reused; restoring it then → 409 duplicate name',
    reuse.status === 201 && restoreDup.status === 409 && restoreDup.data.code === 'DUPLICATE_NAME');
  const summary = (await a('GET', '/farms')).data.find((f) => f.id === F1.id)?.plotSummary;
  check('P35. Farm list summary: 4 active plots, 2.6 acres allocated, 2 open cycles (Plot A brinjal, Plot B wheat)',
    summary?.count === 4 && near(summary.allocatedAcres, 2.6) && summary.openCycles === 2, JSON.stringify(summary));

  // ---- Legacy behaviour + fixes ---------------------------------------------------------------
  const f1Now = (await a('GET', `/farms/${F1.id}`)).data;
  check('P36. The farm’s own (whole-farm) soil test and crops are still exactly as before',
    JSON.stringify(f1Now.soilTest) === JSON.stringify(legacySoil) && f1Now.crops.join() === 'Cotton,Soybean');
  const badFarmDate = await a('PATCH', `/farms/${F3.id}`, { soilTest: { ph: 7, testedOn: '2026-02-31' } });
  const futureFarmDate = await a('PATCH', `/farms/${F3.id}`, { soilTest: { ph: 7, testedOn: addDays(todayUTC(), 5) } });
  check('P37. Farm soil-test dates are now strict: 2026-02-31 and future dates → 400 (were silently accepted / shifted)',
    badFarmDate.status === 400 && /testedOn/.test(badFarmDate.data.error) && futureFarmDate.status === 400);

  const cBad = await a('POST', '/crops', { farmId: FB.id, name: 'Wheat', area: 1 });
  const cOk = await a('POST', '/crops', { farmId: F1.id, name: 'Wheat', area: 1, userId: B.id });
  if (cOk.data?.id) created.crops.push(cOk.data.id);
  const cMove = await a('PATCH', `/crops/${cOk.data?.id}`, { userId: B.id, name: 'Wheat HD-2967' });
  const bCrops = (await b('GET', '/crops')).data;
  const aCrops = (await a('GET', '/crops')).data;
  const cFarm = await a('PATCH', `/crops/${cOk.data?.id}`, { farmId: FB.id });
  const cBadId = await Promise.all([a('PATCH', '/crops/not-an-id', { name: 'x' }), a('DELETE', '/crops/not-an-id')]);
  check('P38. /api/crops: another farmer’s farmId → 404; userId in the body is ignored (create and update)',
    cBad.status === 404 && cOk.status === 201 && cMove.status === 200 && cMove.data.name === 'Wheat HD-2967' &&
    !bCrops.some((c) => c.id === cOk.data.id) && aCrops.some((c) => c.id === cOk.data.id));
  check('P39. /api/crops: moving a record to another farmer’s farm → 404; malformed ids → 404 (not 500)',
    cFarm.status === 404 && cBadId.every((x) => x.status === 404), cBadId.map((x) => x.status).join(','));

  // ---- Farm deletion cascades -------------------------------------------------------------------
  const delF2 = await a('DELETE', `/farms/${F2.id}`);
  check('P40. Deleting a farm removes it with its plots (plot URLs → 404)',
    delF2.status === 200 && (await a('GET', `/farms/${F2.id}/plots`)).status === 404 && (await a('GET', `/farms/${F2.id}/plots/${e1.data.id}`)).status === 404);
  created.farms = created.farms.filter((f) => f.id !== F2.id);

  if (!KEEP) {
    for (const id of created.crops) await a('DELETE', `/crops/${id}`);
    for (const f of created.farms) await call('DELETE', `/farms/${f.id}`, f.token);
    console.log(`  cleaned up ${created.farms.length + 1} farms (with their plots and crop cycles) and ${created.crops.length} crop record(s); test accounts remain`);
  }
}

// ---- C. In-process checks (in-memory store) ---------------------------------------------------
async function inProcess() {
  globalThis.__DB_MODE__ = 'in-memory';
  const store = await import('../src/database/repositories/store.js');
  const { toAcres } = await import('../src/services/units.js');
  const { isDate } = await import('../src/services/validation.js');
  const farm = await store.farms.create({ userId: 'u1', name: 'F', location: 'X', area: 2, areaUnit: 'acres' });
  const plot = await store.plots.create({ userId: 'u1', farmId: farm.id, name: 'P', nameKey: 'p', status: 'active', area: 1, areaUnit: 'acres', areaAcres: 1, previousCrops: [] });
  await store.cropCycles.create({ userId: 'u1', farmId: farm.id, plotId: plot.id, crop: 'Maize', season: 'kharif', status: 'planned', isOpen: true, observations: [] });
  let conflict = null;
  try { await store.cropCycles.create({ userId: 'u1', farmId: farm.id, plotId: plot.id, crop: 'Rice', season: 'kharif', status: 'planned', isOpen: true, observations: [] }); }
  catch (e) { conflict = e.code; }
  check('C1. Store refuses a second open cycle on a plot (in-memory mirror of the unique index)', conflict === 'OPEN_CYCLE_EXISTS');
  await store.farms.remove('u1', farm.id);
  const left = (await store.plots.listForFarm('u1', farm.id, { status: 'all' })).length + (await store.cropCycles.listForPlot('u1', plot.id)).items.length;
  check('C2. Deleting a farm in the store leaves no orphan plots or crop cycles', left === 0);
  const ids = new Set([...Array(20000)].map(() => store.newId()));
  check('C3. 20 000 ids generated back-to-back are unique 24-hex strings (Date.now() ids collided)', ids.size === 20000 && [...ids].every((i) => /^[a-f0-9]{24}$/.test(i)));
  check('C4. Unit table: 40 guntha = 100 cents = 4046.8564224 m² = 1 acre; bigha → not converted',
    toAcres(40, 'guntha') === 1 && toAcres(100, 'cents') === 1 && toAcres(4046.8564224, 'sqm') === 1 && toAcres(3, 'bigha') === null);
  check('C5. Dates: 2026-02-31, 2026-02-29, 2026-04-31 rejected; 2028-02-29 accepted',
    !isDate('2026-02-31') && !isDate('2026-02-29') && !isDate('2026-04-31') && isDate('2028-02-29'));
}

async function startMemoryApi() {
  const child = spawn('node', ['server.js'], { cwd: BACKEND_DIR, env: { ...process.env, PORT: String(MEM_PORT), MONGODB_URI: '' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { const h = await (await fetch(`http://127.0.0.1:${MEM_PORT}/api/health`)).json(); if (h.mode === 'in-memory') return child; } catch { /* starting */ }
  }
  child.kill();
  throw new Error('in-memory API did not start');
}

console.log('Milestone 3 — plots and crop cycles\n');
const health = await (await fetch(`${API}/health`)).json();
MODE = health.mode;
console.log(`=== A. HTTP scenario → ${API} (${health.mode})`);
await scenario(API);
if (process.env.SKIP_MEMORY !== '1') {
  MODE = 'in-memory';
  console.log(`\n=== B. Same scenario → temporary in-memory API on :${MEM_PORT}`);
  const child = await startMemoryApi();
  try { await scenario(`http://127.0.0.1:${MEM_PORT}/api`); } finally { child.kill(); }
}
MODE = 'unit';
console.log('\n=== C. In-process checks');
await inProcess();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('Failed:\n' + failed.map((f) => '  ' + f.name).join('\n')); process.exit(1); }
process.exit(0);
