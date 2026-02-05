from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class SensorReadingCreate(BaseModel):
    soil_moisture: float
    temperature: float
    humidity: float
    light_lux: float
    air_quality: Optional[float] = None


class SensorReadingRead(SensorReadingCreate):
    id: int
    plant_id: int
    timestamp: datetime


class PlantCreate(BaseModel):
    name: str
    species: str
    mac_address: str
    moisture_threshold_min: int = 20
    moisture_threshold_max: int = 80


class PlantRead(PlantCreate):
    id: int
    sensor_readings: List[SensorReadingRead] = []


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
