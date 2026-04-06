<<<<<<< HEAD
"""
main.py  (updated)
───────────────────
Plant-Vita FastAPI backend.

Changes vs original:
  • POST /plants/{mac_address}/image/
      - Accepts multipart JPEG from ESP32-CAM
      - Saves to Google Cloud Storage (or local disk as fallback)
      - Fires a BackgroundTask that:
          1. Calls the host-side Vision Microservice → ResNet18 + SAM3
          2. Writes all vision fields back to the Image row
          3. If trigger_llm is True → calls Gemini API for a diagnosis
  • GET /plants/{plant_id}/images/   — list all images for a plant
  • GET /plants/{plant_id}/diagnosis/ — latest image + vision + Gemini result
  • GET /health                      — backend + vision service liveness
"""

from __future__ import annotations

import logging
=======
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from pydantic import BaseModel
>>>>>>> 9877486 (Frontend With Prediction model)
import os
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import AsyncGenerator, List, cast, Any
import aiofiles
import base64

<<<<<<< HEAD
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    UploadFile,
    status,
    Form,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload
from sqlmodel import SQLModel, select

from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_hashed_password,
    verify_password,
)
from models import Image, Plant, SensorReading, User
from schemas import (
    ImageRead,
    ImageUploadResponse,
    PlantCreate,
    PlantRead,
    PlantUpdate,
    PlantSummary,
    SensorReadingCreate,
    SensorReadingRead,
    SocialLogin,
    Token,
    TokenData,
    TokenRefreshRequest,
    UserCreate,
    UserRead,
    DeviceRegister,
    DeviceRegisterResponse,
)
from vision_client import call_vision_service, check_vision_health
from fastapi.staticfiles import StaticFiles


# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("plantvita.backend")

# ── Config ────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DB_URL")
API_SECRET_KEY = os.getenv("API_SECRET_KEY")
GCS_BUCKET = os.getenv("GCS_BUCKET", "")  # optional — falls back to local

if not DATABASE_URL:
    raise RuntimeError("DB_URL environment variable is not set")
if not API_SECRET_KEY:
    raise RuntimeError("API_SECRET_KEY environment variable is not set")

# ── Database ──────────────────────────────────────────────────────────────────

engine = create_async_engine(DATABASE_URL, echo=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Plant-Vita Backend", lifespan=lifespan)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8010", "http://127.0.0.1:8010"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/received_images", StaticFiles(directory="received_images"), name="images")


# ── Auth helpers ──────────────────────────────────────────────────────────────


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception

    result = await session.execute(select(User).where(User.email == token_data.email))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user


# ── Image storage helper ──────────────────────────────────────────────────────


async def _store_image(jpeg_bytes: bytes, mac: str, image_id: int) -> str:
    """
    Store JPEG bytes and return a public URL.

    If GCS_BUCKET is configured, stream to Google Cloud Storage.
    Otherwise, write to ./received_images/ (dev/fallback mode).
    """
    filename = f"plant_{mac}_{image_id}.jpg"

    if GCS_BUCKET:
        try:
            from google.cloud import storage as gcs  # type: ignore[import]

            client = gcs.Client()
            blob = client.bucket(GCS_BUCKET).blob(f"images/{filename}")
            blob.upload_from_string(jpeg_bytes, content_type="image/jpeg")
            blob.make_public()
            return blob.public_url
        except Exception as exc:
            logger.warning("GCS upload failed, falling back to local: %s", exc)

    # Local fallback — useful in development / before GCS is wired
    import aiofiles  # pip install aiofiles

    local_dir = "received_images"
    os.makedirs(local_dir, exist_ok=True)
    path = os.path.join(local_dir, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(jpeg_bytes)
    return f"/received_images/{filename}"  # relative URL — serve with StaticFiles if needed


# ── Vision background task ────────────────────────────────────────────────────


async def _run_vision_and_LLM_inference(
    image_id: int,
    jpeg_bytes: bytes,
    plant_id: int,
    force_universal: bool = False,
) -> None:
    """
    BackgroundTask: calls Vision Microservice → writes results → optional Gemini call.

    Runs after the HTTP response has already been sent to the ESP32-CAM so the
    device doesn't have to wait for SAM3 + ResNet18 (~5-20 s on CPU).
    """
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        result = await session.execute(select(Plant).where(Plant.id == plant_id))
        plant = result.scalars().first()

    if not plant or not plant.species:
        raise HTTPException(status_code=404, detail="Plant not found")

    # ── 1. Call Vision Microservice ───────────────────────────────────────────
    vision = await call_vision_service(
        jpeg_bytes,
        filename=f"plant_{plant_id}.jpg",
        plant_species=plant.species,
        force_universal=force_universal,
    )

    # ── 2. Persist vision fields ──────────────────────────────────────────────
    async with async_session() as session:
        result = await session.execute(select(Image).where(Image.id == image_id))
        img = result.scalars().first()
        if img is None:
            logger.error("Image row %d not found — vision results discarded", image_id)
            return

        img.green_density = vision.get("green_density")
        img.segmentation_success = vision.get("segmentation_success")
        img.detected_species = vision.get("species")
        img.species_confidence = vision.get("species_confidence")
        img.in_model_scope = vision.get("in_model_scope")
        img.detected_health = vision.get("health")
        img.health_confidence = vision.get("health_confidence")
        img.trigger_llm = vision.get("trigger_llm")
        img.vision_error = vision.get("vision_error")

        session.add(img)
        await session.commit()

    logger.info(
        "Vision results written for image_id=%d  trigger_llm=%s",
        image_id,
        vision.get("trigger_llm"),
    )

    # ── 3. OpenRouter diagnosis (only when trigger_llm is True) ───────────────────
    if vision.get("trigger_llm"):
        await _call_openrouter(image_id, img.image_url, async_session)


async def _call_gemini(
    image_id: int,
    image_url: str,
    async_session_maker: async_sessionmaker,
) -> None:
    """
    Calls the Gemini Vision API with the stored image URL and writes the
    natural-language diagnosis back to the Image row.

    Requires GEMINI_API_KEY in the environment.
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key:
        logger.warning("GEMINI_API_KEY not set — skipping Gemini diagnosis")
        return

    try:
        import google.generativeai as genai  # type: ignore[import]

        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "You are a plant pathologist. Analyze this plant image and answer:\n"
            "1. Is the plant healthy? If not, what disease or condition is visible?\n"
            "2. What are the visible symptoms?\n"
            "3. What treatment or care changes do you recommend?\n"
            "Be concise (3-5 sentences)."
        )
        response = model.generate_content([{"url": image_url}, prompt])
        diagnosis = response.text.strip()
    except Exception as exc:
        logger.error("Gemini API call failed: %s", exc)
        diagnosis = f"Gemini API error: {exc}"

    async with async_session_maker() as session:
        result = await session.execute(select(Image).where(Image.id == image_id))
        img = result.scalars().first()
        if img:
            img.ai_diagnosis = diagnosis
            session.add(img)
            await session.commit()
    logger.info("Gemini diagnosis written for image_id=%d", image_id)


async def _call_openrouter(
    image_id: int,
    image_url: str,
    async_session_maker: async_sessionmaker,
) -> None:
    """
    Calls a Vision LLM via OpenRouter with the stored image URL and writes the
    natural-language diagnosis back to the Image row.

    Now uses dynamic context (Sensor data, history, and vision pre-scans).
    Requires OPENROUTER_API_KEY in the environment.
    """
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
    if not openrouter_key:
        logger.warning("OPENROUTER_API_KEY not set — skipping LLM diagnosis")
        return

    # ── Handle Local vs. Cloud Image URLs ────────────────────────────────────
    payload_image_url = image_url

    # If the URL doesn't start with http, it's a local file.
    if not image_url.startswith("http"):
        import base64
        import aiofiles

        # Strip the leading slash so it correctly points to the local folder
        # relative to where you run your FastAPI app (e.g., "received_images/...")
        local_file_path = image_url.lstrip("/")

        try:
            async with aiofiles.open(local_file_path, "rb") as img_file:
                image_bytes = await img_file.read()
                base64_encoded = base64.b64encode(image_bytes).decode("utf-8")
                # Create the standard Data URI format that Vision LLMs expect
                payload_image_url = f"data:image/jpeg;base64,{base64_encoded}"
        except FileNotFoundError:
            logger.error("Could not find local image on disk: %s", local_file_path)
            # Write error to DB and exit early
            async with async_session_maker() as session:
                result = await session.execute(
                    select(Image).where(Image.id == image_id)
                )
                if img := result.scalars().first():
                    img.ai_diagnosis = (
                        "Error: Local image file lost before AI analysis."
                    )
                    session.add(img)
                    await session.commit()
            return

    # ── 1. Gather Context from Database ──────────────────────────────────────
    async with async_session_maker() as session:
        # Get current image and plant ID
        img_result = await session.execute(select(Image).where(Image.id == image_id))
        current_img = img_result.scalars().first()
        if not current_img:
            return

        plant_id = current_img.plant_id

        # Get plant details
        plant_result = await session.execute(select(Plant).where(Plant.id == plant_id))
        plant = plant_result.scalars().first()
        plant_species = plant.species if plant and plant.species else "Unknown Plant"

        # Get latest sensor reading
        sensor_result = await session.execute(
            select(SensorReading)
            .where(SensorReading.plant_id == plant_id)
            .order_by(SensorReading.timestamp.desc())  # type: ignore[attr-defined]
            .limit(1)
        )
        latest_sensor = sensor_result.scalars().first()

        # Get previous AI diagnosis (skip the current image)
        history_result = await session.execute(
            select(Image)
            .where(
                Image.plant_id == plant_id,
                Image.id != image_id,
                Image.ai_diagnosis != None,
            )
            .order_by(Image.timestamp.desc())  # type: ignore[attr-defined]
            .limit(1)
        )
        last_image = history_result.scalars().first()

    # ── 2. Format Variables for the Prompt ───────────────────────────────────
    if latest_sensor:
        temp = f"Air: {latest_sensor.temp_c}°C | Soil: {latest_sensor.soil_temp_c}°C"
        moisture = f"Surface: {latest_sensor.soil_surface_pct}% | Root: {latest_sensor.soil_root_pct}%"
        humidity = f"{latest_sensor.humidity_pct}%"
        lux = f"{latest_sensor.light_lux} lx"
        air = (
            f"PPM: {latest_sensor.air_ppm} | Quality: {latest_sensor.air_quality_pct}%"
        )
    else:
        temp = moisture = humidity = lux = air = "Sensor offline/Unknown"

    if last_image and last_image.ai_diagnosis:
        past_history = last_image.ai_diagnosis[:300] + "..."
    else:
        past_history = "No previous diseases recorded."

    if current_img.detected_health:
        pre_scan = f"Local Vision AI predicts: {current_img.detected_health} (Confidence: {current_img.health_confidence})"
    else:
        pre_scan = "No local vision prescan available."

    # ── 3. The Mega-Prompt ───────────────────────────────────────────────────
    prompt = f"""You are an expert plant pathologist and agronomist. 
Analyze the provided plant image alongside its environmental sensor data and medical history to provide a highly accurate diagnosis.

### 📊 Contextual Data
* **Plant Species:** {plant_species}
* **Current Sensor Readings:** - Temperature: {temp} 
  - Moisture: {moisture} 
  - Ambient Humidity: {humidity} 
  - Light: {lux}
  - Air Metrics: {air}
* **Vision AI Pre-scan:** {pre_scan}
* **Past Diagnostic History:** {past_history}

### 🎯 Your Task
Based on the visual evidence in the image AND the contextual data provided above, provide a comprehensive assessment:

1. **Primary Diagnosis:** What is the most likely issue? (Consider diseases, pests, watering habits, or environmental stress).
2. **Data Correlation:** Explicitly explain how the visible symptoms correlate with the sensor readings or past history. 
3. **Recommended Action:** Provide 2-3 specific, actionable steps to remedy the situation based on the data.

### 📝 Output Rules
* Be concise and professional.
* Do not hallucinate data; if the sensor data contradicts the visual image, point out the discrepancy.
* Format your response using clear markdown headings and bullet points for readability.
"""

    # ── 4. Call OpenRouter ───────────────────────────────────────────────────
    try:
        from openai import AsyncOpenAI, RateLimitError, APIStatusError

        client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
            max_retries=2,
        )

        fallback_models = [
            "google/gemma-3-27b-it:free",
            "meta-llama/llama-3.2-11b-vision-instruct:free",
            "qwen/qwen2.5-vl-72b-instruct:free",
            "openrouter/auto",  # 'auto' is generally better than 'free' for fallback routing on OpenRouter
        ]

        diagnosis = None

        for model_id in fallback_models:
            try:
                logger.info(f"Attempting OpenRouter diagnosis with {model_id}...")

                response = await client.chat.completions.create(
                    model=model_id,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": payload_image_url},
                                },
                            ],
                        }
                    ],
                    extra_headers={
                        "HTTP-Referer": "https://your-site-url.com",
                        "X-Title": "Plant-Vita",
                    },
                )

                diagnosis = (
                    response.choices[0].message.content
                    or "OpenRouter didn't return a diagnosis"
                ).strip()
                logger.info(f"Successfully got diagnosis from {model_id}")
                break  # Success! Break out of the loop.

            except RateLimitError:
                logger.warning(
                    f"Model {model_id} is rate-limited (429). Trying next fallback..."
                )
                continue

            except APIStatusError as e:
                if e.status_code == 429:
                    logger.warning(
                        f"Model {model_id} returned a 429 status. Trying next fallback..."
                    )
                    continue
                # If it's a 400 (Bad Request) or 500 (Internal Server Error), still failover
                logger.warning(
                    f"Model {model_id} failed with status {e.status_code}: {e}. Trying next..."
                )
                continue

            except Exception as e:
                logger.warning(
                    f"Model {model_id} failed with unexpected error: {e}. Trying next..."
                )
                continue

        if not diagnosis:
            logger.error("All fallback models failed or were rate-limited.")
            diagnosis = "AI diagnosis is temporarily unavailable due to high server load. Please try again later."

    except Exception as exc:
        logger.error("OpenRouter API call failed: %s", exc)
        diagnosis = f"OpenRouter API error: {exc}"

    # ── 5. Write the diagnosis back to the database ──────────────────────────
    async with async_session_maker() as session:
        # Re-fetch the image row in a new session to ensure we don't hit state issues
        result = await session.execute(select(Image).where(Image.id == image_id))
        img = result.scalars().first()
        if img:
            img.ai_diagnosis = diagnosis
            session.add(img)
            await session.commit()

    logger.info("OpenRouter diagnosis written for image_id=%d", image_id)


# ═════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════


# ── Ops ───────────────────────────────────────────────────────────────────────


@app.get("/")
def read_root():
    return {"message": "Plant-Vita backend is running", "database": "Connected"}


@app.get("/health", tags=["ops"])
async def health():
    """Backend liveness + vision service reachability."""
    vision_status = await check_vision_health()
    return {
        "backend": "ok",
        "vision_service": vision_status or "unreachable",
    }


# ── Auth ───────────────────────────────────────────────────────────────────────


@app.post("/register", response_model=UserRead)
async def register_user(
    user: UserCreate,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.email == user.email))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = User(email=user.email, hash_pass=get_hashed_password(user.password))
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    return db_user


@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.hash_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "access_token": create_access_token(data={"sub": user.email}),
        "refresh_token": create_refresh_token(data={"sub": user.email}),
        "token_type": "bearer",
    }


@app.post("/social-login", response_model=Token)
async def social_login(
    login_data: SocialLogin,
    x_api_key: str = Header(...),
    session: AsyncSession = Depends(get_session),
):
    if x_api_key != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    result = await session.execute(select(User).where(User.email == login_data.email))
    user = result.scalars().first()
    if not user:
        db_user = User(email=login_data.email, hash_pass="SOCIAL_LOGIN_NO_PASS")
        session.add(db_user)
        await session.commit()
        await session.refresh(db_user)

    return {
        "access_token": create_access_token(
            data={"sub": login_data.email},
            expires_delta=timedelta(minutes=15),
        ),
        "refresh_token": create_refresh_token(data={"sub": login_data.email}),
        "token_type": "bearer",
    }


@app.post("/refresh", response_model=Token)
async def refresh_token(
    request: TokenRefreshRequest,
    session: AsyncSession = Depends(get_session),
):
    payload = decode_token(request.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await session.execute(select(User).where(User.email == email))
    if not result.scalars().first():
        raise HTTPException(status_code=401, detail="User no longer exists")

    return {
        "access_token": create_access_token(data={"sub": email}),
        "refresh_token": create_refresh_token(data={"sub": email}),
        "token_type": "bearer",
    }


# ── Plants ────────────────────────────────────────────────────────────────────


@app.post("/plants/", response_model=PlantRead)
async def create_plant(
    plant: PlantCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    db_plant = Plant(**plant.model_dump(), owner_id=current_user.id or 0)
    session.add(db_plant)
    await session.commit()
    await session.refresh(db_plant)
    return db_plant


@app.get("/plants/{plant_id}", response_model=PlantRead)
async def read_plant(
    plant_id: int,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Plant)
        .where(Plant.id == plant_id)
        .options(selectinload(Plant.sensor_readings))  # type: ignore[arg-type]
    )
    plant = result.scalars().first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


@app.get("/plants/my_plants", response_model=List[PlantRead])
async def read_my_plants(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Plant)
        .where(Plant.owner_id == current_user.id)
        .options(selectinload(Plant.sensor_readings))  # type: ignore[arg-type]
    )
    return result.scalars().all()


@app.post("/devices/register", response_model=DeviceRegisterResponse)
async def register_device(
    payload: DeviceRegister,
    session: AsyncSession = Depends(get_session),
):

    # 1. Find user by email
    user_result = await session.execute(select(User).where(User.email == payload.email))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Check if device already exists
    plant_result = await session.execute(
        select(Plant).where(Plant.mac_address == payload.mac_address)
    )
    existing_plant = plant_result.scalars().first()

    if existing_plant:
        # Transfer ownership
        existing_plant.owner_id = cast(int, user.id)
        await session.commit()
        await session.refresh(existing_plant)
        return {"registered": True, "is_new": False, "plant_id": existing_plant.id}

    # 3. Auto-increment plant name per user
    user_plants_result = await session.execute(
        select(Plant).where(Plant.owner_id == cast(int, user.id))
    )
    user_plants = user_plants_result.scalars().all()
    plant_number = str(len(user_plants) + 1).zfill(2)
    plant_name = f"Plant {plant_number}"

    # 4. Create new plant
    new_plant = Plant(
        owner_id=cast(int, user.id),
        mac_address=payload.mac_address,
        name=plant_name,
        moisture_threshold_min=20,
        moisture_threshold_max=80,
    )
    session.add(new_plant)
    await session.commit()
    await session.refresh(new_plant)

    return {"registered": True, "is_new": True, "plant_id": cast(int, new_plant.id)}


# ── Sensor readings ───────────────────────────────────────────────────────────


@app.post("/plants/{mac_address}/readings/", response_model=SensorReadingRead)
async def create_sensor_reading(
    mac_address: str,
    reading: SensorReadingCreate,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Plant).where(Plant.mac_address == mac_address)
    )
    plant = result.scalars().first()
    if not plant:
        raise HTTPException(status_code=404, detail="Device/Plant not registered")

    db_reading = SensorReading(**reading.model_dump(), plant_id=cast(int, plant.id))
    session.add(db_reading)
    await session.commit()
    await session.refresh(db_reading)
    return db_reading


# ── Image upload (IoT → Backend → Vision Service) ─────────────────────────────


@app.post(
    "/plants/{mac_address}/image/",
    response_model=ImageUploadResponse,
    status_code=201,
    summary="ESP32-CAM image upload",
    tags=["iot"],
)
async def upload_plant_image(
    mac_address: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    force_universal: bool = Form(False),
    session: AsyncSession = Depends(get_session),
):
    """
    **Device-facing endpoint** — called by the ESP32-CAM firmware.

    1. Looks up the plant by MAC address (404 if not registered).
    2. Stores the JPEG (GCS or local fallback).
    3. Creates an Image row immediately.
    4. Fires a BackgroundTask to:
       - Call the Vision Microservice (SAM3 + ResNet18)
       - Optionally call Gemini for a natural-language diagnosis
    5. Returns HTTP 201 to the device **without waiting** for vision analysis.
    """
    # Verify device is registered
    result = await session.execute(
        select(Plant).where(Plant.mac_address == mac_address)
    )
    plant = result.scalars().first()
    if not plant:
        raise HTTPException(
            status_code=404,
            detail=f"Device with MAC {mac_address} is not registered to any plant",
        )

    # Read bytes
    jpeg_bytes = await file.read()
    if not jpeg_bytes:
        raise HTTPException(status_code=400, detail="Empty image payload")

    # Create a stub Image row to get the auto-generated id before storage
    db_image = Image(
        plant_id=cast(int, plant.id),
        image_url="",  # filled in below once we have the id
    )
    session.add(db_image)
    await session.commit()
    await session.refresh(db_image)

    # Store the image and update the URL
    image_url = await _store_image(jpeg_bytes, mac_address, cast(int, db_image.id))
    db_image.image_url = image_url
    session.add(db_image)
    await session.commit()

    # Kick off vision + Gemini in the background
    background_tasks.add_task(
        _run_vision_and_LLM_inference,
        image_id=cast(int, db_image.id),
        jpeg_bytes=jpeg_bytes,
        plant_id=cast(int, plant.id),
        force_universal=force_universal,
    )

    return ImageUploadResponse(
        id=cast(int, db_image.id),
        image_url=image_url,
    )


# ── Image history & diagnosis ─────────────────────────────────────────────────


BASE_URL = "http://192.168.137.1:8000"


@app.get(
    "/plants/{plant_id}/images/", 
    response_model=List[ImageRead]
 )
async def get_plant_images(
    plant_id: int, 
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(
        select(Image)
        .where(Image.plant_id == plant_id)
        .order_by(Image.timestamp.desc())  # type: ignore[attr-defined]
    )
    db_images = result.scalars().all()

    for img in db_images:
        if img.image_url and not img.image_url.startswith("http"):
            # Clean up the path and prepend the base URL
            path = img.image_url.lstrip("/")
            img.image_url = f"{BASE_URL}/{path}"

    return db_images


@app.get(
    "/plants/{plant_id}/diagnosis/",
    response_model=ImageRead,
    summary="Latest AI diagnosis for a plant",
    tags=["vision"],
)
async def get_latest_diagnosis(
    plant_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Returns the most recent Image row with full vision and Gemini results.
    If the background task has not finished yet, vision fields will be null —
    the client should poll this endpoint until ``vision_error`` is null and
    ``detected_health`` is populated.
    """
    result = await session.execute(
        select(Image)
        .where(Image.plant_id == plant_id)
        .order_by(Image.timestamp.desc()) # type: ignore[attr-defined]
        .limit(1)
    )
    img = result.scalars().first()
    if not img:
        raise HTTPException(status_code=404, detail="No images found for this plant")

    # FIX: Prepend the BASE_URL to the image path before returning
    if img.image_url and not img.image_url.startswith("http"):
        path = img.image_url.lstrip("/")
        img.image_url = f"{BASE_URL}/{path}"

    return img


@app.patch("/plants/{plant_id}", response_model=PlantRead)
async def update_plant(
    plant_id: int,
    plant_update: PlantUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # 1. Fetch the plant
    result = await session.execute(
        select(Plant)
        .where(Plant.id == plant_id)
        .options(selectinload(cast(Any, Plant.sensor_readings)))
    )
    plant = result.scalars().first()

    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    # 2. Verify ownership
    if plant.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this plant")

    # 3. Apply partial updates
    update_data = plant_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(plant, key, value)

    session.add(plant)
    await session.commit()
    await session.refresh(plant)

    return plant


@app.get("/dashboard/plants", response_model=List[PlantSummary], tags=["dashboard"])
async def get_dashboard_plants(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Returns a lightweight summary of all plants owned by the user.
    Serves local images via static URLs instead of Base64.
    """
    # 1. Fetch user's plants
    plant_result = await session.execute(
        select(Plant).where(Plant.owner_id == current_user.id)
    )
    plants = plant_result.scalars().all()

    summaries = []
    for p in plants:
        # 2. Get latest image row
        img_result = await session.execute(
            select(Image)
            .where(Image.plant_id == p.id)
            .order_by(Image.timestamp.desc()) # type: ignore[attr-defined]
            .limit(1)
        )
        latest_img = img_result.scalars().first()

        # 3. Format Image URL (Cloud vs Static)
        final_image_url = None
        if latest_img and latest_img.image_url:
            if latest_img.image_url.startswith("http"):
                final_image_url = latest_img.image_url
            else:
                # Prepend BASE_URL to the local path (e.g., /received_images/...)
                path = latest_img.image_url.lstrip("/")
                final_image_url = f"{BASE_URL}/{path}"

        # 4. Get latest sensor reading
        sensor_result = await session.execute(
            select(SensorReading)
            .where(SensorReading.plant_id == p.id)
            .order_by(SensorReading.timestamp.desc()) # type: ignore[attr-defined]
            .limit(1)
        )
        latest_sensor = sensor_result.scalars().first()

        # 5. Determine critical status
        is_critical = False
        moisture = None
        if latest_sensor:
            moisture = latest_sensor.soil_root_pct
            if moisture < p.moisture_threshold_min or moisture > p.moisture_threshold_max:
                is_critical = True

        summaries.append(
            PlantSummary(
                id=cast(int, p.id),
                name=p.name,
                species=p.species,
                latest_image_url=final_image_url,
                latest_moisture_pct=moisture,
                latest_health_status=(
                    latest_img.detected_health if latest_img else "Pending Analysis"
                ),
                is_critical=is_critical,
            )
        )

    return summaries
=======
# ==============================
# APP INIT
# ==============================

app = FastAPI(title="PlantVita API")

# ==============================
# CORS CONFIGURATION
# ==============================

ALLOWED_ORIGINS = [
    "http://localhost:8010",
    "http://127.0.0.1:8010",
    "http://frontend:8010",  # docker internal
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# DATABASE CONFIGURATION
# ==============================

DATABASE_URL = os.getenv("DB_URL")

if not DATABASE_URL:
    raise RuntimeError("DB_URL environment variable is not set")

engine = create_async_engine(
    DATABASE_URL,
    echo=True
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ==============================
# REQUEST MODELS
# ==============================

class AddPlantRequest(BaseModel):
    user_id: int
    plant_id: int
    nickname: str | None = None


# ==============================
# HEALTH CHECK
# ==============================

@app.get("/")
async def health():
    return {"status": "PlantVita API running 🚀"}


# ==============================
# GET ALL PLANTS (FOR DROPDOWN)
# ==============================

@app.get("/api/plants")
async def get_plants():

    try:
        async with AsyncSessionLocal() as session:

            result = await session.execute(
                text('SELECT "Id", "Plants" FROM "Plants List" ORDER BY "Plants"')
            )

            rows = result.fetchall()

            plants = []

            for row in rows:
                plants.append({
                    "id": row[0],
                    "name": row[1]
                })

            return plants

    except Exception as e:
        print("Database error:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch plants"
        )


# ==============================
# ADD PLANT TO USER COLLECTION
# ==============================

@app.post("/api/user/add-plant")
async def add_plant(data: AddPlantRequest):

    try:
        async with AsyncSessionLocal() as session:

            await session.execute(
                text("""
                INSERT INTO user_plants (user_id, plant_id, nickname)
                VALUES (:user_id, :plant_id, :nickname)
                """),
                {
                    "user_id": data.user_id,
                    "plant_id": data.plant_id,
                    "nickname": data.nickname
                }
            )

            await session.commit()

            return {
                "message": "Plant added successfully"
            }

    except Exception as e:
        print("Database error:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to add plant"
        )


# ==============================
# GET USER PLANTS
# ==============================

@app.get("/api/user/{user_id}/plants")
async def get_user_plants(user_id: int):

    try:
        async with AsyncSessionLocal() as session:

            result = await session.execute(
                text("""
                SELECT p.id, p.name, up.nickname
                FROM user_plants up
                JOIN "Plants List" p ON p.id = up.plant_id
                WHERE up.user_id = :user_id
                """),
                {"user_id": user_id}
            )

            rows = result.fetchall()

            plants = []

            for row in rows:
                plants.append({
                    "id": row[0],
                    "name": row[1],
                    "nickname": row[2]
                })

            return plants

    except Exception as e:
        print("Database error:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch user plants"
        )
>>>>>>> 9877486 (Frontend With Prediction model)
