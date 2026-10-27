from functools import lru_cache
from io import BytesIO
from pathlib import Path

import numpy as np
from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError


MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "disease_model.keras"
CONFIDENCE_THRESHOLD = 70.0
CLASS_NAMES = [
    "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___Healthy",
    "Blueberry___Healthy", "Cherry_(including_sour)___Powdery_mildew", "Cherry_(including_sour)___Healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight", "Corn_(maize)___Healthy", "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", "Grape___Healthy",
    "Orange___Haunglongbing_(Citrus_greening)", "Peach___Bacterial_spot", "Peach___Healthy",
    "Pepper,_bell___Bacterial_spot", "Pepper,_bell___Healthy", "Potato___Early_blight",
    "Potato___Late_blight", "Potato___Healthy", "Raspberry___Healthy", "Soybean___Healthy",
    "Squash___Powdery_mildew", "Strawberry___Leaf_scorch", "Strawberry___Healthy",
    "Tomato___Bacterial_spot", "Tomato___Early_blight", "Tomato___Late_blight", "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot", "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot", "Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Tomato___Tomato_mosaic_virus",
    "Tomato___Healthy",
]


@lru_cache(maxsize=1)
def load_disease_model():
    if not MODEL_PATH.is_file():
        raise RuntimeError(f"Disease model file not found: {MODEL_PATH}")
    try:
        import tensorflow as tf
    except ImportError as error:
        raise RuntimeError("TensorFlow is not installed for the disease model.") from error
    # Keep native Windows CPU inference responsive and avoid oversubscribing
    # the same CPU used by the Node and frontend development servers.
    tf.config.threading.set_intra_op_parallelism_threads(1)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    output_shape = model.output_shape
    if len(CLASS_NAMES) != output_shape[-1]:
        raise RuntimeError(f"Disease label count ({len(CLASS_NAMES)}) does not match model output ({output_shape[-1]}).")
    return model


def disease_model_available() -> bool:
    return MODEL_PATH.is_file()


def predict_disease_image(image: UploadFile) -> dict:
    try:
        model = load_disease_model()
    except (RuntimeError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    try:
        contents = image.file.read()
        with Image.open(BytesIO(contents)) as opened:
            rgb = opened.convert("RGB").resize((224, 224))
            pixels = np.asarray(rgb, dtype=np.float32)[np.newaxis, ...]
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=415, detail="Upload a valid JPEG or PNG leaf image.") from error

    if float(np.std(pixels)) < 2.0:
        raise HTTPException(status_code=422, detail="Image appears blank or has too little visual detail. Upload a clear leaf photo.")

    scores = np.asarray(model(pixels, training=False))[0]
    if scores.shape != (len(CLASS_NAMES),) or not np.isfinite(scores).all():
        raise HTTPException(status_code=503, detail="Disease model returned invalid class scores.")
    index = int(np.argmax(scores))
    confidence = float(scores[index] * 100)
    accepted = confidence >= CONFIDENCE_THRESHOLD
    return {
        "prediction": CLASS_NAMES[index] if accepted else None,
        "topPrediction": CLASS_NAMES[index],
        "confidence": round(confidence, 2),
        "accepted": accepted,
        "threshold": CONFIDENCE_THRESHOLD,
        "modelSource": "Plant-Disease-Detector MobileNetV2 fine-tuned model",
        "disclaimer": "Image-model output is a preliminary screening result, not a confirmed diagnosis. Confirm with a local agricultural expert before treatment.",
    }
