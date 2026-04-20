import uuid
import time

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

log = logging.getLogger('Логгермидделвеир')

class LoggingMiddleware(BaseHTTPMiddleware):
    max_size = 30 * 1024 * 1024
    c = 0

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        if "/upload" in request.url.path:
            content_length = request.headers.get('content-length')
            if content_length and int(content_length) > self.max_size:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"File too large. Max size: {self.max_size // (1024 * 1024)} MB"}
                )

        start_time = time.time()
        log.info('Начало выполнения запроса')
        res = await call_next(request)
        log.info(f'Конец выполнения запроса, за время { time.time() - start_time}')
        self.c += 1
        log.info(f'Количество выполненных запросов со старта: {self.c}')
        return res
