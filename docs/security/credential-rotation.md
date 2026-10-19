# Credentials exposed in the public repository — rotation and history cleanup

No secret values appear in this document.

## What was exposed

| Credential | Where | Since |
|---|---|---|
| MongoDB Atlas connection string **with the database user's password** (`MONGODB_URI`) | `backend/.env` | `eea647d` (2026-08-01, "add: env config for team") |
| `WEATHER_API_KEY` (32-character third-party key — **not used by any code**) | `backend/.env` | `705b99e` (2026-08-04, "Added weather API integration") |
| `JWT_SECRET` (a short placeholder value) | `backend/.env` and `backend/.env.example` | `647c5d1` (initial commit) |

The repository was public, so all three must be treated as compromised. Removing them from Git does not
un-publish them; **rotation is the fix**, history cleanup only limits further copying.

## Rotation status

| Credential | Status | Action |
|---|---|---|
| `JWT_SECRET` | **Rotated in the development sandbox** — a new 64-character random value in the local, untracked `backend/.env`. Verified: tokens signed with the old public value are rejected (401). | Every other deployment must set its own new value (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). All users log in again afterwards. |
| MongoDB password | **Not rotated** — needs Atlas project access. | Atlas → *Database Access* → edit the user → *Edit Password* (or create a new user, switch every deployment's `MONGODB_URI`, then delete the old user). Then *Network Access*: replace `0.0.0.0/0` with the deployments' IP addresses. Review *Project Activity* / database access history for unknown clients. |
| `WEATHER_API_KEY` | **Not rotated** — needs the provider account. | Revoke/regenerate it in the provider's dashboard, then delete the line from `backend/.env` (no code reads it). |

Rotating the database password breaks every copy of the old connection string — agree on a time with the
team and update all deployments together.

## Stop tracking `.env` (done)

`backend/.env` was removed from the index (`git rm --cached`) and stays on disk; `.gitignore` already
ignored `.env` and now also ignores `.env.*` except `.env.example`, which holds keys without values.

**Before pulling the commit that untracks the file, every collaborator must copy `backend/.env`
somewhere safe** — Git deletes a file from the working tree when a pulled commit stops tracking it.
Restore the copy afterwards (it is now ignored) and put the rotated values in it.

## History cleanup (only after rotation; rewrites history — coordinate first)

1. Freeze pushes; make a mirror backup: `git clone --mirror <repo-url> kisanai-backup.git`.
2. Rewrite with [git-filter-repo](https://github.com/newren/git-filter-repo) in a fresh mirror clone:
   ```bash
   git clone --mirror <repo-url> kisanai.git && cd kisanai.git
   git filter-repo --invert-paths --path backend/.env
   # .env.example only held the old JWT placeholder; to also drop that value from history:
   #   printf 'regex:JWT_SECRET=.*==>JWT_SECRET=\n' > ../replacements.txt
   #   git filter-repo --replace-text ../replacements.txt
   ```
   (BFG alternative: `bfg --delete-files .env kisanai.git`.)
3. Check: `git log --all --oneline -- backend/.env` prints nothing; `git grep -n "mongodb+srv" $(git rev-list --all)` finds nothing.
4. Force-push all branches and tags: `git push --force --mirror` (temporarily allow force pushes if the branch is protected).
5. Every collaborator re-clones (old clones still contain the secrets and would re-introduce them on push).
6. GitHub keeps cached views, pull-request refs and forks: ask GitHub Support to purge cached views and
   check existing forks. Enable *Secret scanning* and *Push protection* for the repository.

## Verification checklist

- [ ] Atlas password changed; the old connection string fails to connect.
- [ ] Atlas network access restricted to known IPs.
- [ ] Weather key revoked at the provider and removed from `backend/.env`.
- [ ] Each deployment has its own new `JWT_SECRET` (≥ 32 random characters).
- [ ] `git ls-files | grep -E '(^|/)\.env$'` prints nothing.
- [ ] (If history was rewritten) no secret in `git log --all -p`; collaborators re-cloned.
