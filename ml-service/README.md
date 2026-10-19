# KisanAI ML service

All machine-learning service files are grouped in this folder:

- `main.py` — FastAPI application and prediction endpoints.
- `schemas.py` — API request and response models.
- `requirements.txt` — Python dependencies for the service.
- `services/` — crop, fertilizer, market, and retrieval logic.
- `models/` — trained model artifacts, encoders, and the FAISS index used by
  the service.

## Run locally

Use Python 3.12 for the checked-in scikit-learn artifacts. From this directory,
create an isolated environment, install the declared dependencies, and start the API:

```bash
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://localhost:8000`; its interactive docs are at
`http://localhost:8000/docs`. The first startup may download the
`all-MiniLM-L6-v2` sentence-transformer used by RAG if it is not cached locally.

The bundled market XGBoost artifact currently fails to deserialize in the
configured runtime (`input stream corrupted`), so `/predict/market` returns an
error until that artifact is repaired or re-exported. The artifact has not been
modified; health, crop, fertilizer, and RAG endpoints were verified separately.
