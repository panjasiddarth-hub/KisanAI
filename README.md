# 🌾 KisanAI — Sampoorn Kisan AI Sahayak

AI-powered agricultural decision-support platform for Indian farmers. A farmer gets
crop recommendations, fertilizer plans, disease diagnosis and a full AI-planned crop
calendar — explained in plain language.

> B.Tech Major Project 2026 · Full-stack JavaScript (React + Node.js)

---

## ✨ Level-1 Features (working today)

| Feature | What it does |
|---|---|
| 🌱 **Crop Suggester Agent** | Shows up to three crop-model suggestions from soil-test NPK, pH, and local weather; manual inputs still have an explainable rule-engine fallback |
| 🧪 **Fertilizer Agent** | Crop + acreage + soil → exact N-P-K dose, Urea/DAP/MOP kg (per acre & total), stage-wise schedule, organic options, cautions |
| 🩺 **Disease Agent** | Crop + observed symptoms (+ optional leaf photo) → top-3 likely diseases with confidence, chemical & organic treatment, prevention |
| 📅 **Farm Calendar** | Pick a crop + sowing date → complete AI season plan: land prep, basal fertilizer, irrigation rhythm, pest scouting, weeding, harvest window. **Events come from the other agents — a true multi-agent pipeline.** Tick off activities as you go |
| 🏡 **My Farm onboarding** | Save and resume farm profiles; drag a map pin to select the farm location; upload a soil-test photo or PDF for a simple explanation and editable readings |
| 🌱 **Personalized crop shortlist** | After saving a soil report, automatically load its readings and local weather, show up to three crop suggestions, and link to official scheme resources to check |
| 🔐 **Real backend auth** | JWT login/register (bcrypt-hashed). Seeded demo: `siddarth@kisan.com` / `password123` |
| 🤖 **Hybrid AI** | Deterministic rule engines first (offline-safe, viva-friendly); optional **Gemini** layer rewrites explanations when an API key is set |

Plus the full app shell: dashboard, dark mode, notifications, farms/crops management,
market/schemes/weather/analytics pages (currently mock data — Level 2).

My Farm labels unavailable information explicitly. The current market route uses
seeded inputs; verified regional costs, yields, current prices, profit estimates,
and scheme eligibility are not configured. Scheme links are starting points only:
they do not confirm eligibility, deadlines, or benefits. Crop-model scores are not
yield or profit estimates. Soil reports are sent to Google Gemini for reading when
the configured API key is used; farmers should check extracted readings against
their original report before relying on them.

## 🧱 Architecture

```
frontend/  React 19 · Vite 8 · Tailwind v4 · react-router 7 · axios · chart.js
   │  calls /api (vite proxy → :5000)
backend/   Node.js · Express · JWT (jsonwebtoken) · bcryptjs · multer · mongoose
   ├── src/agents/    cropAgent · fertilizerAgent · diseaseAgent · gemini
   ├── src/routes/    API endpoints
   ├── src/data/      agronomy knowledge bases
   ├── src/config/    MongoDB connection
   ├── src/models/    Mongoose schemas
   └── src/repositories/ in-memory/MongoDB persistence store
ml-service/ Python ML models and retrieval service
```

## 🚀 Quick start (three terminals)

**Prereqs:** Node.js 20.19+ or 22 LTS, Python 3.12, and Git.

```bash
# Terminal 1 — backend API (PowerShell; isolated in-memory mode)
cd backend
npm ci
$env:PORT = "5001"
$env:KISANAI_IN_MEMORY = "1"
npm run dev         # http://localhost:5001

# Terminal 2 — frontend (PowerShell)
cd frontend
npm ci
$env:VITE_API_PROXY_TARGET = "http://localhost:5001"
npm run dev -- --host 127.0.0.1 --port 5174

# Terminal 3 — ML API (PowerShell; first install may download packages/model data)
cd ml-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open http://localhost:5174 → login with **siddarth@kisan.com / password123**.
The local backend uses in-memory data that resets when it restarts; it does not
connect to MongoDB. The ML API is available at http://localhost:8000/docs. Its
RAG service downloads `all-MiniLM-L6-v2` on first startup if that embedding model
is not already cached. The bundled market XGBoost artifact currently fails to
deserialize, so `/predict/market` is unavailable until it is repaired or
re-exported; the artifact has been left unchanged.

## 🔧 Optional configuration (`backend/.env`, see `.env.example`)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Paste a free MongoDB Atlas URI for persistent users & plans. Without it, the API uses in-memory mode (data resets on restart) |
| `KISANAI_IN_MEMORY` | Set to `1` to force an isolated in-memory store even if `MONGODB_URI` is configured |
| `GEMINI_API_KEY` | Free key from [Google AI Studio](https://aistudio.google.com/apikey). Enables AI explanations and soil-report reading; uploaded report contents are sent to Google Gemini. Without it, report reading is unavailable and explanations use templates |
| `JWT_SECRET` | Token signing secret (change for anything real) |
| `PORT` | Default 5000 |

The frontend proxies `/api` and `/uploads` to `http://localhost:5000` by default.
Set `VITE_API_PROXY_TARGET` before starting Vite when using another backend port.
`VITE_API_URL` can be set to an absolute API URL to bypass the proxy.

## 🔌 API summary

Authenticated farm APIs provide profile and draft CRUD, history, activities, crop
recommendation generation, and saved crop selection. All farm-specific operations
are scoped to the authenticated user's farm ownership.

Soil reports are limited to 8 MB, checked by file signature, and stored in
account-scoped private storage outside the public uploads directory. The Crop
Suggester uses forecast rainfall (mm), not rain probability, when loading local
weather for a saved farm. Missing model inputs are shown for the farmer to supply;
they are not inferred.

```
POST /api/auth/register        { name, email, password } → { token, user }
POST /api/auth/login           { email, password }       → { token, user }
GET  /api/auth/me              Bearer token              → { user }

GET  /api/agents/meta          form metadata (soils, seasons, crops, symptoms)
POST /api/agents/crop          { N, P, K, temperature, humidity, ph, rainfall } → model-ranked crops; soilType/season/irrigation are fallback inputs
POST /api/agents/fertilizer    { crop, areaAcres, soilType }        → NPK plan
POST /api/agents/disease       multipart: crop, symptoms(JSON), image? → diagnosis

GET    /api/calendar           Bearer → my plans
POST   /api/calendar/generate  Bearer { crop, sowingDate, areaAcres } → plan
PATCH  /api/calendar/:id/events/:i   { done } → tick activity
DELETE /api/calendar/:id

POST   /api/farms/soil-reports/parse  multipart `report` → extracted soil readings and private report reference
GET    /api/farms/:id/soil-report     ****** → saved private report file
DELETE /api/farms/soil-reports/:id    ****** → remove an unattached report upload
```

## 🗺️ Roadmap

- **Level 2** — real image-based disease detection (TensorFlow), live weather API
  (OpenWeather/IMD), market prices (Agmarknet/data.gov.in), multilingual AI chat
- **Level 3** — real crewAI-style orchestrator, XGBoost yield prediction, SMS/WhatsApp alerts

## 📁 Project structure

```
KisanAI/
├── frontend/                 # React website
│   └── src/
│       ├── api/              # Axios client and offline fallbacks
│       ├── assets/           # Application and landing-page images
│       ├── components/       # App layout, landing helpers, and reusable UI
│       ├── context/          # Authentication and theme providers
│       ├── hooks/            # Shared data hooks
│       ├── pages/            # Pages grouped by account, advisory, auth, farm, insights, and public
│       └── index.css         # Global and landing styles
├── backend/                  # Express API
│   └── src/
│       ├── agents/           # Agriculture decision agents
│       ├── config/           # Database connection
│       ├── data/             # Agronomy knowledge data
│       ├── models/           # Mongoose schemas
│       ├── middleware/       # Request authentication
│       ├── repositories/     # MongoDB/in-memory persistence
│       └── routes/           # API route handlers
└── ml-service/               # All Python ML code, dependencies, and model artifacts
    ├── main.py               # FastAPI entry point
    ├── schemas.py            # Request and response schemas
    ├── requirements.txt      # ML service dependencies
    ├── models/               # Trained models, encoders, and FAISS index
    └── services/             # Crop, fertilizer, market, and RAG logic
```

See [`ml-service/README.md`](./ml-service/README.md) for running the ML API.

## 🧪 Verified

- Backend: all endpoints exercised (login → JWT, 3 agents, calendar CRUD)
- Frontend: `oxlint` 0 errors, `vite build` clean
- E2E (Playwright, real backend): login → crop suggestion → fertilizer plan →
  disease diagnosis → calendar generation → activity persistence — all passing
  (`frontend/e2e-level1.py`)
