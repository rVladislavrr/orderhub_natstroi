import logging
import uuid
from http.client import HTTPException

from starlette import status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

log = logging.getLogger('ErrorMiddleware')

class ErrorMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        request_id = request.state.request_id

        try:
            return await call_next(request)
        except HTTPException as e:
            raise e
        except Exception as e:

            log.error(f'{request_id}| неизвестная ошибка', exc_info=e)

            return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                content=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # if "/admin/" in request.url.path:
        #     return JSONResponse(status_code=403, content='Forbidden')

        # if ("/public/" in request.url.path
        #         or request.url.path.endswith("/docs")
        #         or request.url.path.endswith("/openapi.json")):
        #     return await call_next(request)
