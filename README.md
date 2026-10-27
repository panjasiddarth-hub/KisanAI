# 🌾 KisanAI — Sampoorn Kisan AI Sahayak

KisanAI is a prototype agricultural decision-support app for Indian farmers.
Farmers can save farm details, review soil-test readings, request model-backed
crop and soil-nutrient results, and plan crop activities. It is not yet validated
for dependable farming decisions or production deployment.

> B.Tech Major Project 2026 · Full-stack JavaScript (React + Node.js)

---

## What is in the prototype

| Feature | What it does |
|---|---|
| **Farm profiles** | Save location, land, soil, water, crop, and reviewed soil-report information. Soil-report extraction requires a configured Gemini key and farmer review. |
| **Crop model** | Returns three ranked crop classes from N, P, K, temperature, humidity, pH, and rainfall. Scores are not calibrated probabilities; some saved farm context is shown for review but does not affect this model ranking. |
| **Soil-nutrient model** | Returns nine nutrient rating categories from soil-test inputs. It does not recommend fertilizer products or application doses. |
| **Farm assessment orchestrator** | Builds crop and soil-model inputs from a saved farm, identifies missing data, validates result structure, and presents input sources and limitations. |
| **Disease image screening** | A connected 38-class image model runs locally. It is a research candidate only: synthetic non-leaf images can receive high scores, and local field performance is unknown. Do not use it to choose treatment. |
| **Crop calendar** | Generates and manages crop activities for supported crops. Schedules need local agronomy review before being treated as instructions. |
| **Accounts and persistence** | JWT authentication, user-scoped farm records, MongoDB support, and a local in-memory development mode. |

The app also includes weather, market, schemes, analytics, and assistant screens.
Availability and evidence quality differ by feature; see the limitations below.

## 🧱 Architecture

```
Farmer → React web app → Express API (authentication, farm data, orchestration)
                               ├── FastAPI ML service → crop/fertilizer models
                               │                     ├→ market model (experimental)
                               │                     └→ disease image model (candidate)
                               ├── MongoDB (or in-memory local demo store)
                               └── weather / optional Gemini services
```

The farm orchestrator currently runs the crop and soil-nutrient agents. Disease
screening takes a separate image-upload path. Market outputs are blocked when
the model returns an invalid price. RAG is paused until its reference corpus has
verified sources and publication dates.

## 🚀 Quick start (three terminals)

**Prerequisites:** Node.js 20.19+ or 22 LTS, Python 3.12 recommended, and
internet access for the first dependency installation.

```bash
# Terminal 1 — ML API (required for model predictions)
cd ml-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2 — backend API
cd backend
npm install
npm start            # http://localhost:5000

# Terminal 3 — frontend
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Open the URL printed by Vite (normally `http://localhost:5173`). In local
development, the backend seeds a demo account: `siddarth@kisan.com` /
`password123`. This account is for local development only; never use its
credentials in a public deployment.

For the complete Windows setup, including health checks and troubleshooting,
see [`LOCAL_SETUP.md`](./LOCAL_SETUP.md).

## 🔧 Optional configuration (`backend/.env`, see [`backend/.env.example`](./backend/.env.example))

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Paste a free MongoDB Atlas URI for persistent users & plans. Empty → in-memory demo mode (data resets on restart) |
| `GEMINI_API_KEY` | Optional AI-written explanations; prediction results still come from local model artifacts |
| `JWT_SECRET` | Token signing secret; production requires a random value of at least 32 characters |
| `PORT` | Default 5000 |
| `ML_SERVICE_URL` | Python ML API URL; defaults to `http://127.0.0.1:8000` |
| `NODE_ENV` | Set to `production` for production startup checks |
| `CORS_ORIGINS` | Comma-separated exact frontend origins; required in production |
| `TRUST_PROXY_HOPS` | Verified reverse-proxy hop count; defaults to `0` |

Production requires a managed database, a random JWT secret of at least 32
characters, exact frontend CORS origins, and deployment-specific secrets. Never
commit `.env` files. Production startup does not seed the demo user and rejects
its public default password.

Crop predictions require N, P, K, temperature, humidity, pH, and rainfall inputs.
Model outputs are preliminary. Crop scores, fertilizer categories, disease
scores, and market forecasts have not all been independently validated for local
farms. Consult local agricultural expertise before acting on recommendations.

Frontend `.env` (optional): `VITE_API_URL=http://localhost:5000/api` — only needed if you
deploy the API elsewhere; locally the Vite proxy handles `/api` for you.

## API overview

```
POST /api/auth/register             Create an account
POST /api/auth/login                Sign in
GET  /api/auth/me                   Current signed-in user
GET  /api/agents/meta               Agent form metadata and availability
POST /api/agents/crop               Crop-model prediction (authenticated)
POST /api/agents/fertilizer         Nutrient-rating prediction (authenticated)
POST /api/agents/disease            JPEG/PNG image screening (authenticated)
GET  /api/farms                     List signed-in user's farms
POST /api/farms                     Create a farm
POST /api/farms/soil-report/extract Extract soil readings for farmer review
POST /api/orchestrator/farm         Assess a saved farm with selected agents
POST /api/orchestrator              Run supported direct agent requests
GET  /api/calendar                  List signed-in user's crop plans
POST /api/calendar/generate         Generate a crop activity plan
GET  /api/health                    Backend health
```

## 🗺️ Roadmap

- **Next** — verify the farm orchestrator end to end against running services,
  resolve the market-model failure, and evaluate crop/fertilizer models with
  local experts and representative data.
- **Then** — validate disease screening on local field images, improve soil
  report PDF/photo extraction, and verify official advisory and weather sources.
- **Before wider launch** — pilot with farmers, add reviewed translations and
  voice interactions, production monitoring, support, backups, and deployment
  rollback procedures.

See [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) for the complete
deployment-readiness checklist, current status, priorities, and release gate.

## 📁 Project structure

```
KisanAI/
├── frontend/                 # React website
│   └── src/
│       ├── api/              # Axios client and offline fallbacks
│       ├── components/       # Landing, app layout, and reusable UI
│       ├── context/          # Authentication and theme providers
│       ├── hooks/            # Shared data hooks
│       ├── pages/            # Public and authenticated pages
│       └── styles/           # Global and feature styles
├── backend/                  # Express API
│   └── src/
│       ├── agents/           # Agriculture decision agents
│       ├── data/             # Agronomy knowledge data
│       ├── database/
│       │   ├── config/       # Database connection
│       │   ├── models/       # Mongoose schemas
│       │   └── repositories/ # MongoDB/in-memory persistence
│       ├── middleware/       # Request authentication
│       └── routes/           # API route handlers
└── ml-service/               # All Python ML code, dependencies, and model artifacts
    ├── main.py               # FastAPI entry point
    ├── schemas.py            # Request and response schemas
    ├── requirements.txt      # ML service dependencies
    ├── models/               # Trained models, encoders, and FAISS index
    └── services/             # Crop, fertilizer, market, disease, and RAG logic
```

See [`ml-service/README.md`](./ml-service/README.md) for running the ML API.

## Checks and model limitations

The repository includes a GitHub Actions workflow for backend checks, frontend
lint/build, artifact-hash verification, and ML smoke checks. Review the Actions
run on GitHub after pushes; a configured workflow is not evidence that a release
has passed.

- Crop and fertilizer synthetic smoke checks pass; this does not establish
  accuracy or suitability for a particular farm.
- The market smoke check currently fails because a sample produces a
  non-positive forecast. The API rejects that value; do not use market output
  for farmer decisions yet.
- The disease artifact loads and returns a 38-class result. A blank-image guard
  rejects uniform images, but synthetic non-leaf patterns can still receive
  high scores. Field evaluation and score calibration are required.
- Fertilizer outputs are nutrient categories, not product or dose advice.
- RAG is disabled pending a verified, dated, source-linked knowledge corpus.
- The farm orchestrator needs a live end-to-end check with backend and ML
  services running together.

See [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) for the full audit,
remaining work, and release gate. See [`PILOT_SCOPE.md`](./PILOT_SCOPE.md) for
the proposed supervised pilot boundary.
