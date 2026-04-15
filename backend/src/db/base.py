from fastapi import HTTPException, status
from typing import Generic, TypeVar

from pydantic import BaseModel
import logging

from src.db.connection import async_session_maker
from src.models import Base
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import OperationalError, InterfaceError, SQLAlchemyError, IntegrityError

TCreate = TypeVar("TCreate", bound=BaseModel)
TRead = TypeVar("TRead", bound=BaseModel)
TUpdate = TypeVar("TUpdate", bound=BaseModel)
TModel = TypeVar("TModel", bound=Base)

database_logger = logging.getLogger("DatabaseLogger")

class DataBaseError(Exception):
    pass

class ErrorInDataBase(Exception):
    pass

class BaseManager(Generic[TCreate, TRead, TUpdate, TModel]):

    create_schema: type[TCreate]
    read_schema: type[TRead]
    update_schema: type[TUpdate]
    model: type[TModel]

    async def __create_entity(self, data: dict, session: AsyncSession) -> TModel:
        database_logger.debug(f"Creating a new {self.model.__name__}: {data}")
        instance = self.model(**data)
        session.add(instance)
        await session.flush()
        await session.refresh(instance)
        database_logger.debug(
            f"Successfully created {self.model.__name__}: {instance}"
        )
        return instance

    async def create(self, create_data: TCreate, session: AsyncSession | None = None,
                     request_id: str | None = None) -> TRead:
        database_logger.debug(f"{request_id} | Creating {self.__name__} entity.")

        data = create_data.model_dump(exclude_unset=True)
        try:
            if session is None:
                async with async_session_maker() as session:
                    entity = await self.__create_entity(data, session)

            else:
                entity = await self.__create_entity(data, session)

            await session.commit()

        except (OperationalError, InterfaceError) as e:
            database_logger.critical(
                f"{request_id} | База данных недоступна {self.model.__name__}: {e}",
                exc_info=True,
            )
            raise DataBaseError(e)

        except IntegrityError:
            database_logger.debug(
                f"{request_id} | Объект{self.model.__name__} не создан тк поле попадает в unique",
            )
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Already exist')

        except SQLAlchemyError as e:
            database_logger.error(
                f"{request_id} | Ошибка БД при создании {self.model.__name__}: {data}, Ошибка: {e}",
                exc_info=True,
            )
            raise ErrorInDataBase(e)

        except Exception as e:
            database_logger.error(
                f"Ошибка при создании {self.model.__name__}: {e}",
                exc_info=True,
            )
            raise ErrorInDataBase(e)

        database_logger.debug(f"{request_id} | Successfully created {self.__name__}.")
        return self.read_schema.model_validate(entity, from_attributes=True)

    async def get(self,
                  pk: str | int,
                  session: AsyncSession | None = None,
                  request_id: str | None = None) -> TRead | None:
        database_logger.debug(f"{request_id} | Get {self.__name__} entity.")
        try:
            if session is None:
                async with async_session_maker() as session:
                    entity = await session.get(self.model, pk)

            else:
                entity = await session.get(self.model, pk)

        except (OperationalError, InterfaceError) as e:
            database_logger.critical(
                f"{request_id} | База данных недоступна {self.model.__name__}: {e}",
                exc_info=True,
            )
            raise DataBaseError(e)

        except SQLAlchemyError as e:
            database_logger.error(
                f"{request_id} | Ошибка БД при создании {self.model.__name__}: {pk}, Ошибка: {e}",
                exc_info=True,
            )
            raise ErrorInDataBase(e)

        except Exception as e:
            database_logger.error(
                f"Ошибка при создании {self.model.__name__}: {e}",
                exc_info=True,
            )
            raise ErrorInDataBase(e)

        database_logger.debug(f"{request_id} | Successfully get {self.__name__}.")
        if entity:
            return self.read_schema.model_validate(entity, from_attributes=True)
        else:
            return None

    @property
    def __name__(self):
        return self.__class__.__name__

