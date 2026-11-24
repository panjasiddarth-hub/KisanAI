# 🚀 KisanAI Deployment Guide

KisanAI is fully containerized and production-ready. You can deploy it using any of the standard production architectures below.

---

## 🏗️ Architecture Overview

The production system consists of three coordinated services:

```
┌────────────────────────────────────────────────────────┐
│                        Internet                        │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────▼────────────┐
               │    Frontend (Nginx)     │  Port 80 / 443
               │    React 19 + PWA App   │
               └────────────┬────────────┘
                            │ /api & /uploads
               ┌────────────▼────────────┐
               │     Backend (Node.js)   │  Port 5000
               │   Express API & Auth    │
               └──────┬────────────┬─────┘
                      │            │
                      │            ▼
                      │   ┌───────────────────┐
                      │   │  MongoDB Database │  Port 27017
                      │   │  Atlas or Docker  │
                      │   └───────────────────┘
                      ▼
        ┌───────────────────────────┐
        │     ML Service (FastAPI)  │  Port 8000
        │  Scikit-Learn, XGBoost,   │
        │      FAISS RAG Vector     │
        └───────────────────────────┘
```

---

## Option 1: One-Command Docker Deployment (Recommended for VPS / Cloud VMs)

**Best for:** DigitalOcean Droplet, AWS EC2, Hetzner, Linode, or any Linux server with Docker installed.

### Steps:
1. Clone your repository on your server:
   ```bash
   git clone <your-repo-url> kisanai
   cd kisanai
   ```

2. Configure production environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure:
   - `JWT_SECRET`: Generate a secure key (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)
   - `GEMINI_API_KEY`: Paste your free Google AI Studio key (optional, for Gemini AI explanations)
   - `MONGODB_URI`: Leave default for local Docker Mongo, or paste MongoDB Atlas URI

3. Build and launch all 4 containers in background:
   ```bash
   docker compose up -d --build
   ```

4. Verify status:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

Your app will be live at `http://your-server-ip`!

---

## Option 2: Render.com (1-Click Blueprint)

**Best for:** Free/low-cost cloud deployment with automated CI/CD and managed HTTPS.

This repository includes a [`render.yaml`](./render.yaml) blueprint.

### Steps:
1. Push your repository to **GitHub** or **GitLab**.
2. Log into [Render.com](https://render.com).
3. Go to **Blueprints** → **New Blueprint Instance**.
4. Select your `KisanAI` repository.
5. Render will automatically detect the 3 services (`kisanai-frontend`, `kisanai-backend`, `kisanai-ml-service`) and link their internal hostnames.
6. Provide your `MONGODB_URI` (from MongoDB Atlas) and optional `GEMINI_API_KEY` when prompted.
7. Click **Apply**.

---

## Option 3: Vercel (Frontend) + Render / Railway (Backend & ML)

**Best for:** Edge-distributed frontend with serverless scaling.

### Frontend on Vercel:
1. Connect your repository to [Vercel](https://vercel.com).
2. Set the **Root Directory** to `frontend`.
3. In Environment Variables:
   - `VITE_API_URL`: `https://your-backend-api.onrender.com/api`
4. Deploy! The included [`frontend/vercel.json`](./frontend/vercel.json) handles client-side routing rewrites automatically.

### Backend on Render / Railway:
1. Deploy `backend` as a Node web service:
   - Build command: `npm ci --omit=dev`
   - Start command: `node server.js`
   - Environment variables: `PORT=5000`, `JWT_SECRET=...`, `MONGODB_URI=...`, `ML_SERVICE_URL=https://your-ml-service...`

### ML Service on Render / Railway:
1. Deploy `ml-service` as a Python web service:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

---

## Option 4: Unified Single-Service Deployment

The backend server is configured to serve the compiled frontend (`public/` or `frontend/dist`) directly if present.

To build and run on a single container / instance:
```bash
# Build frontend
cd frontend
npm ci
npm run build
cd ..

# Copy frontend dist to backend public
cp -r frontend/dist backend/public

# Run backend
cd backend
npm ci --omit=dev
node server.js
```

---

## 🔒 Production Security Checklist

- [ ] **Generate a Strong `JWT_SECRET`**:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- [ ] **Configure MongoDB Atlas Whitelist**: Restrict IP access to your application server instead of `0.0.0.0/0`.
- [ ] **Enable HTTPS / SSL**: Handled automatically by Render / Vercel, or use Caddy / Certbot / Nginx Proxy Manager on a VPS.
- [ ] **Verify Private File Uploads**: Uploaded soil reports are saved to private account-scoped storage (`backend/uploads/`), backed up via Docker volumes.
