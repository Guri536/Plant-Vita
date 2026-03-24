# Plant-Vita — Vision Microservice

Standalone Python/FastAPI service that runs **natively on the host machine**
(not in Docker) and is called by the Dockerised FastAPI backend over HTTP.

---

## What it does

| Step | Component | Details |
|------|-----------|---------|
| 1 | **Color standardisation** | Gray World white balance + CLAHE on LAB L-channel — same transform as `ColorStandardising.py` |
| 2 | **SAM3 segmentation** | Generic text-prompted segmentation; isolates the plant from pot and background |
| 3 | **Green pixel density** | HSV hue 35-85 fraction **within the mask only** (or full image if segmentation failed) |
| 4 | **ResNet18 inference** | Dual-head classifier: 6-class species + 4-class health, `best_model.pth` checkpoint |
| 5 | **Response assembly** | `in_model_scope`, `trigger_llm` flags computed from confidence thresholds |

---

## Architecture

```
Docker network
┌──────────────────────────────────────┐
│  FastAPI backend (container)         │
│  POST http://host.docker.internal:   │
│       8001/analyze                   │
└──────────────────┬───────────────────┘
                   │ HTTP (multipart JPEG)
                   ▼
Host machine
┌──────────────────────────────────────┐
│  Vision Microservice (uvicorn :8001) │
│  ┌────────────┐  ┌────────────────┐  │
│  │ SAM3 model │  │ ResNet18 model │  │
│  │ (GPU/CPU)  │  │ (GPU/CPU)      │  │
│  └────────────┘  └────────────────┘  │
└──────────────────────────────────────┘
```

The backend sets `VISION_SERVICE_URL=http://host.docker.internal:8001` (or
`http://localhost:8001` on Linux with `--network host`).

---

## Quick start

### 1. Install dependencies

```bash
cd vision_service/
pip install -r requirements.txt
```

For GPU support install a CUDA-enabled PyTorch wheel from [pytorch.org](https://pytorch.org/get-started/locally/) **before** running the line above.

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set MODEL_CHECKPOINT, SAM3_CHECKPOINT, SAM3_CONFIG, INFERENCE_API_KEY
source .env
```

### 3. Run

```bash
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001} --workers 1
```

or 

```bash
uvicorn main:app --env-file .env --host 0.0.0.0 --port 8001 --workers 1
```

> **`--workers 1` is mandatory.**  
> SAM3's `SAM3SemanticPredictor` is stateful (holds an image embedding between
> `set_image()` and `__call__()`). Multiple workers would race on this state and
> double GPU memory usage.

---

## API reference

### `GET /health`

Liveness probe. Returns HTTP 200 while the process is alive.

```json
{
  "status": "ok",
  "models_loaded": true,
  "device": "cuda"
}
```

`status` is `"loading"` during the startup window (~15-60 s) while SAM3 and
ResNet18 initialise. Do not route traffic until `models_loaded` is `true`.

---

### `POST /analyze`

| Property | Value |
|----------|-------|
| Content-Type | `multipart/form-data` |
| Field name | `file` |
| Payload | Raw JPEG bytes from the ESP32-CAM |
| Auth header | `X-Inference-Key: <INFERENCE_API_KEY>` |

**Response schema**

```json
{
  "species":              "Hibiscus",
  "species_confidence":  0.4312,
  "in_model_scope":      false,
  "health":              "Wilting",
  "health_confidence":   0.8147,
  "green_density":       0.6200,
  "segmentation_success": true,
  "trigger_llm":         true
}
```

| Field | Type | Notes |
|-------|------|-------|
| `species` | string | One of: `Aloevera`, `Bamboo`, `Basil`, `Hibiscus`, `Money Plant`, `Rose` |
| `species_confidence` | float | Softmax probability for the top species |
| `in_model_scope` | bool | `true` when `species_confidence ≥ 0.70` |
| `health` | string | One of: `Healthy`, `Infected`, `Wilting`, `Unhealthy` |
| `health_confidence` | float | Softmax probability for the top health class |
| `green_density` | float | Fraction of masked pixels that are green (HSV hue 35-85, S≥40, V≥40) |
| `segmentation_success` | bool | `false` if SAM3 failed — inference still runs on the full image |
| `trigger_llm` | bool | `true` when `!in_model_scope` OR `health != "Healthy"` |

**Error responses**

| Code | Meaning |
|------|---------|
| 400 | Empty file payload |
| 401 | Wrong or missing `X-Inference-Key` |
| 422 | File could not be decoded as an image |
| 503 | Models still loading — retry after a few seconds |

## Calling from the Dockerised backend

In the backend container, call the service via:

```python
# backend — example httpx call
import httpx, os

VISION_URL = os.getenv("VISION_SERVICE_URL", "http://host.docker.internal:8001")
KEY        = os.getenv("VISION_INFERENCE_KEY", "")

async def call_vision(image_bytes: bytes) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{VISION_URL}/analyze",
            headers={"X-Inference-Key": KEY},
            files={"file": ("image.jpg", image_bytes, "image/jpeg")},
        )
        r.raise_for_status()
        return r.json()
```

On **Linux** you may need `--network host` in the backend's Docker run command,
and set `VISION_SERVICE_URL=http://localhost:8001` instead.

---

## File structure

```
vision_service/
├── main.py           FastAPI app — endpoints + lifespan model loading
├── pipeline.py       VisionPipeline class — all compute steps
├── model_arch.py     PlantVitaModel (ResNet18 + dual heads) + label lists
├── requirements.txt
├── .env.example
└── README.md
```