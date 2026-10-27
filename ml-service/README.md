# KisanAI ML service

All machine-learning service files are grouped in this folder:

- `main.py` — FastAPI application and prediction endpoints.
- `schemas.py` — API request and response models.
- `requirements.txt` — Python dependencies for the service.
- `services/` — crop, fertilizer, market, disease, soil-report and retrieval logic.
- `models/` — trained model artifacts and the reviewed `rag_corpus.json` source corpus.

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
`http://localhost:8000/docs`. RAG uses a local TF-IDF retrieval index built in
memory from the curated source summaries in `models/rag_corpus.json`. Every
entry must have an HTTPS `.gov.in` or `.nic.in` URL and a source review date
within the last year. Responses include the source title, publisher, link, scope,
review date and retrieved excerpt. `/health` reports corpus readiness;
`/predict/rag` returns no documents when nothing meets the relevance threshold.
It does not call Gemini; the Node orchestrator optionally uses Gemini to compose
a concise answer from retrieved excerpts and displays the official links. The
current corpus covers Soil Health Cards, PM-KISAN, e-NAM and PMFBY, in English.
This is a reviewed starter corpus, not comprehensive agricultural coverage.
Crop, fertilizer, and market predictions use the included serialized model artifacts. Those
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

The market model artifact loads from the native XGBoost JSON file, and the
local synthetic smoke fixture produces a positive finite output with the pinned
XGBoost 3.2.0 runtime. The same fixture was invalid under the older 2.1.4
environment, confirming that the runtime pin matters. The booster configuration
reports XGBoost 3.2.0 and objective `reg:squarederror`; inference no longer loads
the pickled XGBoost wrapper. The original pickle is retained but not used. The
repository does not document the target
currency, quantity unit, forecast horizon, training data, or evaluation
metrics. The API rejects non-finite and non-positive prices instead of
presenting them as forecasts. A positive synthetic output does not validate a
market forecast for farmers; `/health` therefore continues to label the market
artifact experimental.

## Artifact manifest and provenance

`models/model-manifest.json` records the known input/target interfaces, SHA-256 hashes, runtime constraints, and provenance gaps for the included models. Unknown dataset sources, training dates, units, and evaluation metrics are explicitly left undocumented; do not infer them from the model files. The fertilizer classifier outputs nutrient ratings, not fertilizer product or application-rate recommendations. The market prediction's currency, quantity unit, and forecast horizon are not documented.

Verify downloaded/copied artifact files from this directory without loading or executing serialized model files:

```bash
python scripts/verify_model_manifest.py
```

The disease model labels come from the provided inference script; the model's
original training pipeline and local-field evaluation data have not been
independently verified. The previous FAISS index and pickle chunks came from an
undated local CSV and are no longer used for RAG; the reviewed JSON corpus is the
active source of retrieval content.

## Available-model smoke check

From `ml-service`, run:

```bash
python scripts/smoke_models.py
```

This exercises crop, fertilizer, and market predictions with synthetic contract samples and checks response structure and basic numeric validity. It does not measure accuracy, establish agronomic suitability, or test disease/RAG. Run it inside the environment created from `requirements.txt`; a passing result under a different runtime is only a local diagnostic.

## Regional model evaluation

No labeled training or regional evaluation dataset is included. When one is
available, run `python scripts/evaluate_models.py --help` for the optional CSV
and image-folder inputs. Crop CSVs need the artifact's seven input features,
`actual_crop`, and preferably `state`. Fertilizer CSVs need the context/value
features plus all nine rating target columns. Market CSVs need the seven lag/
calendar features, `Commodity`, `Market`, `State`, `actual_price`, and
`observation_date`; the tool evaluates the last 20% of rows after sorting by
date. Document currency and quantity units, and calculate each lag using only
prices available before that observation. Disease images
must be in subfolders named with the exact 38 output labels; split by farm and
capture date to avoid leakage. The tool writes metrics only for supplied data;
it does not certify agronomic suitability. Ask a qualified regional agronomist
to review the dataset, rating labels, crop shortlists, and disease errors before
any farmer-facing release.
