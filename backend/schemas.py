"""
schemas.py  (updated)
─────────────────────
Pydantic / SQLModel response schemas.

Changes vs original:
  • ImageRead — full read schema including all vision result fields
  • ImageUploadResponse — what the POST /plants/{mac}/image/ endpoint returns
    immediately (before the background task finishes)
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from typing import Optional, List


# ── Sensor readings ────────────────────────────────────────────────────────────

class SensorReadingCreate(BaseModel):
    temp_c: float
    humidity_pct: float
    light_lux: float
    air_ppm: float
    air_quality_pct: Optional[float] = None
    soil_surface_pct: float
    soil_root_pct: float
    soil_temp_c: float


class SensorReadingRead(SensorReadingCreate):
    id: int
    plant_id: int
    timestamp: datetime

# ── Plant ──────────────────────────────────────────────────────────────────────

class PlantCreate(BaseModel):
    name: str
    species: Optional[str] = None
    mac_address: str
    moisture_threshold_min: int = 20
    moisture_threshold_max: int = 80
    soil_type: Optional[str] = None
    capture_rate: Optional[int] = 30
    capture_schedule: Optional[str] = "morning"
    notifications_enabled: bool = True
    alerts_enabled: bool = True
    indoor: Optional[bool] = True
    light_condition: Optional[str] = None
    date_acquired: Optional[date] = None
    notes: Optional[str] = None
    watering_mode: Optional[str] = "manual"
    pump_duration: Optional[int] = 5


class PlantRead(PlantCreate):
    id: int
    owner_id: int
    sensor_readings: List[SensorReadingRead] = []
    
class PlantUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    moisture_threshold_min: Optional[int] = None
    moisture_threshold_max: Optional[int] = None
    indoor: Optional[bool] = None
    watering_mode: Optional[str] = None
    pump_duration: Optional[int] = None
    capture_rate: Optional[int] = None
    notifications_enabled: Optional[bool] = None
    alerts_enabled: Optional[bool] = None
    light_condition: Optional[str] = None
    notes: Optional[str] = None
    
class PlantSummary(BaseModel):
    id: int
    name: str
    species: Optional[str] = None
    latest_image_url: Optional[str] = None
    latest_moisture_pct: Optional[float] = None
    latest_health_status: Optional[str] = None
    is_critical: bool = False

class DeviceRegister(BaseModel):
    mac_address: str
    email: str

class DeviceRegisterResponse(BaseModel):
    registered: bool
    is_new: bool
    plant_id: int


# ── Auth ───────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str


# ── User ───────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int


class SocialLogin(BaseModel):
    email: str


# ── Image ──────────────────────────────────────────────────────────────────────

class ImageRead(BaseModel):
    """
    Full image record — all vision microservice fields included.
    Returned by GET /plants/{id}/images/ and GET /plants/{id}/diagnosis/.
    """
    id: int
    plant_id: int
    timestamp: datetime
    image_url: str

    # Gemini diagnosis
    ai_diagnosis: Optional[str] = None

    # Vision microservice results
    green_density:        Optional[float] = None
    segmentation_success: Optional[bool]  = None

    detected_species:   Optional[str]   = None
    species_confidence: Optional[float] = None
    in_model_scope:     Optional[bool]  = None

    detected_health:   Optional[str]   = None
    health_confidence: Optional[float] = None

    trigger_llm:  Optional[bool] = None
    vision_error: Optional[str]  = None

    class Config:
        from_attributes = True


class ImageUploadResponse(BaseModel):
    """
    Returned immediately when the ESP32-CAM posts a new image.
    The vision + Gemini analysis runs in a BackgroundTask and updates the DB
    row after this response is already sent.
    """
    id: int
    image_url: str
    message: str = "Image received. Vision analysis running in background."
    
class CommandCreate(BaseModel):
    command_type: str = "pump"
    duration: Optional[int] = None  # if None, uses plant's pump_duration

class CommandRead(BaseModel):
    id: int
    plant_id: int
    command_type: str
    status: str
    duration: int
    created_at: datetime
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CommandAcknowledge(BaseModel):
    command_id: int
    status: str = "executed"  # executed / failed