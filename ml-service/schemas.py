from pydantic import BaseModel, Field


class CropRequest(BaseModel):
    N: float = Field(..., ge=0)
    P: float = Field(..., ge=0)
    K: float = Field(..., ge=0)
    temperature: float
    humidity: float = Field(..., ge=0, le=100)
    ph: float = Field(..., ge=0, le=14)
    rainfall: float = Field(..., ge=0)


class CropResponse(BaseModel):
    prediction: str
    recommendations: list[dict]

class FertilizerRequest(BaseModel):
    pH: float = Field(..., ge=0, le=14)
    EC_dS_per_m: float = Field(..., ge=0)
    OC_percent: float = Field(..., ge=0)

    N_kg_per_ha: float = Field(..., ge=0)
    P_kg_per_ha: float = Field(..., ge=0)
    K_kg_per_ha: float = Field(..., ge=0)

    S_ppm: float = Field(..., ge=0)
    Zn_ppm: float = Field(..., ge=0)
    B_ppm: float = Field(..., ge=0)
    Fe_ppm: float = Field(..., ge=0)
    Cu_ppm: float = Field(..., ge=0)
    Mn_ppm: float = Field(..., ge=0)

    Soil_Type: str
    Season: str

class FertilizerResponse(BaseModel):
    ratings: dict
    modelSource: str

class MarketRequest(BaseModel):
    lag_1: float = Field(..., ge=0)
    lag_2: float = Field(..., ge=0)
    lag_3: float = Field(..., ge=0)

    rolling_mean_3: float = Field(..., ge=0)
    rolling_std_3: float = Field(..., ge=0)

    month: int = Field(..., ge=1, le=12)
    day_of_year: int = Field(..., ge=1, le=366)

    Commodity: str
    Market: str
    State: str


class MarketResponse(BaseModel):
    predicted_price: float
    Commodity: str
    Market: str
    State: str
    modelSource: str

class RAGRequest(BaseModel):
    question: str = Field(..., min_length=3)
    top_k: int = Field(default=3, ge=1, le=10)


class RAGResponse(BaseModel):
    question: str
    results: list[dict]

class MarketResponse(BaseModel):
    predicted_price: float
    Commodity: str
    Market: str
    State: str
    modelSource: str


class RAGRequest(BaseModel):
    question: str = Field(..., min_length=3)
    top_k: int = Field(default=3, ge=1, le=10)


class RAGResponse(BaseModel):
    question: str
    results: list[dict]