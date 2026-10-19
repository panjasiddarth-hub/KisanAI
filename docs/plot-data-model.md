# Plot-level data model (Milestone 3)

A farmer owns farms; a farm contains plots; each plot has its own soil, water access, crop history
and crop cycles. Everything a recommendation, calendar event or alert refers to is scoped to one plot
(and, where relevant, one crop cycle).

```
User ──< Farm ──< Plot ──< CropCycle ──< Observation (embedded, stable ids)
                    │           │
                    │           ├── Recommendation  (plotId, cropCycleId when selected)   ← Milestone 4
                    │           ├── CropPlan/events (plotId, cropCycleId, event ids)      ← Milestone 4
                    │           └── Alert / Task     (plotId, cropCycleId, source)         ← later milestone
```

## Field ownership

| Concept | Fields | Where |
|---|---|---|
| Account | name, email, role, phone | `users` (unchanged) |
| Farm (property) | name, location, confirmed coordinates, total area + unit, water sources on the property, images | `farms` (unchanged) |
| Plot | name, area + unit (+ `areaAcres`), soil type, 12 Soil Health Card values + test date, water source + irrigation method, previous crops (crop, season, year), `inputsRevision` | `plots` (new) |
| Crop cycle | crop (+ knowledge-base `cropKey`), variety, season, status, planned / actual sowing date, harvest (date, quantity, unit), notes, observations, `plotRevisionAtStart` | `cropcycles` (new) |
| Legacy "whole farm" | `farm.soilType`, `farm.soilTest`, `farm.crops`, `farm.selectedCrop` | stay on `farms`; used by the Milestone 1–2 farm-level features for farms without plots |

## Migration (additive)

1. Only new collections (`plots`, `cropcycles`) and their indexes were created. No existing document
   was modified, renamed or deleted; there is no automatic migration.
2. A farm without plots keeps working exactly as before ("whole farm"). `GET /api/farms/:id/plots`
   returns an empty list plus a summary of the farm-level details.
3. Converting is opt-in per plot: `POST …/plots` with `copyFromFarm: true` copies the farm's soil type,
   soil test, water source and crop list into the new plot (fields the request didn't set). The farm
   record is never changed.
4. Existing recommendations and calendar plans (farmId only) are never auto-assigned to a plot.
5. Rollback: drop `plots` and `cropcycles`, remove the plot routes. Nothing else to undo.

Milestone 4 will add `plotId`/`cropCycleId` to new recommendations and calendar plans. That needs one
change to existing index metadata — the unique calendar index `{userId, farmId, crop, sowingDate}` must
include `plotId`, otherwise two plots of one farm can't grow the same crop on the same date. It will be
proposed before it is applied.

## Invariants (enforced)

- **Ownership**: every query is scoped by `userId` and the parent id (farm for plots, plot for cycles).
  Owner and parent ids come from the auth token and the URL, never the body. A cycle can't be reached
  through another plot, nor a plot through another farm (404).
- **One open crop cycle per plot**: partial unique index `{plotId}` where `isOpen: true` — concurrent
  requests can't open two. Statuses: planned → active/abandoned; active → harvested/abandoned; closed
  cycles are history (only notes and harvest details can change).
- **Plot names** are unique among a farm's active plots (case- and space-insensitive; partial unique index).
- **Area**: one unit table (`services/units.js`: acres, hectares, guntha, cents, m²). Active plots may not
  exceed the farm area (0.001 ac tolerance for rounding); the farm can't shrink below its plots. Bigha
  differs by state and is never converted — such areas are stored but not checked or used in calculations.
- **Stale inputs**: `inputsRevision` increases only when area, soil, water or crop history actually
  change; a crop cycle records the revision it was planned with, so later milestones can flag results
  computed from older inputs and ask the farmer to reassess.
- **Deletion**: a plot with crop history can't be deleted, only archived; a plot with an open cycle can't
  be archived; deleting a farm deletes its plots and cycles.
- **Limits**: 100 plots per farm, 20 previous crops per plot, 500 observations per cycle; cycle and
  observation lists are cursor-paginated.

## API (`/api/farms/:farmId/plots`, login required)

| Method | Path | Notes |
|---|---|---|
| GET | `/` `?status=active\|archived\|all` | plots + allocation + whole-farm summary |
| POST | `/` | create (`copyFromFarm` optional) — 409 if the farm area would be exceeded |
| GET / PATCH / DELETE | `/:plotId` | PATCH `status: archived\|active` archives / restores |
| GET / POST | `/:plotId/cycles` `?limit&cursor` | one open cycle per plot |
| GET / PATCH | `/:plotId/cycles/:cycleId` | status transitions validated |
| GET / POST | `/:plotId/cycles/:cycleId/observations` `?limit&cursor` | |
| DELETE | `/:plotId/cycles/:cycleId/observations/:obsId` | |

Errors: 400 `{ error, details[] }` (each invalid field), 404 (not found or not yours), 409 `{ error, code }`
(`AREA_EXCEEDS_FARM`, `AREA_BELOW_PLOTS`, `DUPLICATE_NAME`, `OPEN_CYCLE_EXISTS`, `OPEN_CYCLE`,
`PLOT_HAS_HISTORY`, `PLOT_ARCHIVED`, `INVALID_TRANSITION`, `PLOT_LIMIT`, `OBSERVATION_LIMIT`).

## Planned for later milestones (design)

- **Recommendation** (M4): `plotId` required for new runs, `plotRevision` used, `cropCycleId` set on
  selection; selecting a crop creates the plot's crop cycle.
- **Calendar / tasks** (M4): `CropPlan.plotId` + `cropCycleId`; every event gets a stable `id` (today
  events are ticked by array index).
- **Agent results** (M5): one response contract per agent — result, agent, execution source (trained
  model / external API / deterministic calculation / RAG-LLM / fallback), input completeness and data
  timestamps, evidence and sources, warnings, conflicts, missing inputs.
- **Alerts** (later): `{ userId, farmId, plotId, cropCycleId, type, severity, source, evidence, createdAt,
  readAt }`, generated from real data only (weather API, calendar, observations) — replacing today's
  hard-coded notifications.
