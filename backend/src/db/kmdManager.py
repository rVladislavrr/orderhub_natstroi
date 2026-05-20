import logging
from enum import Enum

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.base import BaseManager
from src.db.connection import async_session_maker
from src.models import KMD, Marks
from src.shemas.kmd import KMDRead
from src.shemas.marks import MarksRead
from src.shemas.pagination import Filters

log = logging.getLogger('KMD менеджер')

class FilterValue(str, Enum):
    NULL = "Нет"

class KmdManager(BaseManager[..., ..., ..., KMD]):
    model = KMD
    create_schema = ...
    read_schema = KMDRead
    update_schema = ...

    async def get_with_total(self, pk, session, request_id):
        log.debug(f"{request_id} | Get KMD with stats: {pk}")

        try:
            # Подзапрос для агрегации марок
            # marks_aggregates = (
            #     select(
            #         Marks.kmd_uuid,
            #         func.count(Marks.id).label('marks_count'),
            #         func.sum(Marks.weight * Marks.quantity).label('marks_total_weight')
            #     )
            #     .where(Marks.kmd_uuid == pk)
            #     .group_by(Marks.kmd_uuid)
            #     .subquery()
            # )
            #
            # # Основной запрос
            # query = (
            #     select(self.model, marks_aggregates)
            #     .where(self.model.uuid == pk)
            #     .outerjoin(
            #         marks_aggregates,
            #         self.model.uuid == marks_aggregates.c.kmd_uuid
            #     )
            # )

            if session is None:
                async with async_session_maker() as new_session:
                    # result = await new_session.execute(query)
                    # row = result.first()
                    kmd = await new_session.get(self.model, pk)
            else:
                # result = await session.execute(query)
                # row = result.first()
                kmd = await session.get(self.model, pk)

            if not kmd:
                log.debug(f"{request_id} | KMD with uuid {pk} not found.")
                return None

            # kmd = row[0]
            #
            # kmd.marks_count = row.marks_count or 0
            # kmd.marks_total_weight = round(float(row.marks_total_weight or 0.0),2)

            log.debug(f"{request_id} | Found KMD: {kmd.num_kmd}, "
                      f"marks: {kmd.count_marks}, weight: {kmd.marks_weight}")

            return self.read_schema.model_validate(kmd, from_attributes=True)

        except Exception as e:
            log.error(f"{request_id} | Error getting KMD {pk}: {e}", exc_info=True)
            raise

    @staticmethod
    def create_filters_marks(filter_name: list[str] | None,
                             filter_cooperation: list[str] | None,
                             filter_mounting_part: list[str] | None):
        filters = []
        if filter_name:
            filters.append(Marks.name.in_(filter_name))

        if filter_cooperation:
            has_null = any(v == FilterValue.NULL for v in filter_cooperation)
            regular_values = [v for v in filter_cooperation if v != FilterValue.NULL]

            if regular_values:
                filters.append(Marks.cooperation.in_(regular_values))
            if has_null:
                filters.append(Marks.cooperation.is_(None))

        if filter_mounting_part:

            has_null = any(v == FilterValue.NULL for v in filter_mounting_part)
            regular_values = [v for v in filter_mounting_part if v != FilterValue.NULL]

            if regular_values:
                filters.append(Marks.mounting_part.in_(regular_values))
            if has_null:
                filters.append(Marks.mounting_part.is_(None))

        return filters

    @staticmethod
    async def get_marks(kmd_uuid: str | int, limit: int, page: int,
                        session: AsyncSession,
                        filters,
                        sort_by: str | None, order_by: str | None,
                        request_id: str | None = None
                        ):
        log.debug(f'{request_id}| Получение марок')
        offset = (page - 1) * limit

        total_count_subquery = select(func.count()).select_from(Marks).where(
            Marks.kmd_uuid == kmd_uuid, or_(*filters)).scalar_subquery()

        query = select(
            Marks,
            total_count_subquery.label('total_count')
        ).where(Marks.kmd_uuid == kmd_uuid, or_(*filters)).offset(offset).limit(limit)

        if sort_by is not None:
            if sort_by == 'sum_weight':
                sort_column = (Marks.quantity * Marks.weight)
            else:
                sort_column = getattr(Marks, sort_by, None)
            if sort_column is not None:
                if order_by == 'desc':
                    query = query.order_by(sort_column.desc())
                else:
                    query = query.order_by(sort_column.asc())

        result = await session.execute(query)
        rows = result.all()

        if rows:
            log.debug(f'{request_id}| Марки получены, перед парсингом')
            total_items = rows[0].total_count
            marks = [MarksRead.model_validate(row.Marks, from_attributes=True) for row in rows]
            log.debug(f'{request_id}| Марки валидированы под схему')
        else:
            log.debug(f'{request_id}| Марки не получены, подзапрос на количество всех марок')
            total_items = await session.scalar(select(func.count()).select_from(Marks)
                                               .where(Marks.kmd_uuid == kmd_uuid))
            marks = []

        log.debug(f'{request_id}| Запросы выполнены')
        return marks, total_items

    @staticmethod
    async def get_filters_column(kmd_uuid, column_name, session) -> list[Filters]:
        atr_column = getattr(Marks, column_name, None)
        count_c = func.count(Marks.id).label('count')
        query = select(atr_column.label('value'),
                       count_c).where(Marks.kmd_uuid == kmd_uuid).group_by(atr_column)
        query = query.order_by(count_c.desc())
        rows = (await session.execute(query)).all()
        return [
            Filters(
                name=row.value if row.value is not None else FilterValue.NULL.value,
                count=row.count
            )
            for row in rows
        ]


kmdManager = KmdManager()
