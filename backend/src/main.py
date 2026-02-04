from contextlib import asynccontextmanager
from fastapi import FastAPI
import uvicorn

import src.api.routers.v1 as v1


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    lifespan=lifespan,
)
app.include_router(v1.auth_router)

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )
