from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlmodel import SQLModel, select
import os
from models import User, Plant, SensorReading
from schemas import PlantCreate, PlantRead, SensorReadingCreate, SensorReadingRead
from typing import AsyncGenerator

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_async_engine(DATABASE_URL, echo = True)
app = FastAPI(title="Plant-Vita Backend")

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async_session = sessionmaker(engine, class_= AsyncSession, expire_on_commit = False)
    async with async_session() as session:
        yield session

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

@app.get("/")
def read_root():
    return {
        "message": "Plant-Vita backend is running", 
        "database": "Connected"
    }

@app.post("/plants/", response_model=PlantRead)
async def create_plant(plant: PlantCreate, session: AsyncSession = Depends(get_session)):
    user = await session.get(User, plant.owner_id)
    
    if not user:
        dummy_user = User(
            id = plant.owner_id,
            email = "test@plantvita.com",
            hash_pass = "hashed"
        )
        session.add(dummy_user)
        await session.commit()
        await session.refresh(dummy_user)
        
        
    db_plant = Plant.from_orm(plant)
    db_plant.sensor_readings = []
    session.add(db_plant)
    await session.commit()
    await session.refresh(db_plant)
    db_plant.sensor_readings = []
    return db_plant

@app.get("/plants/{plant_id}", response_model=PlantRead)
async def readplants(plant_id: int, session: AsyncSession = Depends(get_session)):
    statement = (
        select(Plant)
        .where(Plant.id == plant_id)
        .options(selectinload(Plant.sensor_readings))
    )
    result = await session.execute(statement)
    plant = result.scalars().first()
    
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant

@app.post("/plants/{mac_address}/readings/", response_model=SensorReadingRead)
async def create_sensor_reading(
    mac_address: str,
    reading: SensorReadingCreate, 
    session: AsyncSession = Depends(get_session)
):
    statement = select(Plant).where(Plant.mac_address == mac_address)
    results = await session.exec(statement)
    plant = results.first()
    
    if not plant: 
        raise HTTPException(status_code = 404, detail = "Device/Plant not registered")
    
    db_reading = SensorReading.from_orm(reading)
    db_reading.plant_id = plant.id
    
    session.add(db_reading)
    await session.commit()
    await session.refresh(db_reading)
    return db_reading
    