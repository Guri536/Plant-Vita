from pydantic import BaseModel  
from typing import Optional, List
from datetime import datetime 

class SensorReadingCreate(BaseModel):
    soil_moisture: float
    temprature: float
    humidity: float
    pressure: float
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
    owner_id: int

class PlantRead(PlantCreate):
    id: int
    sensor_readings: List[SensorReadingRead] = []