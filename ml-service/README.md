# KisanAI ML service

All machine-learning service files are grouped in this folder:

- `main.py` — FastAPI application and prediction endpoints.
- `schemas.py` — API request and response models.
- `requirements.txt` — Python dependencies for the service.
- `services/` — crop, fertilizer, market, disease, and retrieval logic.
- `models/` — trained model artifacts, encoders, and the FAISS index used by
  the service.

## Run locally

From this directory, create an isolated environment, install the core model
dependencies, and start the API:

```bash
python -m venv .venv
```

On Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On macOS/Linux, activate with `source .venv/bin/activate` and use the same
install and Uvicorn commands.

The API is available at `http://localhost:8000`; its interactive docs are at
`http://localhost:8000/docs`. Retrieval uses the FAISS embedding index when
`faiss-cpu` and `sentence-transformers` are installed, and falls back to local
keyword ranking otherwise. Disease predictions use symptom signatures; no
trained disease-model artifact is included.

Available prediction routes:

- `POST /predict/crop`
- `POST /predict/disease`
- `POST /predict/fertilizer`
- `POST /predict/market`
- `POST /predict/rag`
