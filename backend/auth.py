from datetime import datetime, timedelta, UTC
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os

SECRET_KEY = os.getenv("AUTH_KEY") or ""
ALGORITHM = os.getenv("AUTH_ALG") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("AUTH_TOKEN_EXPIRE")

if not SECRET_KEY:
    raise RuntimeError("Authenticaion environment variables are not set")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_hashed_password(plain_password):
    return pwd_context.hash(plain_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
