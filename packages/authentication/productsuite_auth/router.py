import re
from collections.abc import Callable

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from productsuite_auth.models import Organization, User
from productsuite_auth.security import (
    SlidingWindowRateLimiter,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

bearer_scheme = HTTPBearer(auto_error=False)
_auth_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=60)


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)
    organization_name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    organization_id: int
    organization_name: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105
    user: UserResponse


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "org"


def _validate_email(email: str) -> str:
    cleaned = email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid email address format.",
        )
    return cleaned


def create_auth_dependencies(get_db: Callable):
    """Build get_current_user and auth router bound to an app's get_db dependency."""

    def get_current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
        db: Session = Depends(get_db),
    ) -> User:
        if credentials is None or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials were not provided.",
            )
        try:
            payload = decode_access_token(credentials.credentials)
            user_id = int(payload["sub"])
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token.",
            ) from exc

        user = db.get(User, user_id)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or inactive.",
            )
        return user

    router = APIRouter(prefix="/api/auth", tags=["auth"])

    @router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
    def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
        client_ip = request.client.host if request.client else "unknown"
        if not _auth_limiter.allow(f"reg:{client_ip}"):
            raise HTTPException(status_code=429, detail="Too many registration attempts.")

        email = _validate_email(body.email)
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

        base_slug = _slugify(body.organization_name)
        slug = base_slug
        suffix = 1
        while db.scalar(select(Organization).where(Organization.slug == slug)) is not None:
            suffix += 1
            slug = f"{base_slug}-{suffix}"

        org = Organization(name=body.organization_name.strip(), slug=slug)
        db.add(org)
        db.flush()

        user = User(
            organization_id=org.id,
            email=email,
            full_name=body.full_name.strip(),
            password_hash=hash_password(body.password),
            role="owner",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = create_access_token(
            user_id=user.id,
            organization_id=org.id,
            email=user.email,
            role=user.role,
        )
        return AuthResponse(
            access_token=token,
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                organization_id=org.id,
                organization_name=org.name,
            ),
        )

    @router.post("/login", response_model=AuthResponse)
    def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
        client_ip = request.client.host if request.client else "unknown"
        if not _auth_limiter.allow(f"login:{client_ip}"):
            raise HTTPException(status_code=429, detail="Too many login attempts.")

        email = _validate_email(body.email)
        user = db.scalar(select(User).where(User.email == email))
        if user is None or not verify_password(body.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive.",
            )

        org = db.get(Organization, user.organization_id)
        token = create_access_token(
            user_id=user.id,
            organization_id=user.organization_id,
            email=user.email,
            role=user.role,
        )
        return AuthResponse(
            access_token=token,
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                organization_id=user.organization_id,
                organization_name=org.name if org else "",
            ),
        )

    @router.get("/me", response_model=UserResponse)
    def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        org = db.get(Organization, current_user.organization_id)
        return UserResponse(
            id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            role=current_user.role,
            organization_id=current_user.organization_id,
            organization_name=org.name if org else "",
        )

    return router, get_current_user
