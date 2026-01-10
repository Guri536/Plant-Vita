from typing import Optional, List
from datetime import datetime, timezone
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
    owner: User = Relationship(back_populates="plant")
    sensor_readings: List["SensorReading"] = Relationship(back_populates="plant")
    images: List["Image"] = Relationship(back_populates="plant")
    
class SensorReading(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    plant_id: int = Field(foreign_key="plant.id")
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    
    soil_moisture: float
    temprature: float
    humidity: float
    pressure: float
    light_lux: float
    air_quality: float
    
    plant: Plant = Relationship(back_populates="sensor_readings")
    
class Image(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    plant_id: int = Field(foreign_key="plant.id")
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    image_url: str
    ai_diagnosis: Optional[str] = None
    green_density: Optional[float] = None
    
    plant: Plant = Relationship(back_populates="images")
    
    
