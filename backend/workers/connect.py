import sys

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)
from sqlalchemy.pool import NullPool
from src.config import settings
import logging

from src.logger import setup_logging

if sys.argv[0] == 'worker':
    setup_logging()

    log = logging.getLogger(__name__)

    log.info(f"Connecting to database: {settings.DATABASE_URL}")

    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=False,
        pool_pre_ping=True
    )

    async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
