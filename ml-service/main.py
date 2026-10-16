from fastapi import FastAPI, HTTPException

from schemas import (
    CropRequest,
    CropResponse,
    DiseaseRequest,
    DiseaseResponse,
    FertilizerRequest,
    FertilizerResponse,
    MarketRequest,
    MarketResponse,
    RAGRequest,
    RAGResponse,
)

from services.crop import predict_crop
from services.disease import predict_disease
from services.fertilizer import predict_fertilizer
from services.market import predict_market
from services.rag import retrieve_documents


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
    return {
        "status": "healthy"
    }


@app.post("/predict/crop", response_model=CropResponse)
def crop_prediction(request: CropRequest):
    return predict_crop(request.model_dump())


@app.post("/predict/disease", response_model=DiseaseResponse)
def disease_prediction(request: DiseaseRequest):
    try:
        return predict_disease(request.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/predict/fertilizer", response_model=FertilizerResponse)
def fertilizer_prediction(request: FertilizerRequest):
    return predict_fertilizer(request.model_dump())


@app.post("/predict/market", response_model=MarketResponse)
def market_prediction(request: MarketRequest):
    return predict_market(request.model_dump())


@app.post("/predict/rag", response_model=RAGResponse)
def rag_prediction(request: RAGRequest):
    results = retrieve_documents(
        request.question,
        request.top_k
    )

    return {
        "question": request.question,
        "results": results
    }