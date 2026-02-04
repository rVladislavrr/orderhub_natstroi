from typing import Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.connection import async_session_maker
from src.logger import setup_logging
from src.models import Base

TCreate = TypeVar("TCreate", bound=BaseModel)
TRead = TypeVar("TRead", bound=BaseModel)
TUpdate = TypeVar("TUpdate", bound=BaseModel)
TModel = TypeVar("TModel", bound=Base)

database_logger = setup_logging("DatabaseLogger")

class BaseManager(Generic[TCreate, TRead, TUpdate, TModel]):

    create_schema: type[TCreate]
    read_schema: type[TRead]
    update_schema: type[TUpdate]
    model: type[TModel]

    async def __create_entity(self, data: dict, session: AsyncSession) -> TModel:
        """
        """
        database_logger.debug(f"Creating a new {self.model.__name__}: {data}")

        try:
            instance = self.model(**data)
            session.add(instance)
            await session.flush()
            await session.refresh(instance)
        except Exception as e:
            database_logger.error(
                f"Error creating {self.model.__name__}: {data}, Error: {e}",
                exc_info=True,
            )
            raise e

        database_logger.debug(
            f"Successfully created {self.model.__name__}: {instance}"
        )
        return instance

    async def create(self, create_data: TCreate, session: AsyncSession | None = None) -> TRead:
        """
        Create a new entity and return the created entity's details.

        :param create_data: Schema containing data for creating a new entity.
        :param session:
        :return: The created entity represented by the read schema.
        :raises: ...
        """
        database_logger.debug(f"Creating {self.__name__} entity.")

        data = create_data.model_dump(exclude_unset=True)
        try:
            if session is None:
                async with async_session_maker() as session:
                    entity = await self.__create_entity(data, session)

            else:
                entity = await self.__create_entity(data, session)

            await session.commit()
        except Exception as e:
            database_logger.error(
                f"Error creating {self.__name__}: {str(e)}"
            )
            raise e

        database_logger.debug(f"Successfully created {self.__name__}.")
        return self.read_schema.model_validate(entity, from_attributes=True)

    @property
    def __name__(self):
        return self.__class__.__name__

