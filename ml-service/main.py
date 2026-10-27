from fastapi import FastAPI, File, HTTPException, UploadFile
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
from services.market import InvalidMarketForecastError, predict_market
from services.rag import rag_status, retrieve_documents
from services.soil_report import extract_soil_report_pdf


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
    rag = rag_status()
    return {
        "status": "degraded",
        "models": {
            "crop": "available",
            "fertilizer": "available",
            "market": "artifact loaded; experimental and not validated for farmer decisions",
            "disease": "available" if disease_model_available() and find_spec("tensorflow") is not None else "unavailable: model artifact or TensorFlow runtime missing",
            "rag": "available" if rag["available"] else rag["detail"],
            "ragCorpusVerified": rag["available"],
            "ragDetails": rag,
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


@app.post("/extract/soil-report/pdf")
async def soil_report_pdf_extraction(report: UploadFile = File(...)):
    if report.content_type != "application/pdf":
        raise HTTPException(status_code=415, detail="Upload a PDF for local text extraction.")
    contents = await report.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Soil report PDFs must be 5 MB or smaller.")
    try:
        return extract_soil_report_pdf(contents)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/predict/fertilizer", response_model=FertilizerResponse)
def fertilizer_prediction(request: FertilizerRequest):
    return predict_fertilizer(request.model_dump())


@app.post("/predict/market", response_model=MarketResponse)
def market_prediction(request: MarketRequest):
    try:
        return predict_market(request.model_dump())
    except InvalidMarketForecastError as error:
        raise HTTPException(
            status_code=503,
            detail="The market model could not produce a valid forecast for these inputs. No price has been returned.",
        ) from error


@app.post("/predict/rag", response_model=RAGResponse)
def rag_prediction(request: RAGRequest):
    status = rag_status()
    if not status["available"]:
        raise HTTPException(
            status_code=503,
            detail=status["detail"],
        )
    try:
        results = retrieve_documents(request.question, request.top_k)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {
        "question": request.question,
        "results": results
    }
