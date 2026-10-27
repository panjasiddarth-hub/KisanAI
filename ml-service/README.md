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
`http://localhost:8000/docs`. Retrieval uses the FAISS embedding index and the
cached `all-MiniLM-L6-v2` embedding model; requests fail clearly if semantic
retrieval cannot load. There is no keyword-search substitute. RAG is currently
paused: the bundled index contains an undated local schemes CSV without
verifiable primary-source URLs. `/health` reports this and `/predict/rag`
returns HTTP 503 until a curated, source-linked corpus is reviewed. Crop, fertilizer,
and market predictions use the included serialized model artifacts. Those
scikit-learn artifacts were saved with scikit-learn 1.6.1; use a compatible
Python/scikit-learn environment to avoid cross-version pickle warnings. Disease
image screening uses `models/disease_model.keras`, TensorFlow and the ordered
38-class label list copied from its supplied inference app. It accepts JPEG/PNG
uploads at 224x224 RGB and uses a 70% score threshold. Its output is preliminary
screening only and has not been validated on local field photos.

Available prediction routes:

- `POST /predict/crop`
- `POST /predict/disease`
- `POST /predict/fertilizer`
- `POST /predict/market`
- `POST /predict/rag`

`/health` reports whether the disease artifact and TensorFlow runtime are
present. `POST /predict/disease` accepts a multipart `image` file containing a
JPEG or PNG. It returns the top label and model score, and withholds the label
below the configured threshold. It does not provide treatment recommendations.

The crop endpoint returns feature names stored in the model artifact and labels
its `predict_proba` output as a classifier score. These scores are not calibrated
probabilities of harvest success. The repository does not include the crop
model's training dataset or a manifest documenting feature units, especially
the rainfall reference period, or model evaluation/calibration. Verify those
details before using the shortlist to make planting decisions.

The market model artifact loads, but it is not validated for farmer decisions.
The included market smoke fixture currently produces an invalid (non-positive)
prediction, and the repository does not document the target currency, quantity
unit, forecast horizon, training data, or evaluation metrics. The API rejects
non-finite and non-positive prices instead of presenting them as forecasts.
Do not change the input scale or force a positive output without evidence from
the original training pipeline and labeled validation data. `/health` labels
the market artifact as experimental until this validation is complete.

## Artifact manifest and provenance

`models/model-manifest.json` records the known input/target interfaces, SHA-256 hashes, runtime constraints, and provenance gaps for the included models. Unknown dataset sources, training dates, units, and evaluation metrics are explicitly left undocumented; do not infer them from the model files. The fertilizer classifier outputs nutrient ratings, not fertilizer product or application-rate recommendations. The market prediction's currency, quantity unit, and forecast horizon are not documented.

Verify downloaded/copied artifact files from this directory without loading or executing serialized model files:

```bash
python scripts/verify_model_manifest.py
```

The disease model labels come from the provided inference script; the model's
original training pipeline and local-field evaluation data have not been
independently verified. The knowledge assistant also remains paused until the
retrieval corpus has verified primary-source URLs and publication dates.

## Available-model smoke check

From `ml-service`, run:

```bash
python scripts/smoke_models.py
```

This exercises crop, fertilizer, and market predictions with synthetic contract samples and checks response structure and basic numeric validity. It does not measure accuracy, establish agronomic suitability, or test disease/RAG. Run it inside the environment created from `requirements.txt`; a passing result under a different runtime is only a local diagnostic.
