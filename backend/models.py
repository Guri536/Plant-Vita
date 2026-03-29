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

from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hash_pass: str

    plants: List["Plant"] = Relationship(back_populates="owner")


class Plant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id")
    mac_address: str = Field(unique=True, index=True)
    name: str
    species: str
    moisture_threshold_min: int
    moisture_threshold_max: int

    owner: "User" = Relationship(back_populates="plants")
    sensor_readings: List["SensorReading"] = Relationship(
        back_populates="plant",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    images: List["Image"] = Relationship(
        back_populates="plant",
        sa_relationship_kwargs={"lazy": "selectin"},
    )


class SensorReading(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    plant_id: int = Field(foreign_key="plant.id")
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)

    soil_moisture: float
    temperature: float
    humidity: float
    light_lux: float
    air_quality: Optional[float] = None

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

    id: Optional[int] = Field(default=None, primary_key=True)
    plant_id: int = Field(foreign_key="plant.id")

    # ── Set at upload time ────────────────────────────────────────────────
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    image_url: str

    # ── Set by Gemini background task (unchanged from original) ───────────
    ai_diagnosis: Optional[str] = None

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