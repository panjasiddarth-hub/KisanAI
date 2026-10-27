# Run KisanAI locally on Windows

## Requirements

- Node.js 20.19 or newer in the 20.x line, or Node.js 22 LTS.
- Python 3.12 recommended. The model artifacts require scikit-learn 1.6.1, which is pinned in `ml-service/requirements.txt`.
- Internet access for the first dependency installation.

No MongoDB or Gemini API key is required for the local demo. Without MongoDB, farm data stays in memory and resets when the backend restarts. Gemini explanations are optional.

For official Soil Health Card Portal crop and fertilizer lookups, configure an
authorized `SHC_API_TOKEN` in `backend/.env`. This is separate from the Gemini
key. When the saved farm has NPK readings and the farmer selects a crop from
the official crop catalog, KisanAI can request a recommendation using those
inputs; otherwise it can only show general regional guidance. Do not use an
unapproved or personal account token.

If `MONGODB_URI` is configured but MongoDB cannot be reached, the API now stops
instead of silently switching to temporary in-memory storage. This prevents
new farm changes from appearing to save when they would be lost on restart.

## Start the three services

Extract the ZIP, open PowerShell in the extracted `KisanAI` folder, and run each service in its own terminal.

### Terminal 1: ML service

```powershell
cd ml-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks virtual-environment activation, run this in that terminal and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### Terminal 2: backend API

```powershell
cd backend
npm install
npm start
```

### Terminal 3: frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Demo login and service checks

- Demo login: `siddarth@kisan.com`
- Password: `password123`
- Backend health: `http://localhost:5000/api/health`
- Backend liveness/readiness: `http://localhost:5000/api/health/live` and
  `http://localhost:5000/api/health/ready`
- ML service health: `http://localhost:8000/health`
- ML API documentation: `http://localhost:8000/docs`

Keep all three terminals running while using the app. Start the ML service before requesting model predictions.

For production, set `NODE_ENV=production` and `CORS_ORIGINS` to the exact
HTTPS frontend origin(s). Configure `TRUST_PROXY_HOPS` only for the verified
number of reverse proxies in front of the API; it defaults to `0` locally.

## Current model limitations

- Disease diagnosis remains unavailable until the trained disease-model artifact is added.
- Knowledge assistant replies are paused until its retrieval corpus has verified official sources and publication dates.
- Fertilizer output is a nutrient rating, not a verified fertilizer dose.
- Market forecasts currently use sample historical inputs.
- The crop model's rainfall reference period is not documented; verify the value before relying on crop results.
- The demo JWT secret and demo credentials are for local development only. Configure production secrets and security before hosting the app publicly.
- Production startup requires MongoDB, a random JWT secret of at least 32
  characters, and explicit CORS origins. It does not seed the demo account and
  refuses to start if that account still uses its public default password.
- New accounts use passphrases of at least 12 characters. Password reset is not
  available yet; configure and verify an email/SMS provider before offering it.
