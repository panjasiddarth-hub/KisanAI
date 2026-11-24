# ⚡ Deploying KisanAI to Vercel (Step-by-Step)

KisanAI is now pre-configured for **seamless deployment on Vercel**. 

You can deploy the entire application (React Frontend + Express API Serverless Functions) directly from your Git repository without any complex manual configuration.

---

## 🚀 Quick Deployment (2 Minutes)

### Step 1: Push your code to GitHub / GitLab
Make sure your latest code with `vercel.json` is committed and pushed:
```bash
git add .
git commit -m "feat: configure Vercel full-stack deployment"
git push origin main
```

---

### Step 2: Import into Vercel
1. Log into your account at [vercel.com](https://vercel.com).
2. Click **"Add New..."** → **"Project"**.
3. Select your **KisanAI** Git repository and click **Import**.
4. Leave the **Root Directory** as `./` (Root). Vercel will automatically detect `vercel.json` and build the frontend to `frontend/dist` while setting up `/api` as a serverless function!

---

### Step 3: Configure Environment Variables
In the Vercel **Environment Variables** section, add:

| Variable | Recommended Value | Notes |
|---|---|---|
| `JWT_SECRET` | *(Generate a 64-char key)* | Run `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `MONGODB_URI` | `mongodb+srv://...` | Paste your MongoDB Atlas URI. If omitted, the API uses in-memory mode. |
| `GEMINI_API_KEY` | `AIzaSy...` | *(Optional)* From [Google AI Studio](https://aistudio.google.com/apikey) for agronomy AI explanations. |
| `ML_SERVICE_URL` | `https://your-ml-service...` | *(Optional)* URL of your Python ML microservice if deployed on Render/Railway. |

---

### Step 4: Click Deploy! 🎉
Click **Deploy**. 
- Vercel will install dependencies, build the frontend Vite app, and deploy the serverless API.
- Your app will be live at `https://<your-project-name>.vercel.app`.

---

## ⚙️ How It Works on Vercel

```
https://<your-app>.vercel.app/
  ├── / (all pages)     ──> Serves compiled React 19 SPA (frontend/dist)
  ├── /api/*            ──> Handled by Vercel Serverless Function (api/index.js -> Express)
  └── /uploads/*        ──> Served from /tmp in Vercel Serverless
```

- **Zero CORS Issues**: Because both the React client and the Express API run on the exact same domain, requests to `/api` work without cross-origin configuration.
- **Client-Side Routing**: Direct navigation to routes like `/dashboard`, `/farms`, `/calendar` works cleanly without 404s thanks to SPA rewrites in [`vercel.json`](./vercel.json).
- **In-Memory & MongoDB Support**: When `MONGODB_URI` is provided, Mongoose connects to your cloud database. Without it, the backend gracefully runs in demo in-memory mode.

---

## 💡 What About the Python ML Service?
The core agronomy rule-engines (Crop Suggester, Fertilizer Plan, Disease Diagnostics) are self-contained in Node.js and run natively on Vercel!

If you also wish to connect the Python Machine Learning service (scikit-learn / XGBoost / FAISS vector index):
1. Deploy `ml-service/` on [Render.com](https://render.com) or [Railway.app](https://railway.app) (Python 3.12).
2. Copy the resulting URL (e.g., `https://kisanai-ml.onrender.com`).
3. Add the `ML_SERVICE_URL` environment variable in your Vercel project dashboard.
