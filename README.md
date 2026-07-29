kkkkkkk
# 🌾 KisanAI — Sampoorn Kisan AI Sahayak

AI-powered agricultural decision-support platform for Indian farmers. A farmer gets
crop recommendations, fertilizer plans, disease diagnosis and a full AI-planned crop
calendar — explained in plain language.

> B.Tech Major Project 2026 · Full-stack JavaScript (React + Node.js)

---

## ✨ Level-1 Features (working today)

| Feature | What it does |
|---|---|
| 🌱 **Crop Suggester Agent** | Soil type + pH + season + water availability → top-5 ranked crops with suitability % and per-crop reasons (fully explainable) |
| 🧪 **Fertilizer Agent** | Crop + acreage + soil → exact N-P-K dose, Urea/DAP/MOP kg (per acre & total), stage-wise schedule, organic options, cautions |
| 🩺 **Disease Agent** | Crop + observed symptoms (+ optional leaf photo) → top-3 likely diseases with confidence, chemical & organic treatment, prevention |
| 📅 **Farm Calendar** | Pick a crop + sowing date → complete AI season plan: land prep, basal fertilizer, irrigation rhythm, pest scouting, weeding, harvest window. **Events come from the other agents — a true multi-agent pipeline.** Tick off activities as you go |
| 🔐 **Real backend auth** | JWT login/register (bcrypt-hashed). Seeded demo: `siddarth@kisan.com` / `password123` |
| 🤖 **Hybrid AI** | Deterministic rule engines first (offline-safe, viva-friendly); optional **Gemini** layer rewrites explanations when an API key is set |

Plus the full app shell: dashboard, dark mode, notifications, farms/crops management,
market/schemes/weather/analytics pages (currently mock data — Level 2).

## 🧱 Architecture

```
frontend/  React 19 · Vite 8 · Tailwind v4 · react-router 7 · axios · chart.js
   │  calls /api (vite proxy → :5000)
backend/   Node.js · Express · JWT (jsonwebtoken) · bcryptjs · multer · mongoose
   ├── src/agents/    cropAgent · fertilizerAgent · diseaseAgent · gemini
   ├── src/routes/    auth · agents · calendar
   ├── src/data/      crops.js (agronomy KB) · diseases.js (symptom KB)
   └── store          MongoDB when MONGODB_URI set, else in-memory (demo mode)
```

## 🚀 Quick start (two terminals)

**Prereqs:** Node.js 20.19+ or 22 LTS.

```bash
# Terminal 1 — backend API
cd backend
npm install
npm start           # http://localhost:5000  (in-memory mode, no DB needed)

# Terminal 2 — frontend
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Open http://localhost:5173 → login with **siddarth@kisan.com / password123**.

## 🔧 Optional configuration (`backend/.env`, see `.env.example`)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Paste a free MongoDB Atlas URI for persistent users & plans. Empty → in-memory demo mode (data resets on restart) |
| `GEMINI_API_KEY` | Free key from [Google AI Studio](https://aistudio.google.com/apikey). Set → agent explanations are AI-written ("✨ Gemini AI" badge); unset → deterministic templates ("Rule Engine" badge) |
| `JWT_SECRET` | Token signing secret (change for anything real) |
| `PORT` | Default 5000 |

Frontend `.env` (optional): `VITE_API_URL=http://localhost:5000/api` — only needed if you
deploy the API elsewhere; locally the Vite proxy handles `/api` for you.

## 🔌 API summary

```
POST /api/auth/register        { name, email, password } → { token, user }
POST /api/auth/login           { email, password }       → { token, user }
GET  /api/auth/me              Bearer token              → { user }

GET  /api/agents/meta          form metadata (soils, seasons, crops, symptoms)
POST /api/agents/crop          { soilType, ph, season, irrigation } → ranked crops
POST /api/agents/fertilizer    { crop, areaAcres, soilType }        → NPK plan
POST /api/agents/disease       multipart: crop, symptoms(JSON), image? → diagnosis

GET    /api/calendar           Bearer → my plans
POST   /api/calendar/generate  Bearer { crop, sowingDate, areaAcres } → plan
PATCH  /api/calendar/:id/events/:i   { done } → tick activity
DELETE /api/calendar/:id
```

## 🗺️ Roadmap

- **Level 2** — real image-based disease detection (TensorFlow), live weather API
  (OpenWeather/IMD), market prices (Agmarknet/data.gov.in), multilingual AI chat
- **Level 3** — real crewAI-style orchestrator, XGBoost yield prediction, SMS/WhatsApp alerts

## 📁 Project structure

```
KisanAI/
├── backend/            # Express API + agents (this README covers it)
├── frontend/
│   └── src/
│       ├── api/        # axios client + offline fallbacks
│       ├── pages/      # Dashboard, CropSuggester, FertilizerAgent, Disease, Calendar, …
│       ├── components/ # layout (Sidebar/Topbar) + ui kit
│       └── context/    # AuthContext (API + offline demo fallback)
└── dist/               # last production build of the frontend
```

## 🧪 Verified

- Backend: all endpoints exercised (login → JWT, 3 agents, calendar CRUD)
- Frontend: `oxlint` 0 errors, `vite build` clean
- E2E (Playwright, real backend): login → crop suggestion → fertilizer plan →
  disease diagnosis → calendar generation → activity persistence — all passing
  (`frontend/e2e-level1.py`)
