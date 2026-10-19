#!/usr/bin/env node
// Milestone 4 — plot-level Cultivation Plan.
//   node tests/milestone4-plot-plan.mjs        Env: API_BASE, SKIP_MEMORY=1, KEEP=1
// Runs the scenario on the running API (MongoDB) and on a temporary in-memory API (:5066).
// Throwaway accounts m4-pp-*@kisanai.test; farms deleted afterwards unless KEEP=1.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const KEEP = process.env.KEEP === '1';
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let MODE = '';
const check = (name, cond, detail = '') => {
  results.push({ name: `[${MODE}] ${name}`, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  [${MODE}] ${name}${detail ? `  — ${detail}` : ''}`);
};
const add = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const WARANGAL = { lat: 17.9689, lon: 79.5941, source: 'geocoded', label: 'Warangal, Telangana, India', confirmed: true };
const CARD_X = { N: 210, P: 18, K: 260, ph: 7.8, ec: 0.4, oc: 0.42, s: 9, zn: 0.5, b: 0.6, fe: 6.2, cu: 0.9, mn: 4.1, testedOn: '2026-03-02' };   // N Low
const CARD_Y = { N: 320, P: 30, K: 300, ph: 6.4, ec: 0.3, oc: 0.8, s: 12, zn: 0.9, b: 0.7, fe: 7, cu: 1, mn: 5, testedOn: '2026-03-05' };     // N Medium
const FARM_CARD = { N: 600, P: 40, K: 400, ph: 5.1, testedOn: '2026-01-10' };   // must never reach plot advice

async function scenario(base) {
  const call = async (m, p, t, b) => {
    const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) }, body: b === undefined ? undefined : JSON.stringify(b) });
    let d = null; try { d = await r.json(); } catch { /* */ }
    return { status: r.status, data: d };
  };
  const reg = async (tag) => (await call('POST', '/auth/register', null, { name: `M4 PP ${tag}`, email: `m4-pp-${tag}-${Date.now()}@kisanai.test`, password: 'm4-test-pass-123' })).data;
  const A = await reg('a'), B = await reg('b');
  const ta = A.token, tb = B.token;
  const farmsMade = [];
  const mkFarm = async (body) => { const f = (await call('POST', '/farms', ta, { location: 'Warangal, Telangana', areaUnit: 'acres', ...body })).data; farmsMade.push(f.id); return f; };
  const mkPlot = async (f, body) => (await call('POST', `/farms/${f.id}/plots`, ta, { areaUnit: 'acres', ...body })).data;

  const F = await mkFarm({ name: 'M4 Same-crop Farm', area: 3, coordinates: WARANGAL, soilType: 'Clay', soilTest: FARM_CARD, waterSource: 'Canal' });
  const X = await mkPlot(F, { name: 'Plot X', area: 1, soilType: 'Black Cotton', soilTest: CARD_X, waterAccess: { source: 'Borewell' } });
  const Y = await mkPlot(F, { name: 'Plot Y', area: 1, soilType: 'Red Laterite', soilTest: CARD_Y, waterAccess: { source: 'Canal', method: 'Furrow' } });
  const bx = `/farms/${F.id}/plots/${X.id}`, by = `/farms/${F.id}/plots/${Y.id}`;
  const D = add(20);

  // ---- Two plots, same farm: separate recommendations from their own soil ---------------------
  const rx = (await call('POST', `${bx}/recommendations`, ta, { plannedSowingDate: D })).data;
  const ry = (await call('POST', `${by}/recommendations`, ta, { plannedSowingDate: D })).data;
  const sx = JSON.stringify(rx.inputs), sy = JSON.stringify(ry.inputs);
  check('S1. Each plot gets its own recommendation from its own soil (pH 7.8 vs 6.4); the farm’s soil (pH 5.1) is never used',
    rx.plotId === X.id && ry.plotId === Y.id && rx.id !== ry.id && sx.includes('7.8') && sy.includes('6.4') && !sx.includes('5.1') && !sy.includes('5.1') && rx.plotRevision === 1,
    `${rx.status}/${ry.status}; X: ${(rx.shortlist || []).map((s) => s.crop).join(',')} | Y: ${(ry.shortlist || []).map((s) => s.crop).join(',')}`);

  // Same crop + same sowing date on both plots
  const common = (rx.shortlist || []).map((s) => s.crop).find((c) => (ry.shortlist || []).some((s) => s.crop === c));
  const cropX = common || rx.shortlist[0].crop;
  const noConfirm = await call('POST', `${bx}/recommendations/${rx.id}/select`, ta, { crop: cropX });
  const cyclesAfterNoConfirm = (await call('GET', `${bx}/cycles`, ta)).data.items.length;
  check('S2. Selecting without confirmation → 400 CONFIRMATION_REQUIRED with a preview; no crop cycle is created',
    noConfirm.status === 400 && noConfirm.data.code === 'CONFIRMATION_REQUIRED' && noConfirm.data.preview?.plot?.id === X.id && cyclesAfterNoConfirm === 0);
  const notListed = await call('POST', `${bx}/recommendations/${rx.id}/select`, ta, { crop: 'Banana-not-listed', confirm: true });
  const viaOtherPlot = await call('POST', `${by}/recommendations/${rx.id}/select`, ta, { crop: cropX, confirm: true });
  check('S3. A crop not in the shortlist → 400; X’s recommendation can’t be selected through Plot Y → 404', notListed.status === 400 && viaOtherPlot.status === 404);
  const selX = await call('POST', `${bx}/recommendations/${rx.id}/select`, ta, { crop: cropX, confirm: true });
  const cx = selX.data.cycle;
  let cy;
  if (common) cy = (await call('POST', `${by}/recommendations/${ry.id}/select`, ta, { crop: cropX, confirm: true })).data.cycle;
  else cy = (await call('POST', `${by}/cycles`, ta, { crop: cx.crop, plannedSowingDate: D })).data;
  check('S4. Both plots now have a planned cycle of the same crop on the same date, each on its own plot',
    selX.status === 201 && cx.plotId === X.id && cy?.plotId === Y.id && cx.crop === cy.crop && cx.plannedSowingDate === D && cy.plannedSowingDate === D && cx.source === 'recommendation',
    `${cx.crop} on ${D}${common ? ' (selected on both)' : ' (Y entered manually: no common shortlisted crop)'}`);

  // ---- Separate calendars (needs the migrated index in MongoDB) --------------------------------
  const calX = await call('POST', `${bx}/cycles/${cx.id}/calendar`, ta);
  const calY = await call('POST', `${by}/cycles/${cy.id}/calendar`, ta);
  const ex = calX.data.plan?.events || [], ey = calY.data.plan?.events || [];
  check('S5. Same farm + crop + sowing date: two separate calendars, one per plot, with distinct stable event ids',
    calX.status === 201 && calY.status === 201 && calX.data.plan.id !== calY.data.plan.id && calX.data.plan.plotId === X.id && calY.data.plan.plotId === Y.id &&
    ex.length > 5 && ex.every((e) => /^[a-f0-9]{24}$/.test(e.id)) && !ex.some((e) => ey.some((f) => f.id === e.id)), `${calX.status}/${calY.status}, ${ex.length} events each`);
  const again = await call('POST', `${bx}/cycles/${cx.id}/calendar`, ta);
  check('S6. Creating X’s calendar again returns the same calendar (idempotent, 200, no duplicate)', again.status === 200 && again.data.plan.id === calX.data.plan.id && again.data.created === false);

  // ---- Separate advice -----------------------------------------------------------------------
  const ax = (await call('POST', `${bx}/assess`, ta, {})).data.advice;
  const ay = (await call('POST', `${by}/assess`, ta, {})).data.advice;
  const nX = ax.fertilizer.result?.plan?.perAcre?.nutrients?.N, nY = ay.fertilizer.result?.plan?.perAcre?.nutrients?.N;
  check('S7. Fertilizer per plot from its own soil card: N Low on X (×1.25) vs Medium on Y → different N doses; inputs snapshot is the plot’s card',
    ax.fertilizer.plotId === X.id && ay.fertilizer.plotId === Y.id && nX > nY && ax.fertilizer.inputs.plot.soilTest.ph === 7.8 && ay.fertilizer.inputs.plot.soilTest.ph === 6.4 &&
    ax.fertilizer.sources.some((s) => s.kind === 'calculation'), `N/acre X ${nX} vs Y ${nY}`);
  const ox = ax.irrigation.result?.outlook, oy = ay.irrigation.result?.outlook;
  check('S8. Irrigation per plot: separate records from the same live weather (same 1-acre area → same net need), weather time recorded',
    ax.irrigation.plotId === X.id && ay.irrigation.plotId === Y.id && ax.irrigation.id !== ay.irrigation.id && ax.irrigation.sources.some((s) => s.kind === 'external_api') &&
    !!ax.irrigation.dataTimestamps.weatherFetchedAt && ox?.netMm === oy?.netMm, `${ax.irrigation.status}: net ${ox?.netMm} mm`);
  const liveOk = ax.market.result?.live?.status === 'ok';
  check('S9. Market per plot: separate records for the plot’s crop; model coverage labelled; live prices listed as a source only if they were actually fetched',
    ax.market.plotId === X.id && ay.market.plotId === Y.id && ax.market.result?.crops?.some((c) => c.crop === cx.crop || c.crop === cx.cropKey) &&
    ax.market.sources.map((s) => s.kind).join() === (liveOk ? 'trained_model,external_api' : 'trained_model'), `${ax.market.status}, live ${ax.market.result?.live?.status}`);
  const planX = (await call('GET', `${bx}/plan`, ta)).data, planY = (await call('GET', `${by}/plan`, ta)).data;
  check('S10. Each plan shows only its own plot’s cycle, calendar and advice (all current)',
    planX.cycle.id === cx.id && planY.cycle.id === cy.id && planX.calendar.id === calX.data.plan.id && planY.calendar.id === calY.data.plan.id &&
    ['fertilizer', 'irrigation', 'market'].every((k) => planX.advice[k].assessed && !planX.advice[k].stale && planX.advice[k].plotId === X.id));

  // ---- Farm-level flows keep their own data --------------------------------------------------
  const farmRecs = (await call('GET', `/farms/${F.id}/recommendations`, ta)).data?.recommendations;
  const farmFert = (await call('GET', `/farms/${F.id}/fertilizer?crop=Wheat`, ta)).data;
  const farmNow = (await call('GET', `/farms/${F.id}`, ta)).data;
  check('S11. Farm-level views ignore plot records: no plot runs in the farm’s recommendation history, no plot calendar used, farm soil unchanged',
    Array.isArray(farmRecs) && farmRecs.length === 0 && !farmFert.calendar?.planId && farmNow.soilTest.ph === 5.1 && !farmNow.selectedCrop?.crop,
    `farm recs ${farmRecs?.length}, farm fertilizer calendar ${JSON.stringify(farmFert.calendar)?.slice(0, 60)}`);

  // ---- Changed soil → stale → explicit reassessment ------------------------------------------
  await call('PATCH', bx, ta, { soilTest: { ...CARD_X, N: 400 } });
  const staleX = (await call('GET', `${bx}/plan`, ta)).data, freshY = (await call('GET', `${by}/plan`, ta)).data;
  check('S12. Changing X’s soil marks X’s recommendation and advice stale (reason given); Y stays current',
    staleX.recommendation.stale && staleX.advice.fertilizer.stale && /plot details/.test(staleX.advice.fertilizer.reasons.join()) && !freshY.advice.fertilizer.stale && !freshY.recommendation.stale);
  const re = (await call('POST', `${bx}/assess`, ta, { agents: ['fertilizer'] })).data.advice.fertilizer;
  check('S13. Reassessing records the new inputs and version: current again, N now Medium (dose 50 → 40 kg/acre-type change), plot revision 2',
    !re.stale && re.plotRevision === 2 && re.inputs.plot.soilTest.N === 400 && re.result.plan.perAcre.nutrients.N < nX, `N ${nX} → ${re.result.plan.perAcre.nutrients.N}`);

  // ---- Cycle changes → calendar stale → regenerate keeps ids + ticks --------------------------
  const ev = ex[3];
  const tick = await call('PATCH', `${bx}/cycles/${cx.id}/calendar/events/${ev.id}`, ta, { done: true });
  const tickWrong = await call('PATCH', `${by}/cycles/${cy.id}/calendar/events/${ev.id}`, ta, { done: true });
  const tickBad = await call('PATCH', `${bx}/cycles/${cx.id}/calendar/events/${ev.id}`, ta, { done: 'yes' });
  check('S14. Ticking by stable event id works; the same id through Plot Y’s cycle → 404; non-boolean → 400',
    tick.status === 200 && tick.data.event.done === true && tickWrong.status === 404 && tickBad.status === 400);
  await call('PATCH', `${bx}/cycles/${cx.id}`, ta, { plannedSowingDate: add(27) });
  const afterDate = (await call('GET', `${bx}/plan`, ta)).data;
  check('S15. Changing the planned date bumps the cycle revision: calendar and advice flagged stale with reasons',
    afterDate.cycle.revision === 2 && afterDate.calendar.stale && /sowing date/.test(afterDate.calendar.reasons.join()) && afterDate.advice.irrigation.stale && /dates changed/.test(afterDate.advice.irrigation.reasons.join()));
  const regen = (await call('POST', `${bx}/cycles/${cx.id}/calendar/regenerate`, ta)).data;
  const kept = regen.plan.events.find((e) => e.id === ev.id);
  check('S16. Regenerating: dates move by 7 days, every event keeps its id, the ticked one stays done; calendar current again',
    regen.preservedEvents === regen.totalEvents && kept?.done === true && kept.date !== ev.date && !regen.plan.stale && regen.plan.sowingDate === add(27),
    `${regen.preservedEvents}/${regen.totalEvents} kept; ${ev.date} → ${kept?.date}`);
  const sown = await call('PATCH', `${bx}/cycles/${cx.id}`, ta, { status: 'active', sowingDate: add(0) });
  const afterSown = (await call('GET', `${bx}/plan`, ta)).data;
  check('S17. Marking the crop sown (active, today) → revision 3 and the calendar is stale again (sowing date changed)',
    sown.status === 200 && afterSown.cycle.status === 'active' && afterSown.cycle.revision === 3 && afterSown.calendar.stale);

  // ---- Missing / invalid inputs ---------------------------------------------------------------
  const Z = await mkPlot(F, { name: 'Plot Z', area: 0.5 });
  const bz = `/farms/${F.id}/plots/${Z.id}`;
  const rz = (await call('POST', `${bz}/recommendations`, ta, { plannedSowingDate: D })).data;
  const noCycle = await call('POST', `${bz}/assess`, ta, {});
  const badDates = await Promise.all(['2026-02-31', add(500), 'tomorrow'].map((d) => call('POST', `${bz}/recommendations`, ta, { plannedSowingDate: d })));
  const badAgents = await call('POST', `${bz}/assess`, ta, { agents: ['weather'] });
  check('S18. Plot without a soil test → insufficient_data recommendation (pH missing); assess without a crop cycle → 409; bad dates / agents → 400',
    rz.status === 'insufficient_data' && JSON.stringify(rz.missing).includes('ph') && noCycle.status === 409 && noCycle.data.code === 'NO_ACTIVE_CYCLE' &&
    badDates.every((r) => r.status === 400) && badAgents.status === 400, `${rz.status}`);
  await call('POST', `${bz}/cycles`, ta, { crop: 'Maize', plannedSowingDate: D });
  const zFert = (await call('POST', `${bz}/assess`, ta, { agents: ['fertilizer'] })).data.advice.fertilizer;
  check('S19. Fertilizer without a soil test: the crop’s general dose (Maize 60 kg N/acre, no soil adjustment), marked partial, soil test listed as missing',
    zFert.status === 'partial' && zFert.result?.plan?.perAcre?.nutrients?.N === 60 && zFert.result.missing.some((m) => m.field === 'soilTest') &&
    zFert.result.limitations.some((l) => /general/i.test(l)), `${zFert.status}, N ${zFert.result?.plan?.perAcre?.nutrients?.N}`);
  const F2 = await mkFarm({ name: 'M4 No-location Farm', area: 1 });
  const P2 = await mkPlot(F2, { name: 'Only', area: 1, soilTest: CARD_Y });
  await call('POST', `/farms/${F2.id}/plots/${P2.id}/cycles`, ta, { crop: 'Maize', plannedSowingDate: D });
  const irrNoLoc = (await call('POST', `/farms/${F2.id}/plots/${P2.id}/assess`, ta, { agents: ['irrigation'] })).data.advice.irrigation;
  check('S20. Irrigation without a confirmed farm location → insufficient_data (no weather is assumed)', irrNoLoc.status === 'insufficient_data' && /location/.test(irrNoLoc.error));

  // ---- Stale recommendation can't be selected ---------------------------------------------------
  const W = await mkPlot(F, { name: 'Plot W', area: 0.4, soilType: 'Loamy', soilTest: CARD_Y, waterAccess: { source: 'Borewell' } });
  const bw = `/farms/${F.id}/plots/${W.id}`;
  const rw = (await call('POST', `${bw}/recommendations`, ta, { plannedSowingDate: D })).data;
  await call('PATCH', bw, ta, { soilTest: { ...CARD_Y, ph: 7.2 } });
  const staleSel = await call('POST', `${bw}/recommendations/${rw.id}/select`, ta, { crop: rw.shortlist[0].crop, confirm: true });
  check('S21. Selecting from a recommendation made before the soil changed → 409 STALE_RECOMMENDATION', staleSel.status === 409 && staleSel.data.code === 'STALE_RECOMMENDATION');

  // ---- Concurrency ---------------------------------------------------------------------------
  const rw2 = (await call('POST', `${bw}/recommendations`, ta, { plannedSowingDate: D })).data;
  const burst = await Promise.all([...Array(5)].map(() => call('POST', `${bw}/recommendations/${rw2.id}/select`, ta, { crop: rw2.shortlist[0].crop, confirm: true })));
  const codes = burst.map((r) => r.status).sort().join();
  check('S22. Five simultaneous confirmed selections on one plot → exactly one crop cycle (201 + 4 × 409)', codes === '201,409,409,409,409', codes);
  const cw = burst.find((r) => r.status === 201).data.cycle;
  const calBurst = await Promise.all([...Array(5)].map(() => call('POST', `${bw}/cycles/${cw.id}/calendar`, ta)));
  const calIds = new Set(calBurst.map((r) => r.data.plan?.id));
  check('S23. Five simultaneous calendar requests for one cycle → one calendar (one 201, the rest return it)',
    calIds.size === 1 && calBurst.filter((r) => r.status === 201).length === 1 && calBurst.every((r) => [200, 201].includes(r.status)), calBurst.map((r) => r.status).join(','));

  // ---- Access control ------------------------------------------------------------------------
  const probes = await Promise.all([
    call('GET', `${bx}/plan`, tb), call('POST', `${bx}/recommendations`, tb, { plannedSowingDate: D }), call('GET', `${bx}/recommendations`, tb),
    call('POST', `${bx}/recommendations/${rx.id}/select`, tb, { crop: cropX, confirm: true }), call('POST', `${bx}/assess`, tb, {}),
    call('POST', `${bx}/cycles/${cx.id}/calendar`, tb), call('POST', `${bx}/cycles/${cx.id}/calendar/regenerate`, tb),
    call('PATCH', `${bx}/cycles/${cx.id}/calendar/events/${ev.id}`, tb, { done: false }),
  ]);
  const anon = await Promise.all([call('GET', `${bx}/plan`), call('POST', `${bx}/assess`, null, {})]);
  const stillDone = (await call('GET', `${bx}/plan`, ta)).data.calendar.events.find((e) => e.id === ev.id)?.done;
  check(`S24. Another farmer gets 404 on all ${probes.length} plan endpoints of A’s plot (nothing changes); no token → 401`,
    probes.every((r) => r.status === 404) && anon.every((r) => r.status === 401) && stillDone === true, probes.map((r) => r.status).join(','));

  if (!KEEP) for (const id of farmsMade) await call('DELETE', `/farms/${id}`, ta);
}

async function startMemoryApi(port) {
  const child = spawn('node', ['server.js'], { cwd: BACKEND_DIR, env: { ...process.env, PORT: String(port), MONGODB_URI: '' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { if ((await (await fetch(`http://127.0.0.1:${port}/api/health`)).json()).mode === 'in-memory') return child; } catch { /* */ }
  }
  child.kill(); throw new Error('in-memory API did not start');
}

console.log('Milestone 4 — plot-level Cultivation Plan\n');
MODE = (await (await fetch(`${API}/health`)).json()).mode;
console.log(`=== A. ${API} (${MODE})`);
await scenario(API);
if (process.env.SKIP_MEMORY !== '1') {
  MODE = 'in-memory';
  console.log('\n=== B. temporary in-memory API (:5066)');
  const child = await startMemoryApi(5066);
  try { await scenario('http://127.0.0.1:5066/api'); } finally { child.kill(); }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('Failed:\n' + failed.map((f) => '  ' + f.name).join('\n')); process.exit(1); }
process.exit(0);
