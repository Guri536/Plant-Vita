from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, selectinload
from sqlmodel import SQLModel, select, Session
from typing import AsyncGenerator, cast, List
from contextlib import asynccontextmanager
import os
from datetime import timedelta
from models import User, Plant, SensorReading
from schemas import (
    PlantCreate,
    PlantRead,
    SensorReadingCreate,
    SensorReadingRead,
    UserCreate,
    UserRead,
    Token,
    TokenData,
    TokenRefreshRequest,
    SocialLogin,
)
from auth import (
    get_hashed_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from jose import JWTError, jwt

DATABASE_URL = os.getenv("DB_URL")
API_SECRET_KEY = os.getenv("API_SECRET_KEY")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")
if not API_SECRET_KEY:
    raise RuntimeError("API Secret Key not set")

engine = create_async_engine(DATABASE_URL, echo=True)


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


app = FastAPI(title="Plant-Vita Backend", lifespan=lifespan)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8010",
        "http://127.0.0.1:8010",
    ],  # Your Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Plant-Vita backend is running", "database": "Connected"}


async def get_current_user(
    token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)
):
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

    statement = select(User).where(User.email == token_data.email)
    result = await session.execute(statement)
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user


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
async def readplants(plant_id: int, session: AsyncSession = Depends(get_session)):
    statement = (
        select(Plant)
        .where(Plant.id == plant_id)
        .options(selectinload(Plant.sensor_readings))  # type: ignore
    )
    result = await session.execute(statement)
    plant = result.scalars().first()

    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    return plant


@app.get("/plants/my_plants", response_model=List[PlantRead])
def read_my_plants(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return current_user.plants


@app.post("/plants/{mac_address}/readings/", response_model=SensorReadingRead)
async def create_sensor_reading(
    mac_address: str,
    reading: SensorReadingCreate,
    session: AsyncSession = Depends(get_session),
):
    statement = select(Plant).where(Plant.mac_address == mac_address)
    result = await session.execute(statement)
    plant = result.scalars().first()

    if not plant:
        raise HTTPException(status_code=404, detail="Device/Plant not registered")

    db_reading = SensorReading(**reading.model_dump(), plant_id=cast(int, plant.id))

    session.add(db_reading)
    await session.commit()
    await session.refresh(db_reading)
    return db_reading


@app.post("/register", response_model=UserRead)
async def register_user(user: UserCreate, session: AsyncSession = Depends(get_session)):
    statement = select(User).where(User.email == user.email)
    result = await session.execute(statement)
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = get_hashed_password(user.password)
    db_user = User(email=user.email, hash_pass=hashed_pwd)
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    return db_user


@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    statement = select(User).where(User.email == form_data.username)
    result = await session.execute(statement)
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hash_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})  # Generate Refresh

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
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

    statement = select(User).where(User.email == login_data.email)
    result = await session.execute(statement)
    user = result.scalars().first()

    if not user:
        db_user = User(email=login_data.email, hash_pass="SOCIAL_LOGIN_NO_PASS")
        session.add(db_user)
        await session.commit()
        await session.refresh(db_user)

    access_token_expires = timedelta(minutes=15)
    access_token = create_access_token(
        data={"sub": login_data.email}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": login_data.email})
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token, 
        "token_type": "bearer"
    }

@app.post("/refresh", response_model=Token)
async def refresh_token(
    request: TokenRefreshRequest,
    session: AsyncSession = Depends(get_session)
):
    payload = decode_token(request.refresh_token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    statement = select(User).where(User.email == email)
    result = await session.execute(statement)
    user = result.scalars().first()
    if not user:
         raise HTTPException(status_code=401, detail="User no longer exists")

    new_access_token = create_access_token(data={"sub": email})
    new_refresh_token = create_refresh_token(data={"sub": email})

    return {
        "access_token": new_access_token, 
        "refresh_token": new_refresh_token, 
        "token_type": "bearer"
    }
