#!/usr/bin/env node
// Calendar (cropplans) uniqueness-index migration — Milestone 4.
//
//   node scripts/migrations/2026-10-cropplan-plot-index.mjs status|up|down [--apply] [--drop-new] [--collection <name>]
//
// Without --apply, `up` and `down` only report what they would do.
//
// up    1. checks existing plans for duplicates under the new keys (refuses if any);
//       2. creates user_farm_plot_crop_sowing_unique {userId, farmId, plotId, crop, sowingDate}
//          (unique, partial: farmId is a string) and cropCycle_unique {cropCycleId} (unique, partial);
//       3. drops the old {userId, farmId, crop, sowingDate} unique index.
//       Legacy plans have no plotId (null in the index) and were already unique per farm, so they
//       cannot conflict; two plots of one farm may then use the same crop and sowing date.
// down  rollback: recreates the old index only if no two plans share userId+farmId+crop+sowingDate
//       (e.g. two plots of one farm with the same crop and date). Conflicts are listed and nothing
//       changes until they are resolved. The new indexes stay unless --drop-new (they are harmless to
//       the previous code, which never sets plotId or cropCycleId).
// No document is modified by either direction. Prints index names and counts only (no data, no secrets).
import 'dotenv/config';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';

export const OLD = { key: { userId: 1, farmId: 1, crop: 1, sowingDate: 1 }, options: { unique: true, partialFilterExpression: { farmId: { $type: 'string' } } } };
export const NEW = [
  { key: { userId: 1, farmId: 1, plotId: 1, crop: 1, sowingDate: 1 }, options: { unique: true, partialFilterExpression: { farmId: { $type: 'string' } }, name: 'user_farm_plot_crop_sowing_unique' } },
  { key: { cropCycleId: 1 }, options: { unique: true, partialFilterExpression: { cropCycleId: { $type: 'string' } }, name: 'cropCycle_unique' } },
];
const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function duplicates(coll, groupId, match) {
  return coll.aggregate([
    { $match: match },
    { $group: { _id: groupId, n: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { n: { $gt: 1 } } },
  ]).toArray();
}

export async function inspect(coll) {
  const indexes = await coll.indexes();
  const old = indexes.find((i) => sameKey(i.key, OLD.key));
  const present = NEW.map((n) => indexes.find((i) => sameKey(i.key, n.key))?.name || null);
  const farmPlans = { farmId: { $type: 'string' } };
  const dupNew = await duplicates(coll, { u: '$userId', f: '$farmId', p: '$plotId', c: '$crop', s: '$sowingDate' }, farmPlans);
  const dupCycle = await duplicates(coll, '$cropCycleId', { cropCycleId: { $type: 'string' } });
  const dupOld = await duplicates(coll, { u: '$userId', f: '$farmId', c: '$crop', s: '$sowingDate' }, farmPlans);
  return {
    collection: coll.collectionName,
    oldIndex: old?.name || null,
    newIndexes: present,
    counts: {
      plans: await coll.countDocuments(),
      farmPlans: await coll.countDocuments(farmPlans),
      plotPlans: await coll.countDocuments({ plotId: { $type: 'string' } }),
    },
    conflictsForNew: dupNew.length + dupCycle.length,
    conflictsForOld: dupOld.map((d) => ({ farmId: d._id.f, crop: d._id.c, sowingDate: d._id.s, plans: d.ids.map(String) })),
  };
}

export async function up(coll, { apply = false } = {}) {
  const before = await inspect(coll);
  if (before.conflictsForNew) return { ok: false, reason: `${before.conflictsForNew} duplicate group(s) under the new keys — resolve them first`, before };
  const steps = [
    ...NEW.filter((n, i) => !before.newIndexes[i]).map((n) => `create ${n.options.name}`),
    ...(before.oldIndex ? [`drop ${before.oldIndex}`] : []),
  ];
  if (!apply) return { ok: true, dryRun: true, steps, before };
  for (const n of NEW) await coll.createIndex(n.key, n.options);   // no-op if it already exists
  const mid = await inspect(coll);
  if (mid.newIndexes.some((x) => !x)) return { ok: false, reason: 'new indexes were not created; old index left in place', before, after: mid };
  if (mid.oldIndex) await coll.dropIndex(mid.oldIndex);
  return { ok: true, steps, before, after: await inspect(coll) };
}

export async function down(coll, { apply = false, dropNew = false } = {}) {
  const before = await inspect(coll);
  if (before.conflictsForOld.length) {
    return { ok: false, reason: `${before.conflictsForOld.length} group(s) of plans share farm + crop + sowing date (different plots); the old index cannot be recreated until they are resolved`, conflicts: before.conflictsForOld, before };
  }
  const steps = [...(before.oldIndex ? [] : ['recreate the old {userId, farmId, crop, sowingDate} index']), ...(dropNew ? before.newIndexes.filter(Boolean).map((n) => `drop ${n}`) : [])];
  if (!apply) return { ok: true, dryRun: true, steps, before };
  if (!before.oldIndex) await coll.createIndex(OLD.key, OLD.options);
  if (dropNew) for (const name of before.newIndexes.filter(Boolean)) await coll.dropIndex(name);
  return { ok: true, steps, before, after: await inspect(coll) };
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd = 'status', ...rest] = process.argv.slice(2);
  const flag = (f) => rest.includes(f);
  const collName = rest.includes('--collection') ? rest[rest.indexOf('--collection') + 1] : 'cropplans';
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set (in-memory mode has no indexes to migrate).'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const coll = mongoose.connection.db.collection(collName);
  const out = cmd === 'up' ? await up(coll, { apply: flag('--apply') })
    : cmd === 'down' ? await down(coll, { apply: flag('--apply'), dropNew: flag('--drop-new') })
      : await inspect(coll);
  console.log(JSON.stringify(out, null, 2));
  await mongoose.disconnect();
  process.exit(out.ok === false ? 2 : 0);
}
