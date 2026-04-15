import logging

from sqlalchemy import select, func
from sqlalchemy.exc import OperationalError, InterfaceError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, contains_eager
from src.db.base import BaseManager, ErrorInDataBase, DataBaseError
from src.db.connection import async_session_maker
from src.models import Orders, Marks, KMD
from src.shemas.marks import MarksRead, MarksDetailsRead
from src.shemas.orders import OrdersCreate, OrdersRead, OrdersUpdate, OrdersReadFile, OrdersReadFileMarks

log = logging.getLogger('Ордер менеджер')


class OrdersManager(BaseManager[OrdersCreate, OrdersRead, OrdersUpdate, Orders]):
    model = Orders
    create_schema = OrdersCreate
    read_schema = OrdersRead
    update_schema = OrdersUpdate

    async def create(self, create_data: create_schema, session: AsyncSession | None = None,
                     request_id: str | None = None) -> read_schema:
        return await super().create(create_data, session, request_id)

    async def get_with_total(self,
                             pk: str | int,
                             session: AsyncSession | None = None,
                             request_id: str | None = None):
        log.debug(f"{request_id} | Get {self.__name__} entity.")
        try:
            query = (
                select(Orders)
                .where(Orders.uuid == pk)
                .options(
                    selectinload(Orders.files),
                    selectinload(Orders.kmd_list)  # Просто загружаем КМД с их готовыми полями
                )
            )

            if session is None:
                async with async_session_maker() as new_session:
                    result = await new_session.execute(query)
                    entity = result.scalar_one_or_none()
            else:
                result = await session.execute(query)
                entity = result.scalar_one_or_none()

            if not entity:
                log.debug(f"{request_id} | {self.__name__} with pk {pk} not found.")
                return None

            # Теперь просто суммируем уже посчитанные поля из каждой КМД
            entity.total_marks_count = sum(kmd.count_marks for kmd in entity.kmd_list)
            entity.total_marks_count_uq = sum(kmd.count_marks_uq for kmd in entity.kmd_list)
            entity.total_marks_weight = sum(kmd.marks_weight for kmd in entity.kmd_list)

            entity.total_marks_weight = round(entity.total_marks_weight, 2)

            # Формируем список КМД для ответа (если нужно)
            entity.list_kmd = [
                {
                    'uuid': kmd.uuid,
                    'num_kmd': kmd.num_kmd,
                    'count_marks': kmd.count_marks,
                    'count_marks_uq': kmd.count_marks_uq,
                    'marks_weight': kmd.marks_weight
                }
                for kmd in entity.kmd_list
            ]

            return OrdersReadFileMarks.model_validate(entity, from_attributes=True)

        except (OperationalError, InterfaceError) as e:
            log.critical(
                f"{request_id} | База данных недоступна {self.model.__name__}: {e}",
                exc_info=True,
            )
            raise DataBaseError(e)
        except SQLAlchemyError as e:
            log.error(
                f"{request_id} | Ошибка БД при получении {self.model.__name__}: {pk}, Ошибка: {e}",
                exc_info=True,
            )
            raise ErrorInDataBase(e)
        except Exception as e:
            log.error(
                f"Ошибка при получении {self.model.__name__}: {e}",
                exc_info=True,
            )
            raise ErrorInDataBase(e)

    async def get_orders(self,
                         session: AsyncSession,
                         page: int = 1,
                         limit: int = 5,
                         request_id: str | None = None
                         ) -> (list[read_schema], int):
        log.debug(f'{request_id}| Получение заказов')
        offset = (page - 1) * limit

        total_count_subquery = select(func.count()).select_from(Orders).scalar_subquery()

        query = select(
            Orders,
            total_count_subquery.label('total_count')
        ).offset(offset).limit(limit)

        result = await session.execute(query)
        rows = result.all()

        if rows:
            log.debug(f'{request_id}| Заказы получены, перед парсингом')
            total_items = rows[0].total_count
            orders = [self.read_schema.model_validate(row.Orders, from_attributes=True) for row in rows]
            log.debug(f'{request_id}| Заказы валидированы под схему')
        else:
            log.debug(f'{request_id}| Заказов не получены, подзапрос на количество всех заказов')
            total_items = await session.scalar(select(func.count()).select_from(Orders))
            orders = []

        log.debug(f'{request_id}| Запросы выполнены')
        return orders, total_items

    async def get(self,
                  pk: str | int,
                  session: AsyncSession | None = None,
                  request_id: str | None = None) -> OrdersReadFile | None:
        log.debug(f"{request_id} | Get {self.__name__} entity.")
        try:
            query = select(self.model).where(self.model.uuid == pk).options(selectinload(self.model.files))
            if session is None:
                async with async_session_maker() as session:
                    entity = await session.execute(query)

            else:
                entity = await session.execute(query)

            entity = entity.scalars().one_or_none()

        except (OperationalError, InterfaceError) as e:
            log.critical(
                f"{request_id} | База данных недоступна {self.model.__name__}: {e}",
                exc_info=True,
            )
            raise DataBaseError(e)

        except SQLAlchemyError as e:
            log.error(
                f"{request_id} | Ошибка БД при создании {self.model.__name__}: {pk}, Ошибка: {e}",
                exc_info=True,
            )
            raise ErrorInDataBase(e)

        except Exception as e:
            log.error(
                f"Ошибка при создании {self.model.__name__}: {e}",
                exc_info=True,
            )
            raise ErrorInDataBase(e)

        log.debug(f"{request_id} | Successfully get {self.__name__}.")
        if entity:
            return OrdersReadFile.model_validate(entity, from_attributes=True)
        else:
            return None


ordersManager = OrdersManager()
