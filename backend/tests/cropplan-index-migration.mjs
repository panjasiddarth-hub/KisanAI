#!/usr/bin/env node
// Tests the calendar index migration (up + rollback) against the real MongoDB server, on a scratch
// collection that is dropped afterwards — the app's cropplans collection is only read (status).
//   node tests/cropplan-index-migration.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import { inspect, up, down, OLD } from '../scripts/migrations/2026-10-cropplan-plot-index.mjs';

const results = [];
const check = (name, cond, detail = '') => { results.push(!!cond); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };
const dupErr = async (p) => { try { await p; return false; } catch (e) { return e.code === 11000; } };

if (!process.env.MONGODB_URI) { console.log('SKIP: MONGODB_URI not set (index migration only applies to MongoDB)'); process.exit(0); }
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;
const name = `cropplans_migtest_${Date.now()}`;
const coll = db.collection(name);
try {
  // Scratch collection shaped like today's cropplans: the old unique index + legacy plans
  await coll.createIndex(OLD.key, OLD.options);
  await coll.insertMany([
    { userId: 'u1', farmId: 'f1', crop: 'Wheat', sowingDate: '2026-11-20', events: [] },
    { userId: 'u1', farmId: 'f1', crop: 'Cotton', sowingDate: '2026-06-15', events: [] },
    { userId: 'u1', farmId: 'f2', crop: 'Wheat', sowingDate: '2026-11-20', events: [] },
    { userId: 'u1', crop: 'Wheat', sowingDate: '2026-11-20', events: [] },   // free-form plan (no farm)
  ]);
  const s0 = await inspect(coll);
  check('M1. Status before: old index present, new indexes absent, no conflicts for the new keys', s0.oldIndex && s0.newIndexes.every((x) => !x) && s0.conflictsForNew === 0, JSON.stringify(s0.counts));
  check('M2. Before the migration two plots of one farm cannot share crop + date (old index rejects it)',
    !(await dupErr(coll.insertOne({ userId: 'u1', farmId: 'f9', plotId: 'pA', crop: 'Maize', sowingDate: '2026-07-01' }))) &&
    await dupErr(coll.insertOne({ userId: 'u1', farmId: 'f9', plotId: 'pB', crop: 'Maize', sowingDate: '2026-07-01' })));
  await coll.deleteMany({ farmId: 'f9' });

  const dry = await up(coll, { apply: false });
  const s1 = await inspect(coll);
  check('M3. up without --apply is a dry run (lists steps, changes nothing)', dry.dryRun && dry.steps.length === 3 && s1.oldIndex && s1.newIndexes.every((x) => !x), dry.steps.join('; '));
  const applied = await up(coll, { apply: true });
  check('M4. up --apply: new indexes created, old index dropped, no document modified', applied.ok && applied.after.newIndexes.every(Boolean) && !applied.after.oldIndex && applied.after.counts.plans === 4);
  check('M5. After up: two plots of one farm can share crop + date; the same plot cannot; legacy per-farm uniqueness still holds',
    !(await dupErr(coll.insertOne({ userId: 'u1', farmId: 'f1', plotId: 'pA', crop: 'Wheat', sowingDate: '2026-11-20' }))) &&
    !(await dupErr(coll.insertOne({ userId: 'u1', farmId: 'f1', plotId: 'pB', crop: 'Wheat', sowingDate: '2026-11-20' }))) &&
    await dupErr(coll.insertOne({ userId: 'u1', farmId: 'f1', plotId: 'pB', crop: 'Wheat', sowingDate: '2026-11-20' })) &&
    await dupErr(coll.insertOne({ userId: 'u1', farmId: 'f1', crop: 'Wheat', sowingDate: '2026-11-20' })));
  check('M6. One calendar per crop cycle: a second plan with the same cropCycleId is rejected',
    !(await dupErr(coll.insertOne({ userId: 'u1', farmId: 'f3', plotId: 'pC', cropCycleId: 'c1', crop: 'Onion', sowingDate: '2026-11-01' }))) &&
    await dupErr(coll.insertOne({ userId: 'u1', farmId: 'f3', plotId: 'pC', cropCycleId: 'c1', crop: 'Onion', sowingDate: '2026-11-08' })));
  check('M7. up is idempotent (second run: nothing to do)', (await up(coll, { apply: true })).ok && (await inspect(coll)).newIndexes.every(Boolean));

  const blocked = await down(coll, { apply: true });
  const s2 = await inspect(coll);
  check('M8. Rollback refuses while two plots share farm + crop + date — conflict listed, indexes untouched',
    !blocked.ok && blocked.conflicts.length === 1 && blocked.conflicts[0].plans.length === 3 && !s2.oldIndex && s2.newIndexes.every(Boolean),
    blocked.reason);
  await coll.deleteMany({ farmId: 'f1', plotId: { $in: ['pA', 'pB'] } });
  const rolled = await down(coll, { apply: true });
  check('M9. After resolving the conflict, rollback recreates the old index (new ones kept by default)', rolled.ok && rolled.after.oldIndex && rolled.after.newIndexes.every(Boolean));
  const full = await down(coll, { apply: true, dropNew: true });
  check('M10. Rollback with --drop-new restores exactly the original index set', full.ok && full.after.oldIndex && full.after.newIndexes.every((x) => !x));

  const real = await inspect(db.collection('cropplans'));
  console.log(`\ncropplans (read-only status): old index ${real.oldIndex || 'absent'}, new ${real.newIndexes.map((x) => x || 'absent').join(' / ')}, plans ${real.counts.plans} (farm ${real.counts.farmPlans}, plot ${real.counts.plotPlans}), conflicts for new keys ${real.conflictsForNew}`);
} finally {
  await coll.drop().catch(() => {});
  console.log(`scratch collection ${name} dropped`);
  await mongoose.disconnect();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
