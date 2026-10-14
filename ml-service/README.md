# KisanAI ML service

All machine-learning service files are grouped in this folder:

- `main.py` — FastAPI application and prediction endpoints.
- `schemas.py` — API request and response models.
- `requirements.txt` — Python dependencies for the service.
- `services/` — crop, fertilizer, market, disease, and retrieval logic.
- `models/` — trained model artifacts, encoders, and the FAISS index used by
  the service.

## Run locally

From this directory, install the Python dependencies and start the API:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

The API is available at `http://localhost:8000`; its interactive docs are at
`http://localhost:8000/docs`.
