# KisanAI staging operations runbook

**Status:** proposed staging procedure. Do not run restore commands against
production. Do not paste database URIs, passwords, tokens, OTPs, or farmer data
into chat, tickets, or command history.

## Recommended initial hosting shape

- Deploy the React frontend as a static site behind HTTPS.
- Deploy the Express API as a private web service with HTTPS ingress and a
  managed MongoDB connection.
- Deploy the FastAPI ML service privately; only the API should call it.
- Keep the Gemini and OTP provider credentials in the hosting platform's secret
  manager. Do not bake them into images or frontend variables.
- Use a separate staging database and credentials. Production hosting vendor,
  region, budget, backups, and data-residency requirements still need owner
  selection; this topology is a proposal, not a chosen vendor.

## Before backup or restore

1. Confirm you are operating on the named **staging** MongoDB database and that
   the restore target is a separate empty staging database.
2. Use a private machine and secure temporary directory with restricted access.
   Protect the archive with encrypted storage; delete temporary copies when the
   staging check is complete.
3. Inject the staging connection string through the shell's secret environment
   mechanism or a secret manager. Do not put it directly in a command or save it
   in a script.
4. Record the database name, archive timestamp, operator, and result without
   recording the URI or farm/user contents.

## Backup and restore acceptance check

Use the approved MongoDB Database Tools version and the provider's documented
TLS settings. In a controlled staging shell, take a compressed archive using
`mongodump` with the staging URI supplied from a protected environment variable.
Restore that archive with `mongorestore` only into the separate staging target
database (use namespace remapping if needed). Avoid `--drop` unless the target is
confirmed disposable and empty. After restore:

- verify MongoDB reports the restored target is ready;
- compare collection counts and a small owner-approved synthetic test account;
- confirm login, farm listing, and calendar reads work from the restored target;
- confirm indexes, including pending OTP TTL and rate-limit TTL indexes, exist;
- delete the restored test database and temporary archive using approved secure
  deletion procedures;
- record pass/fail and elapsed recovery time without copying personal data.

Do not use this runbook to access or restore a real user's database until the
project owner authorizes a scheduled staging exercise with a separate target.

## Monitoring and incident signals

The API now returns an `X-Request-Id` and emits structured server-error logs
containing only request ID, status, and error code. Build alerts on API liveness
and readiness, database connectivity, ML service health, elevated 5xx rates,
OTP provider failures, and backup job failures. Review log retention, access,
redaction, alert routing, and incident response before real-farmer use. Never
log request bodies, passwords, OTPs, authorization headers, exact coordinates,
soil reports, uploaded images, or farm records.

## Release gate

Run backup/restore and failure/recovery checks in staging, validate secrets and
origins, then record the selected vendor, deployment region, data location,
recovery-point objective, recovery-time objective, alert owner, and rollback
procedure. Production launch remains blocked until those values and a supervised
pilot are approved.
