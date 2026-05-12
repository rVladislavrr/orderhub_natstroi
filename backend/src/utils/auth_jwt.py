import jwt

from datetime import timedelta, datetime, timezone
from fastapi import Depends, HTTPException, status, Request, UploadFile, File, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.config import settings
from src.shemas.users import Token, UserInfo

TOKEN_TYPE_FIELD = "type"
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

http_bearer = HTTPBearer(auto_error=False)


def encode_jwt(
        payload: dict,
        private_key=settings.auth_jwt.private_key_path.read_text(),
        algorithm=settings.auth_jwt.algorithm,
        expire_minutes=settings.auth_jwt.access_token_expire_minutes,
        expire_timedelta: timedelta | None = None
):
    to_encode = payload.copy()
    now = datetime.now(timezone.utc)
    if expire_timedelta:
        expire = now + expire_timedelta
    else:
        expire = now + timedelta(minutes=expire_minutes)
    to_encode.update({"exp": expire, 'iat': now})

    encoded = jwt.encode(to_encode, private_key, algorithm=algorithm)
    return encoded


def create_jwt(token_type: str, token_data: dict,
               expire_minutes=settings.auth_jwt.access_token_expire_minutes,
               expire_timedelta: timedelta | None = None):
    jwt_payload = {TOKEN_TYPE_FIELD: token_type}
    jwt_payload.update(token_data)
    return encode_jwt(payload=jwt_payload, expire_minutes=expire_minutes, expire_timedelta=expire_timedelta)


def create_access_token(user_inf) -> str:
    jwt_payload = user_inf
    return create_jwt(token_type=ACCESS_TOKEN_TYPE,
                      token_data=jwt_payload,
                      expire_minutes=settings.auth_jwt.access_token_expire_minutes,
                      )


def create_refresh_token(user) -> str:
    jwt_payload = {
        "sub": user['sub']
    }
    return create_jwt(token_type=REFRESH_TOKEN_TYPE,
                      token_data=jwt_payload,
                      expire_timedelta=timedelta(days=settings.auth_jwt.refresh_token_expire_days))


def create_tokens(user_inf, response: Response) -> Token:
    user_inf = user_inf.model_dump()
    access_token = create_access_token(user_inf)
    refresh_token = create_refresh_token(user_inf)
    response.set_cookie(key=settings.auth_jwt.key_cookie, value=refresh_token,
                        max_age=settings.auth_jwt.refresh_token_expire_days * 24 * 60 * 60,
                        httponly=True
                        )
    return Token(
        accessToken=access_token,
    )


def validate_token_type(
        payload: dict,
        token_type: str,
):
    if payload.get(TOKEN_TYPE_FIELD) != token_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail={"msg": f"token invalid {token_type}"
                                           f" != {payload.get(TOKEN_TYPE_FIELD)}", })


def decode_jwt(
        token: str | bytes,
        public_key=settings.auth_jwt.public_key_path.read_text(),
        algorithm=settings.auth_jwt.algorithm,
):
    decoded = jwt.decode(token, public_key, algorithms=[algorithm])
    return decoded


def decode_jwt_token(token, token_type):
    try:
        payload = decode_jwt(token=token)
        validate_token_type(payload, token_type)
        payload['uuid'] = payload['sub']
        return payload
    except:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"msg": f"invalid token"})


async def get_payload_or_none(
        credentials: HTTPAuthorizationCredentials | str = Depends(http_bearer)
) -> UserInfo | None:
    try:
        if hasattr(credentials, 'credentials'):
            token = credentials.credentials
        else:
            token = credentials

        return UserInfo.model_validate(decode_jwt_token(token, ACCESS_TOKEN_TYPE), from_attributes=True)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"msg": f"invalid token"})


async def get_payload_access(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> UserInfo:
    try:
        token = credentials.credentials
    except:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, )
    return UserInfo.model_validate(decode_jwt_token(token, ACCESS_TOKEN_TYPE), from_attributes=True)


async def get_payload_refresh(request: Request) -> (str, str):
    token = request.cookies.get(settings.auth_jwt.key_cookie)

    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"msg": f"Not found refresh token"})

    payload = decode_jwt_token(token, REFRESH_TOKEN_TYPE)
    return payload


async def get_active_payload(userInf=Depends(get_payload_access)) -> UserInfo:
    if userInf.active:
        return userInf
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"msg": 'User not active'})


async def get_verify_payload(userInf=Depends(get_active_payload)) -> UserInfo:
    if userInf.is_verified:
        return userInf
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"msg": 'User not verified'})


async def get_users_payload(token: str) -> UserInfo:
    return UserInfo.model_validate(decode_jwt_token(token, ACCESS_TOKEN_TYPE), from_attributes=True)
