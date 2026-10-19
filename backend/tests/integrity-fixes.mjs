#!/usr/bin/env node
// Stage B — integrity fixes (regression tests).
//
//   node tests/integrity-fixes.mjs
// Env: API_BASE (default http://localhost:5000/api), SKIP_MEMORY=1, KEEP=1.
//
// A. HTTP on the running API (MongoDB) and B. on a temporary in-memory API (:5063):
//    auth on agent / orchestrator / market / weather routes, farm & plot ownership, honest crop-model
//    use, disease output without confidence or photo analysis, photo validation + private owner-only
//    storage, fertilizer split through the API, concurrency-safe plot allocation.
// C. In-process: nitrogen split / balance for every crop rule, JWT secret hardening (spawned servers),
//    photo file permissions, uploads no longer tracked by Git.
// Throwaway accounts (m4-int-*@kisanai.test); farms are deleted unless KEEP=1.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const KEEP = process.env.KEEP === '1';
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(BACKEND_DIR, 'package.json'));
const jwt = require('jsonwebtoken');

const results = [];
let MODE = '';
const check = (name, cond, detail = '') => {
  results.push({ name: `[${MODE}] ${name}`, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  [${MODE}] ${name}${detail ? `  — ${detail}` : ''}`);
};
const near = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;
const r1 = (v) => Math.round(v * 10) / 10;
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function client(base) {
  const call = async (method, p, token, body) => {
    const res = await fetch(base + p, {
      method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null; try { data = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, data };
  };
  const form = async (p, token, fields, file) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    if (file) fd.append('image', new Blob([file.bytes], { type: file.type }), file.name);
    const res = await fetch(base + p, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
    let data = null; try { data = await res.json(); } catch { /* */ }
    return { status: res.status, data };
  };
  const raw = (p, token) => fetch(base + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { call, form, raw };
}

async function scenario(base) {
  const { call, form, raw } = client(base);
  const farmsToDelete = [];
  const reg = async (tag) => {
    const r = await call('POST', '/auth/register', null, { name: `M4 Int ${tag}`, email: `m4-int-${tag}-${Date.now()}@kisanai.test`, password: 'm4-test-pass-123' });
    return { token: r.data?.token, id: r.data?.user?.id };
  };
  const A = await reg('a'), B = await reg('b');
  const farm = async (u, body) => {
    const r = await call('POST', '/farms', u.token, { location: 'Warangal, Telangana', areaUnit: 'acres', ...body });
    if (r.data?.id) farmsToDelete.push({ id: r.data.id, token: u.token });
    return r.data;
  };

  // ---- 1. Authentication -------------------------------------------------------------------------
  const unauth = await Promise.all([
    call('GET', '/agents/meta'), call('POST', '/agents/crop', null, {}), call('POST', '/agents/fertilizer', null, { crop: 'Cotton' }),
    form('/agents/disease', null, { crop: 'Tomato', symptoms: '["yellowing"]' }), raw('/agents/disease/photos/0123456789abcdef0123456789abcdef.png').then((r) => ({ status: r.status })),
    call('POST', '/orchestrator', null, { question: 'PM-KISAN' }), call('GET', '/market'), call('GET', '/weather/geocode?q=Warangal'), call('GET', '/weather?lat=17.9&lon=79.5'),
  ]);
  check('I1. No token → 401 on agents (meta, crop, fertilizer, disease, photos), orchestrator, market, weather (9 routes)',
    unauth.every((r) => r.status === 401), unauth.map((r) => r.status).join(','));
  const forgedOld = jwt.sign({ id: A.id }, 'dev-secret-change-me', { expiresIn: '1h' });
  check('I2. A token signed with the old public fallback secret is rejected', (await call('GET', '/agents/meta', forgedOld)).status === 401);

  // ---- 2. Farm / plot ownership on agent routes --------------------------------------------------
  const FA = await farm(A, { name: 'M4 Int A', area: 2 });
  const PA = (await call('POST', `/farms/${FA.id}/plots`, A.token, { name: 'P1', area: 1, areaUnit: 'acres' })).data;
  const own = await Promise.all([
    call('POST', '/agents/fertilizer', B.token, { crop: 'Cotton', farmId: FA.id }),
    call('POST', '/agents/crop', B.token, { soilType: 'black', season: 'kharif', ph: 7, farmId: FA.id }),
    call('POST', '/orchestrator', B.token, { question: 'PM-KISAN eligibility', farmId: FA.id }),
    form('/agents/disease', B.token, { crop: 'Tomato', symptoms: '["yellowing"]', farmId: FA.id }),
    call('POST', '/agents/fertilizer', A.token, { crop: 'Cotton', farmId: FA.id, plotId: PA.id.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }),
  ]);
  const plotNoFarm = await call('POST', '/agents/fertilizer', A.token, { crop: 'Cotton', plotId: PA.id });
  const mine = await call('POST', '/agents/fertilizer', A.token, { crop: 'Cotton', farmId: FA.id, plotId: PA.id });
  check('I3. Another farmer’s farmId → 404 on fertilizer, crop, orchestrator and disease; an unknown plot → 404; plotId without farmId → 400; own farm + plot → 200',
    own.every((r) => r.status === 404) && plotNoFarm.status === 400 && mine.status === 200, `${own.map((r) => r.status).join(',')} | ${plotNoFarm.status} | ${mine.status}`);

  // ---- 3. Crop agent: the trained model only with valid inputs; reasons stated ------------------
  const partial = await call('POST', '/agents/crop', A.token, { soilType: 'black', ph: 6.8, season: 'kharif', irrigation: 'irrigated' });
  const invalid = await call('POST', '/agents/crop', A.token, { N: 90, P: 42, K: 43, temperature: 20.9, humidity: 150, ph: 6.5, rainfall: 202.9, soilType: 'black', season: 'kharif' });
  const full = await call('POST', '/agents/crop', A.token, { N: 90, P: 42, K: 43, temperature: 20.9, humidity: 82, ph: 6.5, rainfall: 202.9 });
  check('I4. Missing model inputs → rule engine (not the model) with the missing features named',
    partial.status === 200 && partial.data.modelSource === 'rule_engine' && /missing N, P, K, temperature, humidity, rainfall/.test(partial.data.mlNotUsedReason || ''), partial.data?.mlNotUsedReason);
  check('I5. An impossible value (humidity 150 %) is never sent to the model; reason says "invalid humidity"',
    invalid.data?.modelSource === 'rule_engine' && /invalid humidity/.test(invalid.data?.mlNotUsedReason || ''), invalid.data?.mlNotUsedReason);
  check('I6. All seven valid inputs → the trained random forest (modelSource crop_random_forest), explanation source honest',
    full.data?.modelSource === 'crop_random_forest' && typeof full.data.prediction === 'string' && Array.isArray(full.data.warnings) && full.data.explanationSource === 'template',
    `${full.data?.prediction} via ${full.data?.modelSource}`);

  // ---- 4. Orchestrator: validation + partial failure ---------------------------------------------
  const orch = await call('POST', '/orchestrator', A.token, { crop: { N: 90, P: 42 }, question: 'PM-KISAN eligibility', farmId: FA.id });
  check('I7. Orchestrator: invalid crop inputs are not sent to the model ("not run … missing"), the scheme retrieval still runs, farm context echoed',
    orch.status === 200 && /^not run/.test(orch.data.agentResults.crop?.error || '') && Array.isArray(orch.data.agentResults.rag?.results) && orch.data.context?.farmId === FA.id,
    orch.data?.agentResults?.crop?.error);
  check('I8. Orchestrator with nothing to run → 400', (await call('POST', '/orchestrator', A.token, {})).status === 400);

  // ---- 5. Disease: symptom matching only; photo stored privately, never analysed -----------------
  const fields = { crop: 'Tomato', symptoms: JSON.stringify(['yellowing', 'brown_spots']) };
  const noPhoto = await form('/agents/disease', A.token, fields);
  const withPhoto = await form('/agents/disease', A.token, fields, { bytes: PNG_1PX, type: 'image/png', name: 'leaf.png' });
  const items = noPhoto.data?.diagnosis || [];
  check('I9. Diagnosis has no "confidence" or fabricated photo text; each match is "matched of signature" symptoms; source rule_engine',
    noPhoto.status === 200 && items.length > 0 && items.every((d) => d.confidence === undefined && d.symptomMatch.matched >= 1 && d.symptomMatch.matched <= d.symptomMatch.signature) &&
    noPhoto.data.photoAnalysis === undefined && noPhoto.data.modelSource === 'rule_engine' && noPhoto.data.photo.status === 'not_provided' && !/%/.test(noPhoto.data.explanation),
    items.map((d) => `${d.name} ${d.symptomMatch.matched}/${d.symptomMatch.signature}`).join('; '));
  check('I10. With a photo: stored privately, analysed = false, status unavailable with the reason — and the diagnosis is identical to the one without a photo',
    withPhoto.status === 200 && withPhoto.data.photo.stored === true && withPhoto.data.photo.analysed === false && withPhoto.data.photo.status === 'unavailable' &&
    /no trained plant-disease image model/.test(withPhoto.data.photo.reason) && withPhoto.data.photoDiagnosis.available === false &&
    JSON.stringify(withPhoto.data.diagnosis) === JSON.stringify(noPhoto.data.diagnosis));
  const html = await form('/agents/disease', A.token, fields, { bytes: Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64, ' ')), type: 'image/jpeg', name: 'leaf.jpg' });
  const svg = await form('/agents/disease', A.token, fields, { bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'), type: 'image/svg+xml', name: 'x.svg' });
  const big = Buffer.alloc(5 * 1024 * 1024 + 10); PNG_1PX.copy(big);
  const tooBig = await form('/agents/disease', A.token, fields, { bytes: big, type: 'image/png', name: 'big.png' });
  check('I11. Upload validation by content: HTML named .jpg → 415, SVG → 415, > 5 MB → 413', html.status === 415 && svg.status === 415 && tooBig.status === 413, `${html.status},${svg.status},${tooBig.status}`);
  const photoUrl = withPhoto.data.photo.url.replace(/^\/api/, '');
  const mineRes = await raw(photoUrl, A.token);
  const mineBytes = Buffer.from(await mineRes.arrayBuffer());
  const other = await raw(photoUrl, B.token), anon = await raw(photoUrl, null);
  const probes = await Promise.all(['..%2F..%2Fserver.js', '..%2F.env', 'x.html', `${withPhoto.data.photo.id.slice(0, -4)}.svg`].map((id) => raw(`/agents/disease/photos/${id}`, A.token)));
  check('I12. Photo readable only by its owner (200, same bytes, image/png, nosniff, no-store); other farmer 404; no token 401; traversal / other types 404',
    mineRes.status === 200 && mineBytes.equals(PNG_1PX) && mineRes.headers.get('content-type') === 'image/png' && mineRes.headers.get('x-content-type-options') === 'nosniff' &&
    /no-store/.test(mineRes.headers.get('cache-control') || '') && other.status === 404 && anon.status === 401 && probes.every((p) => p.status === 404),
    `${mineRes.status}/${other.status}/${anon.status}/${probes.map((p) => p.status).join(',')}`);
  const pub = await fetch(base.replace(/\/api$/, '') + '/uploads/1784630140730-s0uzsx.jpeg');
  check('I13. The old public /uploads folder is no longer served', pub.status === 404);

  // ---- 6. Fertilizer through the API: split counts DAP's N ---------------------------------------
  const fert = (await call('POST', '/agents/fertilizer', A.token, { crop: 'Cotton', areaAcres: 2, soilType: 'loamy' })).data;
  const nSplits = fert.schedule.map((s) => s.nutrientsPerAcre.N);
  check('I14. Fertilizer API: N per split 25 + 12.5 + 12.5 = 50 kg/acre (shares 50/25/25 of the N actually applied); basal urea reduced by DAP’s N',
    nSplits.join() === '25,12.5,12.5' && fert.balance.nApplied === 50 && fert.schedule.map((s) => s.share).join() === '50% of N,25% of N,25% of N' &&
    near(parseFloat(fert.schedule[0].productsPerAcre.Urea), r1((25 - (25 / 0.46) * 0.18) / 0.46), 0.051), `${nSplits.join(' + ')}; basal urea ${fert.schedule[0].productsPerAcre.Urea}`);

  // ---- 7. Concurrency-safe plot allocation --------------------------------------------------------
  const FR = await farm(A, { name: 'M4 Race', area: 2 });
  const burst = await Promise.all([...Array(6)].map((_, i) => call('POST', `/farms/${FR.id}/plots`, A.token, { name: `R${i}`, area: 0.5, areaUnit: 'acres' })));
  const codes = burst.map((r) => r.status).sort();
  const after = (await call('GET', `/farms/${FR.id}/plots`, A.token)).data;
  check('I15. Six simultaneous 0.5-acre plots on a 2-acre farm → exactly 4 created, 2 refused; allocation exactly 2 acres',
    codes.join() === '201,201,201,201,409,409' && after.plots.length === 4 && after.allocation.allocatedAcres === 2, codes.join(','));
  const FS = await farm(A, { name: 'M4 Shrink', area: 2 });
  await call('POST', `/farms/${FS.id}/plots`, A.token, { name: 'S0', area: 1, areaUnit: 'acres' });
  const [mk, shrink] = await Promise.all([
    call('POST', `/farms/${FS.id}/plots`, A.token, { name: 'S1', area: 1, areaUnit: 'acres' }),
    call('PATCH', `/farms/${FS.id}`, A.token, { area: 1 }),
  ]);
  const fsNow = (await call('GET', `/farms/${FS.id}/plots`, A.token)).data;
  check('I16. A plot creation racing a farm shrink: exactly one wins and plots never exceed the farm',
    [mk.status, shrink.status].sort().join() === '200,409' || [mk.status, shrink.status].sort().join() === '201,409'
      ? fsNow.allocation.allocatedAcres <= fsNow.allocation.farmAcres + 0.001 : false,
    `create ${mk.status}, shrink ${shrink.status}; ${fsNow.allocation.allocatedAcres} of ${fsNow.allocation.farmAcres} ac`);

  if (!KEEP) for (const f of farmsToDelete) await call('DELETE', `/farms/${f.id}`, f.token);
  return { userA: A.id, photoId: withPhoto.data.photo.id };
}

// ---- C. In-process --------------------------------------------------------------------------------
async function inProcess(owners) {
  const photoOwner = owners[0];
  const { fertilizePlan, splitNitrogen, cropRule } = await import('../src/agents/fertilizerAgent.js');
  // splitNitrogen: the three regimes
  const a = splitNitrogen(50, 9.8, [0.5, 0.25, 0.25]);
  const b = splitNitrogen(20, 15, [0.5, 0.25, 0.25]);
  const c = splitNitrogen(12, 12.5, [1]);
  check('C1. Split regimes: DAP-N below the basal share (basal urea tops up), above it (later splits shrink, total kept), above the total (no urea, excess)',
    near(a.deliveredN[0], 25, 1e-9) && near(a.ureaN[0], 15.2, 1e-9) && a.deliveredN.slice(1).join() === '12.5,12.5' &&
    near(b.deliveredN[0], 15, 1e-9) && near(b.deliveredN[1], 2.5, 1e-9) && near(b.deliveredN[1] + b.deliveredN[2] + b.deliveredN[0], 20, 1e-9) &&
    c.ureaN[0] === 0 && near(c.deliveredN[0], 12.5, 1e-9));
  // every crop rule × soil-test factors: totals and schedule agree
  const crops = ['Cotton', 'Soybean', 'Paddy', 'Wheat', 'Maize', 'Onion', 'Tomato', 'Sugarcane', 'Chickpea', 'Groundnut', 'Potato', 'Mustard', 'Sunflower'];
  const factors = [0.75, 1, 1.25];
  let cases = 0; const bad = [];
  for (const crop of crops) for (const fN of factors) for (const fP of factors) {
    const plan = fertilizePlan({ crop, areaAcres: 3.3, soilType: 'loamy', adjust: { N: fN, P: fP, K: 1 } });
    const rule = cropRule(crop);
    const nT = rule.n * fN, nDap = (rule.p * fP / 0.46) * 0.18;
    const sumSplitN = plan.schedule.reduce((s, x) => s + x.nutrientsPerAcre.N, 0);
    const ureaPerSplit = plan.schedule.map((x) => parseFloat(x.productsPerAcre.Urea));
    const ok = near(plan.balance.nApplied, r1(Math.max(nT, nDap)), 0.051) && near(sumSplitN, Math.max(nT, nDap), 0.06 * plan.schedule.length) &&
      near(plan.schedule.reduce((s, x) => s + x.nShare, 0), 1, 1e-9) && ureaPerSplit.every((u) => u >= 0) &&
      near(plan.totals['Urea (46% N)'], r1((Math.max(0, nT - nDap) / 0.46) * 3.3), 0.051) &&
      (nDap > nT + 0.05) === plan.cautions.some((t) => /DAP alone supplies/.test(t));
    cases += 1; if (!ok) bad.push(`${crop} N×${fN} P×${fP}`);
  }
  check(`C2. All ${cases} crop × soil-factor cases: N applied = max(target, DAP-N), splits sum to it, shares sum to 100 %, no negative urea, totals from exact amounts, excess flagged`,
    bad.length === 0, bad.slice(0, 3).join('; '));
  const sun = fertilizePlan({ crop: 'Sunflower', areaAcres: 4.94, soilType: 'red', adjust: { N: 1.25, P: 1, K: 1 } });
  check('C3. Totals from exact per-acre amounts: MOP for 4.94 ac = 164.7 kg (per-acre rounding gave 164.5)', sun.totals['MOP (60% K2O)'] === 164.7, String(sun.totals['MOP (60% K2O)']));

  // photo file permissions (same machine as the API)
  const dir = path.join(process.env.PHOTO_DIR || path.join(BACKEND_DIR, 'uploads-private'), photoOwner.userA);
  const file = path.join(dir, photoOwner.photoId);
  const mode = (p) => (fs.statSync(p).mode & 0o777).toString(8);
  check('C4. Stored photo is private on disk: file 0600, per-user folder 0700, outside any public folder', fs.existsSync(file) && mode(file) === '600' && mode(dir) === '700',
    fs.existsSync(file) ? `file ${mode(file)}, dir ${mode(dir)}` : 'missing');
  for (const o of owners) fs.rmSync(path.join(process.env.PHOTO_DIR || path.join(BACKEND_DIR, 'uploads-private'), o.userA), { recursive: true, force: true });

  // JWT secret hardening (spawned servers on spare ports)
  const run = (env, port) => new Promise((resolve) => {
    const child = spawn('node', ['server.js'], { cwd: BACKEND_DIR, env: { ...process.env, MONGODB_URI: '', PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => { child.kill(); resolve({ exited: false, out }); }, 4000);
    child.on('exit', (code) => { clearTimeout(t); resolve({ exited: true, code, out }); });
  });
  const prod = await run({ NODE_ENV: 'production', JWT_SECRET: 'kisanai-secret' }, 5064);
  const dev = await run({ NODE_ENV: 'development', JWT_SECRET: '' }, 5065);
  check('C5. Production refuses a weak JWT secret (exits with an error); development warns and uses a random per-process secret',
    prod.exited && prod.code !== 0 && /JWT_SECRET is missing or too weak/.test(prod.out) && !dev.exited && /random per-process secret/.test(dev.out),
    `prod exit ${prod.code}, dev running: ${!dev.exited}`);

  const tracked = execFileSync('git', ['ls-files', 'backend/uploads', 'backend/.env'], { cwd: path.join(BACKEND_DIR, '..') }).toString().trim();
  check('C6. Uploaded photos and backend/.env are not tracked by Git', tracked === '', tracked);
}

async function startMemoryApi(port) {
  const child = spawn('node', ['server.js'], { cwd: BACKEND_DIR, env: { ...process.env, PORT: String(port), MONGODB_URI: '' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { if ((await (await fetch(`http://127.0.0.1:${port}/api/health`)).json()).mode === 'in-memory') return child; } catch { /* starting */ }
  }
  child.kill(); throw new Error('in-memory API did not start');
}

console.log('Stage B — integrity fixes\n');
MODE = (await (await fetch(`${API}/health`)).json()).mode;
console.log(`=== A. ${API} (${MODE})`);
const owners = [await scenario(API)];
if (process.env.SKIP_MEMORY !== '1') {
  MODE = 'in-memory';
  console.log('\n=== B. temporary in-memory API (:5063)');
  const child = await startMemoryApi(5063);
  try { owners.push(await scenario('http://127.0.0.1:5063/api')); } finally { child.kill(); }
}
MODE = 'unit';
console.log('\n=== C. in-process');
await inProcess(owners);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('Failed:\n' + failed.map((f) => '  ' + f.name).join('\n')); process.exit(1); }
process.exit(0);
