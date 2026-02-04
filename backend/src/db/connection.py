from typing import AsyncGenerator

from sqlalchemy.pool import AsyncAdaptedQueuePool
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from src.config import settings

engine = create_async_engine(settings.DATABASE_URL, poolclass=AsyncAdaptedQueuePool,
                             pool_size=20,
                             max_overflow=5,
                             pool_timeout=300,
                             pool_recycle=1800
                             )

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
