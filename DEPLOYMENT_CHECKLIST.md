# KisanAI deployment-readiness checklist

This checklist separates what is present in the repository from what still
needs implementation or verification. A checked item means there is code or a
specific local check for it; it does not mean the product is ready for public
production use.

## Current snapshot

- [x] React frontend, Express backend, and FastAPI ML service can run locally.
- [~] Crop and fertilizer-rating endpoints pass synthetic output checks. The
  market endpoint rejects a non-positive sample forecast, as intended by its
  response validation; do not use that model for farmer decisions yet.
- [x] Backend orchestrator requires login and routes crop, fertilizer, and
  market calls through model-output validation; invalid outputs are surfaced.
- [x] Weather route source caches successful forecasts for five minutes and
  coalesces concurrent requests for the same location.
- [x] The running API reports MongoDB mode, and the authenticated calendar page
  loads saved plans from the API.
- [x] API startup refuses to silently fall back to temporary storage when a
  configured MongoDB connection fails.
- [x] Browser flow created a farm, requested crop recommendations, and generated
  a 15-activity crop calendar; the synthetic test farm and plan were then deleted.
- [x] ML artifacts have a hash manifest and a verifier that does not load the
  serialized models. The verifier also checks the disease Keras artifact hash.
- [~] The market artifact records XGBoost 3.2.0 in its serialized booster;
  runtime and CI requirements are now pinned to that version. Local crop,
  fertilizer, and market smoke checks pass with XGBoost 3.2.0. The full clean
  Python 3.12 CI run still needs to pass before calling the ML runtime verified.
- [~] Synthetic browser journey verified farm creation, crop-context prefill,
  a validated top-three model shortlist with explanation, and calendar creation.
  A fake location could not be geocoded, so manual test weather values were
  used. Real farm weather lookup has since returned current data for the saved
  Hyderabad location; a fresh-process MongoDB persistence check has now passed.
- [ ] Validate recommendations with agronomy experts and real field data before
  presenting KisanAI as a dependable farming adviser.

## P0 — Define a safe first release

- [~] Drafted a proposed supervised Telangana pilot boundary in
  `PILOT_SCOPE.md`; district, crop subset, languages, partner, and protocol
  still require founder and agronomy approval.
- [ ] Name a qualified agronomy reviewer and define how advice is approved,
  corrected, and escalated.
- [~] Market forecasts are labeled as demonstration estimates, crop outputs as
  uncalibrated model scores, and disease screening as a local candidate. The schemes
  page and public landing page now disclose feature limits; unsupported accuracy,
  efficacy, and farmer testimonial claims were removed. Complete a whole-product
  feature-status audit before pilot release. Login, dashboard, and profile now
  avoid invented usage/accuracy metrics, identify disease and notifications as
  unavailable, and label weather as forecast context. The notifications page no
  longer seeds fictional disease, payment, or weather alerts; profile totals now
  reflect saved farm records. Weather fallback to Nashik is disclosed and the
  dashboard uses a saved farm location when available. Assistant reference data
  is labeled as potentially incomplete, outdated, or unofficial. The current RAG
  index contains 55 chunks from a local `government_schemes_dataset.csv` with no
  official source URLs or retrieval date; verify its provenance and replace it
  with current primary sources before presenting scheme answers as authoritative.
  RAG inference is paused in the ML API and assistant UI until this is done;
  links to official PM-KISAN, KCC eligibility, and Soil Health Card pages remain.
- [~] A 38-class Keras disease artifact is connected to the authenticated image
  route. Local loading and output-shape smoke checks pass; its label order was
  copied from the supplied inference app and reported test accuracy was not
  independently verified. Keep it in a clearly labeled pilot/screening state
  until local field evaluation, class-order confirmation, calibration, and
  expert-reviewed follow-up guidance are complete.

## P1 — Make runtime and deployment reproducible

- [x] Document local startup for frontend, backend, and ML service in
  `LOCAL_SETUP.md`.
- [x] Pin scikit-learn to the model artifact's recorded version and declare ML
  service dependencies.
- [x] Add a model artifact manifest with file hashes and known metadata gaps.
- [x] Add scripts for model artifact hash verification and crop/fertilizer/
  market smoke checks.
- [~] Run all services from clean environments built from lockfiles or pinned
  dependency manifests. XGBoost now matches the market artifact's recorded
  version; the clean Python 3.12 CI run remains to be confirmed.
- [x] Add automated CI for backend checks, frontend lint/build, ML artifact
  verification, and available-model smoke checks (`.github/workflows/ci.yml`).
  The first remote Actions run still needs to complete successfully; full API
  integration checks are not yet part of CI.
- [ ] Create production build and deployment configuration for frontend,
  backend, and ML service; document the chosen hosting platform and rollback
  procedure.
- [ ] Set production environment variables through the hosting provider's
  secret manager; never ship local `.env` files or demo secrets.
- [~] Backend enforces an exact production CORS origin allowlist, supports an
  explicit trusted-proxy hop count, and exposes liveness/readiness checks.
  TLS termination and hosting-specific health-check wiring remain to configure.
- [x] Backend JSON request body has a 12 MB limit; disease upload has a 5 MB
  file limit.
- [ ] Configure storage for uploaded farm photos and other user files; do not
  rely on an instance-local uploads folder in a scaled deployment.

## P1 — Secure accounts and farmer data

- [x] Production startup requires MongoDB and a JWT secret of at least 32
  characters, skips demo-user seeding, and refuses the default public demo
  password. Create production users through the intended onboarding flow.
- [~] New passwords require a 12-character passphrase within bcrypt's 72-byte
  limit. Tokens expire after seven days; logout and password change revoke all
  sessions. Token refresh and verified email/SMS account recovery still need
  implementation before production.
- [~] Farm/crop routes scope access to the signed-in user; crop creation checks
  farm ownership, and PATCH accepts only editable fields. Prediction endpoints
  require authentication. Profile and remaining upload controls still need review.
- [x] Farm, crop, and calendar write routes validate required fields, numeric
  ranges, dates, and bounded text/list/image fields before saving; crop and
  calendar number inputs are normalized.
- [x] Login and registration validate basic fields; crop/fertilizer and
  orchestration inputs run through model schemas. Rate limits cover login,
  registration, prediction, market, weather, and orchestration; MongoDB mode
  shares counters across API instances via TTL-backed buckets.
- [~] Disease uploads are limited to one 5 MB JPEG/PNG and checked against
  their file signature. The connected model is loaded for inference; uploaded
  data is held in memory and not retained. Signature checks are not malware
  scanning, and representative field images still need evaluation.
- [ ] If uploads become persistent, use safe storage names and malware scanning.
- [~] Signed-in users can export account/farm/crop/calendar data and delete
  their account plus owned database records after password/email confirmation.
  MongoDB deletion uses a transaction. Consent copy, retention schedules, and
  deletion from future external file storage still need policies and checks.
- [ ] Redact passwords, tokens, precise location, and private farm information
  from logs and error reports.
- [ ] Review dependency vulnerabilities and establish a process for security
  updates.

## P1 — Persist farm records reliably

- [ ] Use a production MongoDB deployment or another managed database; in-memory
  mode is demo-only because records reset on restart.
- [x] Started a fresh backend process against the configured MongoDB deployment;
  MongoDB mode was confirmed and read-only farm/calendar counts matched the
  prior run (6 farms, 10 calendar plans). The original API process was left running.
- [ ] Test migrations, indexes, unique account constraints, backups, and restore
  procedures.
- [~] Compared all six signed-in farmer farm records before and after a fresh
  process start; IDs, names, soil-test fields, and previous-crop fields matched.
  None currently has soil readings or a previous crop entered, so populated-value
  persistence remains to be verified after those details are added.
- [ ] Decide which photos and documents are stored, for how long, and how a
  farmer can remove them.

## P1 — Validate model behavior and decision safety

- [x] Expose crop, fertilizer-rating, market, and disease-image endpoints;
  RAG inference remains paused pending corpus provenance review.
- [~] Crop and fertilizer synthetic inference checks pass. The disease model
  loads and returns a valid 38-class score for a nonblank synthetic JPEG; a
  blank-image guard rejects uniform images. A synthetic color pattern still
  received a 99.98 score, confirming that out-of-distribution screening and
  score calibration are not solved. These are wiring checks only. The market
  smoke check fails on an invalid non-positive forecast and emits an XGBoost
  serialization-version warning.
- [x] Record artifact hashes and documented input/output fields in the model
  manifest.
- [ ] Obtain training dataset source, date range, geography, units, label
  definitions, and training code for each production model.
- [ ] Build independent, representative evaluation datasets and report
  accuracy/error by crop, region, season, and relevant farmer groups.
- [ ] Check missing values, out-of-range inputs, unsupported categories,
  distribution drift, and model failure behavior.
- [ ] For crop suggestions, validate local suitability using season, water,
  climate, soil, previous crop, region, and current government guidance; do not
  present raw classifier scores as success probabilities.
- [ ] For fertilizer, decide whether the product will only show nutrient
  deficiency ratings or provide doses. Any dose feature needs validated
  agronomic calculations, units, crop/stage context, and expert review.
- [ ] For market predictions, connect a licensed/authoritative current data
  source and define currency, quantity unit, market, forecast horizon, update
  time, and uncertainty.
- [ ] Add confidence/uncertainty and a safe response when inputs or evidence are
  insufficient.
- [ ] Add a human-reviewed feedback and correction process; do not silently
  retrain from unverified farmer feedback.

## P1 — Connect and validate the agent workflow

- [x] Backend has a farm-profile orchestrator and validation-agent modules.
- [x] Farm assessment builds crop and nutrient-rating inputs from saved farm
  values plus farmer-reviewed/weather values, reports missing fields per agent,
  carries input-source labels into explanations, and shows validation checks.
- [~] Live authenticated direct orchestration passed through backend and ML:
  crop returned three ranked options, fertilizer returned nine ratings, and
  validation passed. A read-only saved-farm run returned a crop result and
  correctly requested missing fertilizer soil-test fields. None of the eight
  farms available to the development account had a complete nutrient profile,
  so a complete saved-farm run with full soil data remains to be verified.
  Error outcomes distinguish missing inputs, failed services, and partial
  results; the smoke run did not modify saved records.
- [x] Verify signed-in API requests pass through backend, orchestrator, ML
  service, and validation for the three available prediction models.
- [~] The authenticated Crop Suggester renders ML results, explanations, and
  farm-input context. A visible validation-agent status was added; confirm it
  on the live crop screen after refresh.
- [~] Agent request schemas and a 20-second ML dispatch timeout exist, with
  explicit partial, missing-input, validation, and service-failure states.
  Retry/backoff policy and live end-to-end recovery checks remain.
- [ ] Require the validation agent to check source, freshness, units, ranges,
  contradictions, and unsupported claims before advice reaches a farmer.
- [ ] Show evidence, model/source labels, assumptions, missing inputs, and
  uncertainty in plain language.
- [ ] Ensure Gemini or another language model can explain validated results but
  cannot invent, overwrite, or silently replace model outputs.
- [ ] Add end-to-end cases for crop planning, soil ratings, market lookup,
  calendar generation, and partial agent failure.

## P1 — Complete the farmer journey

- [x] Login and registration route farmers to My Farm first. Farm creation
  collects location, area, soil type, water access, previous crop, and season.
- [x] Farm-photo upload is optional and appears in the farm creation flow.
- [~] Manual soil values and consent-based soil-report photo extraction are
  available, with extracted values shown for farmer review. Photo extraction
  requires `GEMINI_API_KEY`; PDF/document extraction is not supported yet.
- [ ] Produce a top-three crop shortlist that considers farm context and shows
  why each crop was suggested, what is unknown, and what the farmer should
  confirm locally.
- [~] Farm, crop-planning, and calendar screens link to official IMD district
  bulletins (English/local language) and crop-specific advisories using farm
  location/crop context. KisanAI does not fetch advisory content or show its
  issue date yet; automated retrieval needs authorized API access and a
  verified endpoint/schema. Government scheme data is not connected.
- [~] Generate a crop calendar from the selected supported crop and sowing
  date, linked to its farm. Results without calendar support are identified in
  the crop screen. Fertilizer, irrigation, scouting, and disease workflows are
  not connected to calendar tasks yet.
- [~] Farmers can mark tasks complete or reschedule them. Optional browser
  reminders fire for tasks due today while the calendar tab is open; reliable
  background push/SMS reminders still need a notification service.
- [ ] Connect harvest planning to reliable market data and explain when a price
  is historical, estimated, or unavailable.
- [ ] Test the whole workflow with farmers and local agricultural experts,
  including low-connectivity conditions.

## P2 — Language, voice, accessibility, and offline behavior

- [ ] Select and review supported languages with native speakers; translate
  crop names, units, warnings, and advice consistently.
- [ ] Add voice input and spoken answers with a visible transcript and a way to
  correct speech-recognition mistakes.
- [ ] Test common accents, noisy environments, low-end Android devices, and
  browser permissions.
- [ ] Make key flows usable on small screens, with keyboard/screen-reader
  support, readable contrast, and clear error messages.
- [ ] Define which features work offline, what data is cached, and how stale
  advice is labeled.

## P2 — Operate and support a live service

- [ ] Add structured logs, request IDs, latency/error monitoring, uptime
  alerts, and model/version identifiers without recording sensitive data.
- [ ] Monitor model input drift, prediction distributions, validation rejects,
  external data freshness, and service costs.
- [ ] Define incident response, backup recovery, model rollback, and farmer
  communication procedures.
- [ ] Add support contact and a process to report harmful, stale, or incorrect
  advice.
- [ ] Run a limited pilot, review outcomes and failure reports, and expand
  regions/crops only after approval.

## Release gate

Do not call the product production-ready until P0 items and all applicable P1
items are complete, the release build passes automated checks, the deployment
has been exercised from a clean environment, and the intended region/crop
recommendations have passed agronomy review and farmer testing. Disease
screening is connected for local testing, but is not yet validated for farmer
decisions or treatment guidance.
