<<<<<<< HEAD
"""
models.py  (updated)
────────────────────
SQLModel table definitions.

Changes vs original:
  • Image table gains vision result columns populated by the background task
    that calls the host-side Vision Microservice after each ESP32-CAM upload.
  • All new columns are Optional so existing rows (before the migration) don't
    break reads.
"""

from typing import Optional, List, Any
from datetime import datetime, timezone, date, UTC
=======
from typing import Optional, List
from datetime import datetime
>>>>>>> 9877486 (Frontend With Prediction model)
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, DateTime


class User(SQLModel, table=True):
<<<<<<< HEAD
  __tablename__: Any = "users"
  
  id: Optional[int] = Field(default=None, primary_key=True)
  email: str = Field(index=True, unique=True)
  hash_pass: str

  plants: List["Plant"] = Relationship(back_populates="owner")
=======
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)

    # password is optional for Google login
    hash_pass: Optional[str] = Field(default=None)

    # new column
    login_type: str = Field(default="manual")

    plants: List["Plant"] = Relationship(back_populates="owner")
>>>>>>> 9877486 (Frontend With Prediction model)


class Plant(SQLModel, table=True):
    __tablename__ = "plant"

    id: Optional[int] = Field(default=None, primary_key=True)
<<<<<<< HEAD
    owner_id: int = Field(foreign_key="users.id")
    mac_address: str = Field(unique=True, index=True)
    name: str
    moisture_threshold_min: int
    moisture_threshold_max: int
    
    soil_type: Optional[str] = Field(default=None)
    capture_rate: Optional[int] = Field(default=30)  # minutes
    capture_schedule: Optional[str] = Field(default="morning")
    notifications_enabled: bool = Field(default=True)
    alerts_enabled: bool = Field(default=True)
    indoor: Optional[bool] = Field(default=True)
    light_condition: Optional[str] = Field(default=None)
    date_acquired: Optional[date] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    watering_mode: Optional[str] = Field(default="manual")
    pump_duration: Optional[int] = Field(default=5)  # seconds
    species: Optional[str] = Field(default=None)

    owner: "User" = Relationship(back_populates="plants")
    sensor_readings: List["SensorReading"] = Relationship(
        back_populates="plant",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
=======

    # fixed FK reference
    owner_id: int = Field(foreign_key="users.id")

    mac_address: str = Field(unique=True, index=True)
    name: str
    species: str

    moisture_threshold_min: int
    moisture_threshold_max: int

    owner: User = Relationship(back_populates="plants")

    sensor_readings: List["SensorReading"] = Relationship(
        back_populates="plant",
        sa_relationship_kwargs={"lazy": "selectin"}
    )

>>>>>>> 9877486 (Frontend With Prediction model)
    images: List["Image"] = Relationship(
        back_populates="plant",
        sa_relationship_kwargs={"lazy": "selectin"},
    )


class SensorReading(SQLModel, table=True):
    __tablename__ = "sensorreading"

    id: Optional[int] = Field(default=None, primary_key=True)

    plant_id: int = Field(foreign_key="plant.id")
<<<<<<< HEAD
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), index=True, nullable=False)
    )

    temp_c: float
    humidity_pct: float
    light_lux: float
    air_ppm: float
    air_quality_pct: Optional[float] = None
    soil_surface_pct: float
    soil_root_pct: float
    soil_temp_c: float

    plant: "Plant" = Relationship(back_populates="sensor_readings")


class Image(SQLModel, table=True):
    """
    One row per image uploaded by the ESP32-CAM.

    Columns set at INSERT time (device upload):
      image_url, plant_id, timestamp

    Columns filled in by the BackgroundTask after the Vision Microservice
    returns (may be NULL if the service is temporarily unreachable):
      ai_diagnosis          — Gemini natural-language diagnosis (set by Gemini call, not vision service)
      green_density         — fraction of masked pixels that are green
      segmentation_success  — whether SAM3 successfully isolated the plant
      detected_species      — top ResNet18 species prediction
      species_confidence    — confidence for detected_species (0-1)
      in_model_scope        — True when species_confidence >= 0.70
      detected_health       — top ResNet18 health prediction
      health_confidence     — confidence for detected_health (0-1)
      trigger_llm           — True when Gemini should be called for a full diagnosis
      vision_error          — populated if the Vision Microservice was unreachable
    """
=======

    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)

    soil_moisture: float
    temperature: float
    humidity: float
    light_lux: float
    air_quality: Optional[float] = None

    plant: Plant = Relationship(back_populates="sensor_readings")


class Image(SQLModel, table=True):
    __tablename__ = "image"
>>>>>>> 9877486 (Frontend With Prediction model)

    id: Optional[int] = Field(default=None, primary_key=True)

    plant_id: int = Field(foreign_key="plant.id")

<<<<<<< HEAD
    # ── Set at upload time ────────────────────────────────────────────────
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), index=True, nullable=False)
    )
=======
    timestamp: datetime = Field(default_factory=datetime.utcnow)

>>>>>>> 9877486 (Frontend With Prediction model)
    image_url: str

    # ── Set by Gemini background task (unchanged from original) ───────────
    ai_diagnosis: Optional[str] = None
<<<<<<< HEAD

    # ── Set by Vision Microservice background task ────────────────────────
    green_density:        Optional[float] = None
    segmentation_success: Optional[bool]  = None

    detected_species:   Optional[str]   = None
    species_confidence: Optional[float] = None
    in_model_scope:     Optional[bool]  = None

    detected_health:   Optional[str]   = None
    health_confidence: Optional[float] = None

    trigger_llm:   Optional[bool] = None
    vision_error:  Optional[str]  = None     # null when vision call succeeded

    plant: "Plant" = Relationship(back_populates="images")
=======
    green_density: Optional[float] = None

    plant: Plant = Relationship(back_populates="images")
>>>>>>> 9877486 (Frontend With Prediction model)
