# 🌾 KisanAI — Sampoorn Kisan AI Sahayak

Agricultural decision-support platform for Indian farmers with local crop,
soil-nutrient, market and leaf-image screening models. Disease image screening is
preliminary and has not been validated on local field photos.

> B.Tech Major Project 2026 · Full-stack JavaScript (React + Node.js)

---

## ✨ Level-1 Features (working today)

| Feature | What it does |
|---|---|
| 🌱 **Crop Suggester Agent** | Soil NPK + temperature + humidity + pH + rainfall → top-3 crop classes with model scores |
| 🧪 **Soil Nutrient Model** | Soil-test measurements → ML-predicted nutrient ratings. This artifact does not predict fertilizer application rates. |
| 🩺 **Disease Agent** | 38-class leaf-photo screening through the MobileNetV2 `.keras` model; low-score predictions are withheld. |
| 📅 **Farm Calendar** | Pick a crop + sowing date → a deterministic crop calendar with preparation, irrigation, scouting and harvest activities. |
| 🔐 **Real backend auth** | JWT login/register (bcrypt-hashed). Seeded demo: `siddarth@kisan.com` / `password123` |
| 🤖 **Model-backed prediction APIs** | Crop, fertilizer-rating, market, and semantic retrieval routes call their ML artifacts directly; there is no rule-based prediction fallback. Optional **Gemini** rewrites explanations only. |

Plus the full app shell: dashboard, dark mode, notifications, farms/crops management,
market/schemes/weather/analytics pages. Market forecasts currently use sample historical inputs.

## 🧱 Architecture

```
frontend/  React 19 · Vite 8 · Tailwind v4 · react-router 7 · axios · chart.js
   │  calls /api (vite proxy → :5000)
backend/   Node.js · Express · JWT (jsonwebtoken) · bcryptjs · multer · mongoose
   ├── src/agents/    ML output validation · source-grounded Gemini answers
   ├── src/routes/    API endpoints
   ├── src/data/      agronomy knowledge bases
   └── src/database/  MongoDB connection · Mongoose models · persistence store
ml-service/ Python ML models and retrieval service
```

## 🚀 Quick start (three terminals)

**Prereqs:** Node.js 20.19+ or 22 LTS, and Python 3.11–3.13 with the ML dependencies installed.

```bash
# Terminal 1 — ML API (required for predictions)
cd ml-service
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2 — backend API
cd backend
npm install
npm start           # http://localhost:5000  (in-memory mode, no DB needed)

# Terminal 3 — frontend
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Open http://localhost:5173 → login with **siddarth@kisan.com / password123**.

## 🔧 Optional configuration (`backend/.env`, see `.env.example`)

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

Production also requires `MONGODB_URI`. The demo user is local-development
only; production startup will not create it and will stop if its public default
password remains active in the configured database.

Crop predictions require N, P, K, temperature, humidity, pH, and rainfall inputs.
The fertilizer model predicts nutrient ratings from a full soil-test report; it does
not produce fertilizer application rates. The market model currently receives sample
historical price inputs. Disease image screening requires TensorFlow and
`ml-service/models/disease_model.keras`; its score is not calibrated and it is not
a confirmed diagnosis. Ask a local agricultural expert before taking treatment action.

Frontend `.env` (optional): `VITE_API_URL=http://localhost:5000/api` — only needed if you
deploy the API elsewhere; locally the Vite proxy handles `/api` for you.

## 🔌 API summary

```
POST /api/auth/register        { name, email, password } → { token, user }
POST /api/auth/login           { email, password }       → { token, user }
GET  /api/auth/me              Bearer token              → { user }
POST /api/auth/logout          Bearer token              → revoke account sessions
POST /api/auth/change-password current + new password    → new token, revoke other sessions
GET  /api/auth/export          Bearer token              → account/farm/crop/calendar JSON export
DELETE /api/auth/account       password + email confirm  → delete account-owned records

GET  /api/agents/meta          form metadata (soils, seasons, crops, symptoms)
POST /api/agents/crop          { soilType, ph, season, irrigation } → ranked crops
POST /api/agents/fertilizer    { crop, areaAcres, soilType }        → NPK plan
POST /api/agents/disease       multipart image (JPEG/PNG) → preliminary leaf-image screening
POST /api/orchestrator         { question, language } → semantic sources + grounded answer when Gemini is configured
POST /api/orchestrator         { crop?, fertilizer?, market?, rag? } → requested agent results + validation + evidence explanations

GET    /api/calendar           Bearer → my plans
POST   /api/calendar/generate  Bearer { crop, sowingDate, areaAcres } → plan
PATCH  /api/calendar/:id/events/:i   { done } or { date } → update a task
DELETE /api/calendar/:id
```

## 🗺️ Roadmap

- **Next** — verify orchestrator against a running ML API, improve expert-reviewed validation,
  add browser-supported voice input/output and source-grounded multilingual chat
- **Later** — disease model field validation and expert-reviewed guidance, reliable live weather and mandi feeds,
  field pilots, production monitoring, SMS/WhatsApp alerts, and supported model retraining

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

## Continuous integration

GitHub Actions runs backend tests, frontend lint/build, model-artifact hash
verification, and crop/fertilizer/market inference smoke checks on pushes and
pull requests. The CI ML job uses Python 3.12 and `ml-service/requirements-ci.txt`
to keep artifact checks quicker than installing the full retrieval runtime.
The first hosted Actions run still needs to be observed before treating CI as
an established deployment gate.

## 🧪 Current checks

- Crop, fertilizer-rating, and market model artifacts each loaded and returned a sample prediction in the local Python environment.
- Backend orchestrator tests pass for categorical inputs, invalid calendar values, incomplete nutrient outputs, and validation blocking.
- Authenticated API smoke checks passed for login, farm listing, and crop/fertilizer/market orchestration; unauthenticated orchestrator access returns HTTP 401.
- Semantic RAG retrieval returned results from the FAISS index.
- Frontend lint and production build pass.
- Disease model loading and a synthetic image inference returned 38 class scores; the full API/browser journey still needs local-server verification.
- Orchestrator source passes Node syntax checks; frontend lint and production build passed in earlier local checks.
- Gemini-grounded explanations and the complete browser-driven farm-to-calendar journey still need end-to-end verification.
