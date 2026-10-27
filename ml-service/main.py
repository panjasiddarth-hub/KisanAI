from fastapi import FastAPI, File, HTTPException, UploadFile
from pathlib import Path
from importlib.util import find_spec

from schemas import (
    CropRequest,
    CropResponse,
    FertilizerRequest,
    FertilizerResponse,
    MarketRequest,
    MarketResponse,
    RAGRequest,
    RAGResponse,
)

from services.crop import predict_crop
from services.disease import disease_model_available, predict_disease_image
from services.fertilizer import predict_fertilizer
from services.market import predict_market
from services.rag import retrieve_documents


# The bundled FAISS index only contains an undated local scheme CSV with no
# primary-source URLs. Keep retrieval disabled until a curated corpus is built.
RAG_CORPUS_VERIFIED = False


app = FastAPI(
    title="KisanAI ML Service",
    description="Machine Learning service for KisanAI",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "service": "KisanAI ML Service",
        "status": "running"
    }


@app.get("/health")
def health():
    models_dir = Path(__file__).resolve().parent / "models"
    semantic_ready = (
        (models_dir / "kisanai_faiss.index").exists()
        and (models_dir / "kisanai_chunks.pkl").exists()
        and find_spec("faiss") is not None
        and find_spec("sentence_transformers") is not None
    )
    return {
        "status": "degraded",
        "models": {
            "crop": "available",
            "fertilizer": "available",
            "market": "artifact loaded; experimental and not validated for farmer decisions",
            "disease": "available" if disease_model_available() and find_spec("tensorflow") is not None else "unavailable: model artifact or TensorFlow runtime missing",
            "rag": "unavailable: reference corpus provenance is not verified" if not RAG_CORPUS_VERIFIED else ("available" if semantic_ready else "unavailable"),
            "ragCorpusVerified": RAG_CORPUS_VERIFIED,
        },
    }


@app.post("/predict/crop", response_model=CropResponse)
def crop_prediction(request: CropRequest):
    return predict_crop(request.model_dump())


@app.post("/predict/disease")
async def disease_prediction(image: UploadFile = File(...)):
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=415, detail="Only JPEG or PNG images are accepted.")
    return predict_disease_image(image)


@app.post("/predict/fertilizer", response_model=FertilizerResponse)
def fertilizer_prediction(request: FertilizerRequest):
    return predict_fertilizer(request.model_dump())


@app.post("/predict/market", response_model=MarketResponse)
def market_prediction(request: MarketRequest):
    return predict_market(request.model_dump())


@app.post("/predict/rag", response_model=RAGResponse)
def rag_prediction(request: RAGRequest):
    if not RAG_CORPUS_VERIFIED:
        raise HTTPException(
            status_code=503,
            detail="Knowledge retrieval is paused until its source documents and dates are verified.",
        )
    try:
        results = retrieve_documents(request.question, request.top_k)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {
        "question": request.question,
        "results": results
    }
