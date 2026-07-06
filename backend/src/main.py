from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
import uvicorn
from sqladmin import Admin
from starlette.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

import src.api.routers.v1 as v1
from src.admin import register_admin_views
from src.broker import broker
from src.config import settings
from src.db.connection import async_session_maker, get_async_session
from src.db.usersManager import usersManager
from src.graphql.schema import schema
from src.logger import setup_logging
from src.middlewares.authMiddleware import AuthMiddleware
from src.middlewares.errorMiddleware import ErrorMiddleware
from src.middlewares.logMiddleware import LoggingMiddleware
from src.service.redis_conn import redis_client
from src.service.s3Manager import s3_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    await broker.startup()
    setup_logging()
    await redis_client.connect()
    admin = Admin(app,
                  session_maker=async_session_maker)

    await s3_client.connect(
        access_key=settings.S3_ACCESS_KEY,
        secret_key=settings.S3_SECRET_KEY,
        endpoint_url=settings.S3_ENDPOINT,
        region_name=settings.S3_REGION,
    )
    register_admin_views(admin)
    await usersManager.create_admin()
    yield
    await broker.shutdown()
    await redis_client.close()


app = FastAPI(
    lifespan=lifespan,
)
app.include_router(v1.router)

app.add_middleware(ErrorMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(LoggingMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_graphql_context(db=Depends(get_async_session)):
    return {"db": db}

# Подключаем GraphQL роутер
graphql_app = GraphQLRouter(
    schema,
    context_getter=get_graphql_context,
)


app.include_router(graphql_app, prefix="/graphql", tags=['graphql'])

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )
