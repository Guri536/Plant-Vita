from fastapi import FastAPI
from sqlmodel import SQLModel, create_engine
import os
from models import User, Plant, Image, SensorReading

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

app = FastAPI(title="Plant-Vita Backend")

@app.on_event("startup")
def on_startup():
    create_db_and_tables

@app.get("/")
def read_root():
    return {
        "message": "Plant-Vita backend is running", 
        "database": "Connected"
    }

@app.get("/plants/")
def readplants():
    return []