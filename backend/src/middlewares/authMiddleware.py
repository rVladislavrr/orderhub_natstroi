import logging

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, HTTPException
from starlette.responses import JSONResponse

from src.shemas.users import CategoryEnum, LevelEnum
from src.utils.auth_jwt import get_users_payload

api_logger = logging.getLogger('api')


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == 'OPTIONS' or request.method == 'HEAD':
            return await call_next(request)

        if (any(request.url.path.endswith(end) for end in ("/docs", "/openapi.json",))
                or ("/auth/" in request.url.path and 'user' not in request.url.path )):
            return await call_next(request)

        response_401 = JSONResponse(
            status_code=401,
            content={
                "detail": {"msg": "Invalid token",
                           "request_id": request.state.request_id},
            }
        )

        auth_header = request.headers.get("Authorization")

        if request.url.path.endswith('/predict', ) or request.url.path.endswith('/upload'):
            if auth_header is None:
                return await call_next(request)

        try:
            if auth_header is None:
                return response_401
            if " " in auth_header:
                token = auth_header.split(" ")[1]
            else:
                return response_401
        except Exception as e:
            api_logger.error(
                "Failed to auth",
                extra={"request_id": request.state.request_id},
                exc_info=e,
            )
            return response_401
        try:
            user = await get_users_payload(token)
            request.state.user_id = user.uuid
            request.state.permissions = user.permissions
        except HTTPException:
            api_logger.warning(
                "Failed to auth, token invalid or expired",
                extra={"request_id": request.state.request_id},
            )
            return response_401
        except Exception as e:
            api_logger.error(
                str(e),
                extra={"request_id": request.state.request_id},
                exc_info=e,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "detail": {"msg": "Invalid token",
                               "request_id": request.state.request_id}
                }
            )
        return await call_next(request)
