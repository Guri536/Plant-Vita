"""
vision_client.py
────────────────
Thin async wrapper around the Plant-Vita Vision Microservice.

The vision service runs on the host machine (outside Docker) at
VISION_SERVICE_URL (default: http://host.docker.internal:8001).

Usage inside a FastAPI BackgroundTask:
    from vision_client import call_vision_service
    result = await call_vision_service(jpeg_bytes)

All network errors are caught and returned as a degraded result dict so the
caller never has to handle exceptions — the upload always succeeds even if
vision analysis is temporarily unavailable.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("plantvita.backend.vision_client")

# ── Config ────────────────────────────────────────────────────────────────────

_BASE_URL: str = os.getenv(
    "VISION_SERVICE_URL",
    "http://host.docker.internal:8001",  # works on Docker Desktop (Mac / Win)
)

_API_KEY: str = os.getenv("VISION_INFERENCE_KEY", "")

# Total timeout per request.  SAM3 + ResNet can take 5-20 s on CPU.
_TIMEOUT_SECONDS: float = float(os.getenv("VISION_TIMEOUT", "60"))

# ── Sentinel returned when the service is unreachable ────────────────────────

_DEGRADED_RESULT: dict = {
    "species": None,
    "species_confidence": None,
    "in_model_scope": None,
    "health": None,
    "health_confidence": None,
    "green_density": None,
    "segmentation_success": False,
    "trigger_llm": True,  # safe default: always try Gemini if vision fails
    "vision_error": "Vision service unavailable",
}


# ── Client ────────────────────────────────────────────────────────────────────


async def call_vision_service(
    jpeg_bytes: bytes,
    plant_species: Optional[str],
    filename: str = "image.jpg",
) -> dict:
    """
    POST ``jpeg_bytes`` to ``POST {VISION_SERVICE_URL}/analyze``.

    Returns the parsed JSON dict on success, or ``_DEGRADED_RESULT`` on any
    network / HTTP error — so callers never need a try/except.

    Parameters
    ----------
    jpeg_bytes:
        Raw JPEG bytes straight from the ESP32-CAM upload.
    filename:
        Filename hint in the multipart payload (cosmetic only).
    """
    headers: dict[str, str] = {}
    if _API_KEY:
        headers["X-Inference-Key"] = _API_KEY

    ENDPOINT_URL = "analyze/targeted"

    if plant_species is None:
        ENDPOINT_URL = "analyze"

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{_BASE_URL}/{ENDPOINT_URL}",
                headers=headers,
                files={"file": (filename, jpeg_bytes, "image/jpeg")},
                data={"plant_name": plant_species},
            )
            response.raise_for_status()
            result: dict = response.json()
            logger.info(
                "Vision service OK — species=%s(%.2f) health=%s seg=%s",
                result.get("species"),
                result.get("species_confidence", 0.0),
                result.get("health"),
                result.get("segmentation_success"),
            )
            return result

    except httpx.TimeoutException:
        logger.error("Vision service timed out after %.0fs", _TIMEOUT_SECONDS)
        return {**_DEGRADED_RESULT, "vision_error": "Vision service timed out"}

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Vision service returned HTTP %d: %s",
            exc.response.status_code,
            exc.response.text[:200],
        )
        return {
            **_DEGRADED_RESULT,
            "vision_error": f"Vision service HTTP {exc.response.status_code}",
        }

    except Exception as exc:  # noqa: BLE001
        logger.error("Vision service unreachable: %s", exc)
        return {**_DEGRADED_RESULT, "vision_error": str(exc)}


async def check_vision_health() -> Optional[dict]:
    """
    Probe ``GET {VISION_SERVICE_URL}/health``.
    Returns the parsed JSON or None if the service is unreachable.
    Used by the backend's own ``/health`` endpoint.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{_BASE_URL}/health")
            r.raise_for_status()
            return r.json()
    except Exception:
        return None
