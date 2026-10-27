# KisanAI supervised pilot — proposed scope

**Status:** Draft for founder and agronomy review. This is not an approved
field-trial protocol and must not be presented as validated farm advice.

## Pilot objective

Learn whether a farmer can create a farm profile, review soil-report readings,
understand a crop shortlist, consult government guidance, and create a useful
season calendar with help from a human reviewer. The first pilot should test
workflow safety and usefulness, not claim yield gains or autonomous agronomic
recommendations.

## Proposed starting boundary

- **Region:** Telangana, initially limited to one district selected with a
  local agronomy partner. Existing project examples mention Warangal,
  Nizamabad, and Hyderabad, but do not establish which district is suitable
  for recruitment or field support.
- **Crops:** Not approved yet. Reconcile the crop classifier's 22 output labels
  with the app's 18-entry crop catalog and local crops before selecting a
  supported subset. Do not let unsupported classifier labels enter crop
  calendars.
- **Languages:** English and Telugu are a proposed first pair. Telugu
  translations and spoken advice require native-speaker review before farmer
  use; no language is marked production-ready by this draft.
- **Users:** A small, opt-in group of farmers recruited through a local
  agricultural university, KVK, FPO, or other qualified partner. Determine
  the actual sample size and duration with that partner.
- **Operating mode:** Supervised decision support. A qualified agronomy
  reviewer must be reachable for advice that could change planting, input, or
  crop-protection decisions. Disease diagnosis remains unavailable until its
  model and evaluation are complete.

## Required gates before inviting farmers

1. **Approve the pilot boundary:** confirm one district, crops, languages,
   recruitment partner, timeline, support contact, and escalation route.
2. **Reconcile model labels:** document all 22 crop labels without loading
   serialized artifacts in an unsafe environment; map only reviewed labels to
   the application's crop metadata and calendar support.
3. **Validate crop model inputs:** obtain dataset, geography, feature units,
   rainfall reference period, evaluation metrics, and uncertainty behavior.
   Until then, classifier scores are exploratory outputs, not success
   probabilities or planting instructions.
4. **Agronomy review:** evaluate recommendations against season, water, soil,
   previous crop, local practice, and current official guidance. Record reviewer
   decisions and known limitations.
5. **Government sources:** current screens link to IMD district bulletins in
   English/local languages and crop-specific advisories. KisanAI does not fetch
   or interpret the bulletin yet. Automated display requires authorized API
   access, endpoint/schema verification, and dated source attribution.
6. **Farmer-facing language:** native speakers review every translation,
   units, warnings, consent text, and speech transcripts. Give farmers a way to
   correct misunderstood values and report harmful or stale advice.
7. **Data and consent:** explain what farm, soil, image, voice, and location
   data are collected, where they are processed, how long they are retained,
   and how to export or delete them. Obtain informed opt-in consent.
8. **Reliability and recovery:** complete clean-environment deployment,
   backups/restore, error monitoring, API/model failure behavior, and a tested
   rollback before field use.

## Pilot measures

Agree targets with the partner before recruitment. At minimum, collect:

- Completion and drop-off rates for farm setup, soil report review, crop
  planning, and calendar creation.
- Corrections to OCR readings, crop labels, translations, and misunderstood
  advice.
- Reviewer agreement, unsafe/unsupported outputs, stale-source reports, and
  cases escalated to an expert.
- Performance under weak connectivity and on low-end Android devices.
- Farmer-reported usefulness and confidence, clearly separated from measured
  crop yield or income outcomes.

Do not use unreviewed farmer feedback to retrain models. Expand to another
district, crop, or language only after the partner reviews pilot outcomes and
approves the change.

## Decisions needed from the project team

- Which Telangana district can a qualified partner support?
- Who will be the named agronomy reviewer and incident contact?
- Which crop labels can be validated for that district and season?
- Can the team obtain authorized IMD API access for direct advisory retrieval?
- Which Telugu-speaking reviewer can approve translations and voice flows?
