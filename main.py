from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from pipeline import VisionPipeline

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("plantvita.vision")

# ── Pipeline singleton ────────────────────────────────────────────────────────
# Declared at module level so lifespan can mutate it and the endpoint can read it.

_pipeline: VisionPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context.
    Models are loaded here (blocking) before the first request is accepted.
    This prevents cold-start latency on the first real request and makes
    the /health endpoint meaningful.
    """
    global _pipeline
    logger.info("Plant-Vita Vision Service — startup")

    _pipeline = VisionPipeline()
    logger.info(f"Device selected: {_pipeline.device}")

    _pipeline.load_models()   # blocks until ResNet18 + SAM3 are ready
    logger.info("All models loaded — service ready")

    yield  # ←── service handles requests from here

    logger.info("Plant-Vita Vision Service — shutdown")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title        = "Plant-Vita Vision Microservice",
    description  = (
        "Stateless compute service: "
        "color standardization → SAM3 segmentation → "
        "green pixel density → ResNet18 dual-head inference."
    ),
    version      = "1.0.0",
    lifespan     = lifespan,
    docs_url     = "/docs",
    redoc_url    = "/redoc",
)

# ── Auth dependency ───────────────────────────────────────────────────────────

_REQUIRED_KEY: str = os.getenv("INFERENCE_API_KEY", "")


def _require_key(
    x_inference_key: Annotated[str, Header()] = "",
) -> None:
    """
    Validates the X-Inference-Key header against INFERENCE_API_KEY env var.
    If the env var is empty the endpoint is effectively open (dev mode).
    """
    if _REQUIRED_KEY and x_inference_key != _REQUIRED_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing X-Inference-Key header",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get(
    "/health",
    summary="Service liveness and model status",
    tags=["ops"],
)
def health() -> dict:
    """
    Returns HTTP 200 while the process is alive.
    Check `models_loaded` before sending traffic — it will be `false` during
    the warm-up window (typically 15-60 s depending on hardware).
    """
    loaded = _pipeline is not None and _pipeline.models_loaded
    return {
        "status":        "ok" if loaded else "loading",
        "models_loaded": loaded,
        "device":        _pipeline.device if _pipeline else "unknown",
    }


@app.post(
    "/analyze",
    summary="Run the full vision pipeline on a plant image",
    tags=["vision"],
    dependencies=[Depends(_require_key)],
    response_description="Structured inference result",
)
async def analyze(
    file: UploadFile = File(
        ...,
        description="Raw JPEG image captured by the ESP32-CAM",
    ),
) -> JSONResponse:
    """
    **Pipeline steps (in order):**
    1. Decode JPEG → OpenCV BGR
    2. Gray World white balance + CLAHE
    3. SAM3 semantic segmentation (generic plant prompts)
    4. Green pixel density on the segmented mask
    5. ResNet18 dual-head inference (species + health)

    If SAM3 segmentation fails the service does **not** return an error —
    it falls back to running inference on the full image and sets
    `segmentation_success: false` in the response.
    """
    # Guard: models not ready yet (race during startup)
    if _pipeline is None or not _pipeline.models_loaded:
        raise HTTPException(
            status_code=503,
            detail="Models are still loading — retry in a few seconds",
        )

    # Read raw bytes
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file payload")

    # Decode image
    arr = np.frombuffer(contents, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not decode the uploaded file as an image. "
                "Ensure the ESP32-CAM is sending valid JPEG bytes."
            ),
        )

    # Full pipeline (never raises — segmentation failures are handled internally)
    result = _pipeline.run(img)
    return JSONResponse(content=result)