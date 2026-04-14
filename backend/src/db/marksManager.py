import logging
from fastapi import HTTPException, status

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


from src.db.base import BaseManager
from src.models import Marks, RelMarkaDel, Details
from src.shemas.details import DetailsRead, RelMarkaBase
from src.shemas.marks import MarksRead

log = logging.getLogger('Маркс менеджер')


class MarksManager(BaseManager[..., MarksRead, ..., Marks]):
    model = Marks
    create_schema = ...
    read_schema = MarksRead
    update_schema = ...

    @staticmethod
    async def get_details(marks_id,
                          limit,
                          page,
                          request_id, session):

        log.debug(f'{request_id}| Получение марок')
        offset = (page - 1) * limit

        total_count_subquery = select(func.count()).select_from(RelMarkaDel).where(
            RelMarkaDel.marks_id == marks_id).scalar_subquery()

        query = select(
            RelMarkaDel,
            total_count_subquery.label('total_count')
        ).where(RelMarkaDel.marks_id == marks_id).options(selectinload(RelMarkaDel.detail)).offset(offset).limit(limit)

        result = await session.execute(query)
        rows = result.all()

        if rows:
            log.debug(f'{request_id}| Детали получены, перед парсингом')
            total_items = rows[0].total_count
            details = [RelMarkaBase.model_validate(row[0], from_attributes=True) for row in rows]
            log.debug(f'{request_id}| Детали валидированы под схему')
        else:
            log.debug(f'{request_id}| Детали не получены, подзапрос на количество всех деталей')
            total_items = await session.scalar(select(func.count()).select_from(RelMarkaDel)
                                               .where(RelMarkaDel.marks_id == marks_id))
            details = []

        log.debug(f'{request_id}| Запросы выполнены')
        return details, total_items


marksManager = MarksManager()
