from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_current_user
from app.core.security import (
    create_access_token,
    generate_device_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models import Device, User
from app.models.auth import ROLES
from app.schemas.auth import (
    DeviceRegisterResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    if body.role not in ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"role must be one of {ROLES}")
    existing = await session.scalar(select(User).where(User.username == body.username))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "username already registered")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
        operator_id=body.operator_id,
        language=body.language,
    )
    session.add(user)
    await session.commit()

    token = create_access_token(subject=user.id, role=user.role, operator_id=user.operator_id)
    return TokenResponse(access_token=token, role=user.role, operator_id=user.operator_id)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await session.scalar(select(User).where(User.username == body.username))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")

    token = create_access_token(subject=user.id, role=user.role, operator_id=user.operator_id)
    return TokenResponse(access_token=token, role=user.role, operator_id=user.operator_id)


@router.post(
    "/device/register", response_model=DeviceRegisterResponse, status_code=status.HTTP_201_CREATED
)
async def register_device(
    user: CurrentUser = Depends(get_current_user), session: AsyncSession = Depends(get_db)
) -> DeviceRegisterResponse:
    """CLAUDE.md section 3.2: device registered on first login; all sync calls after
    this are signed with the returned device_token."""
    device = Device(user_id=user.user_id, device_token=generate_device_token())
    session.add(device)
    await session.commit()
    return DeviceRegisterResponse(device_id=device.id, device_token=device.device_token)
