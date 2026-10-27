# KisanAI backend

The Express API, agents, middleware, and database persistence layer live here.
For setup, environment variables, API endpoints, and the full repository layout,
see the [project README](../README.md).

## Source organization

- `src/agents/` — agricultural decision agents and AI integrations.
- `src/data/` — crop and disease knowledge bases.
- `src/database/config/` — MongoDB connection setup and in-memory fallback mode.
- `src/database/models/` — Mongoose schemas.
- `src/database/repositories/` — persistence operations shared by API routes.
- `src/middleware/` — request authentication.
- `src/routes/` — HTTP API endpoints.
- `src/services/weatherCache.js` — five-minute, bounded forecast cache with
  same-location request coalescing to reduce repeated external weather calls.

Run backend validation-agent checks with `npm test` from this directory.
When `MONGODB_URI` is set, a failed MongoDB connection stops API startup rather
than silently using volatile in-memory storage.

## Request validation and throttling

Login and registration validate basic input types and limits. Prediction and
orchestration routes validate model inputs before inference. Fixed-window request
limits protect login (10 per 15 minutes), registration (5 per hour), predictions
and orchestration (30 per 15 minutes), market (30 per 15 minutes), and weather
(60 per 15 minutes). MongoDB mode stores hashed client keys in a shared
`rate_limit_buckets` collection with a TTL index, so API instances share
counters. The index is created at startup. In-memory demo mode is process-local.
Configure trusted proxy hops before deployment so `req.ip` reflects the real
client rather than an untrusted forwarded header.

Set `CORS_ORIGINS` to a comma-separated list of exact frontend origins when
`NODE_ENV=production`; production startup fails if the list is missing, uses a
wildcard, or includes a path. `TRUST_PROXY_HOPS` defaults to `0`. Set it to the
known number of reverse proxies in front of the API only after confirming the
hosting topology, since Express uses this setting to derive client IPs.
Production also requires `MONGODB_URI` and a random `JWT_SECRET` of at least
32 characters. The demo account is not seeded in production, and startup stops
if the public demo password is still active for that account. Use a separate
production database and create farmer/admin accounts through the intended
account onboarding process.

`GET /api/health/live` reports that the process is responding. Use
`GET /api/health/ready` for deployment readiness checks; it returns HTTP 503
when MongoDB mode is active but the database connection is no longer ready.

New passwords must be at least 12 characters and no more than 72 UTF-8 bytes
(the bcrypt input limit); passphrases are accepted without character-class
rules. Access tokens currently expire after seven days. Logout revokes all
sessions for that account, and changing the password issues a new token while
revoking other sessions. Password recovery is not available until an email/SMS
delivery provider and verification flow are configured.

Signed-in users can download a JSON export from `GET /api/auth/export`. Account
deletion uses `DELETE /api/auth/account` and requires the current password plus
the exact account email; MongoDB deletion runs in a transaction and removes the
account's farms, crops, and crop plans. This requires a transaction-capable
MongoDB deployment. Consent language, retention schedules, and deletion from
future external file storage still need product and operational policies.

Disease uploads are held in memory, limited to one JPEG/PNG file up to 5 MB,
and checked against the file signature. The authenticated route forwards the
image to the ML service's connected 38-class Keras candidate; the file is not
retained. This local candidate has not been validated on representative field
images, and signature checks are not a malware scan or full image decoder.

The fertilizer screen can optionally load official crop names for the farm's
state and query the Soil Health Card Portal for a general crop and region reference through
`POST /api/agents/fertilizer/reference`. It uses the farmer-owned farm's state
and district, resolves the state ID through the portal, and sends only those
values plus the crop name. Enable it with an authorized `SHC_API_TOKEN` and the
documented endpoint in `.env`; the token stays server-side. This regional
reference is separate from the soil nutrient ML output and must not be presented
as a personalized soil-test prescription. Without a token, the feature reports
that it is unavailable and does not substitute a locally invented dose.
The portal integration guide documents a separate soil-test-based
`getRecommendations` query, but leaves its `results` JSON shape unspecified;
KisanAI does not guess that payload or expose a dose until it is confirmed with
the registered SHC API integration.
