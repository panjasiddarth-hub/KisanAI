# KisanAI privacy and data-flow draft

**Status: engineering inventory, not a published privacy notice or legal review.**
Confirm purposes, retention periods, processor terms, security controls, and
farmer-facing consent with the project owner and qualified privacy counsel
before inviting real farmers.

## Data collected and where it goes

- Account signup stores a farmer name, email or phone, password hash, and
  verification state in MongoDB. Signup and password-reset OTP delivery sends the destination
  contact and one-time code through the selected Resend or Twilio account.
- Farm profiles store the farm name, village/district/state, optional latitude
  and longitude, land/soil/water/crop details, and optional compressed farm
  photos in MongoDB. Soil-test measurements are stored after farmer review.
- Soil-report files are held in memory for extraction and are not saved by the
  extraction route. Selectable-text PDFs are read by the local ML service.
  Scanned PDFs and images are sent to Gemini only after the farmer explicitly
  opts in; extracted values are returned for review before saving.
- A farmer who presses location search sends the entered village, district,
  and state to the configured geocoder (OpenStreetMap Nominatim by default).
  Loading map tiles contacts OpenStreetMap tile servers. Device coordinates
  are read only after the farmer presses “Use my location”; the app then stores
  the pin with the farm if the farmer saves it.
- Weather lookup sends the requested farm location/coordinates to Open-Meteo.
  Government retrieval links the farmer to the official source; do not send
  profile or contact details to those source sites.
- Disease image requests are processed in memory by the local ML service. The
  app currently accepts JPG/PNG image uploads and does not retain the uploaded
  disease photo in the disease route.

## Required decisions before production

- Publish a reviewed privacy notice and separate, understandable consent for
  soil-report transmission to Gemini and any future third-party processing.
- Set and enforce retention periods for account data, farm photos, soil
  measurements, OTP attempts, backups, logs, and support records. The repository
  does not yet define an overall retention schedule.
- Define how farmers export and permanently delete records from the live
  database, backups, and any future storage providers; test the deletion and
  restore interaction before launch.
- Redact credentials, OTPs, contact details, precise coordinates, report text,
  and farm records from application logs and monitoring. Review external
  processor contracts, access controls, encryption, region, and breach process.
- Confirm exact provider settings and allowed origins with the deployment
  owner. Never use local console OTP delivery in production.

## Current engineering controls

Signup and password-reset OTPs are hashed with an HMAC and expire after ten minutes; attempts and
request rates are bounded. Production OTP delivery supports Resend email or
Twilio SMS but requires valid provider configuration. Account deletion removes
owned database records; verify behavior with a restorable staging database.
This list describes code behavior and is not a promise of legal compliance.

## Proposed retention schedule for owner and privacy review

These are engineering defaults to discuss and approve before production; they
are not a final legal policy:

- **OTP/reset records:** expire after 10 minutes; MongoDB TTL cleanup is
  asynchronous, so the application also rejects records older than 10 minutes.
- **Farm profile, soil readings, and farm photos:** retain while the account is
  active; delete from the live database when the farmer deletes the account.
  Photos currently live inside the farm record and therefore follow that rule.
- **Uploaded soil report and disease image:** do not persist the original upload;
  process in memory. Soil values are stored only when the farmer saves them.
- **Application/security logs:** propose 30 days in production, with contact
  details, OTPs, tokens, coordinates, report contents, and farm values redacted.
  The deployment owner must confirm the logging platform can enforce this.
- **Encrypted backups:** propose a 30-day rolling retention window, restricted
  access, and deletion-expiry handling. Confirm provider capabilities and test
  restore/deletion behavior in staging before adopting this period.
- **Support and pilot feedback:** propose 90 days after the case or pilot closes,
  then delete or irreversibly de-identify; do not reuse for model training without
  separate documented permission.

## Farmer-facing consent copy — draft for review

**Soil report scan:** “If you choose Scan, this report will be sent to Google
Gemini to read soil values. KisanAI does not keep the uploaded file. Check every
reading before saving it to your farm. You can enter values yourself instead.”

**Location search:** “Searching sends the village, district, and state you enter
to OpenStreetMap to find a map location. You can place the pin yourself or enter
the location without searching.”

**Device location:** “Use my location reads this device’s location to place a
farm pin. The pin is saved with this farm only if you save the farm.”

Have a qualified reviewer confirm that the wording matches deployed processors,
actual retention, supported languages, and applicable law before release.
