import uuid
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class LoggingMiddleware(BaseHTTPMiddleware):
    max_size = 30 * 1024 * 1024
    c = 0

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        if "/upload" in request.url.path:
            content_length = request.headers.get('content-length')
            if content_length and int(content_length) > self.max_size:
                # Отклоняем запрос ДО загрузки файла
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"File too large. Max size: {self.max_size // (1024 * 1024)} MB"}
                )

        # if "/admin/" in request.url.path:
        #     return JSONResponse(status_code=403, content='Forbidden')

        # if ("/public/" in request.url.path
        #         or request.url.path.endswith("/docs")
        #         or request.url.path.endswith("/openapi.json")):
        #     return await call_next(request)
        start_time = time.time()
        res = await call_next(request)
        print(time.time() - start_time)
        self.c += 1
        print(self.c)
        return res
