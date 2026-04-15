import logging
import math

from typing import Literal
from fastapi import APIRouter, Request, Depends, status, HTTPException, Query
from pydantic import UUID4
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.base import ErrorInDataBase, DataBaseError
from src.db.connection import get_async_session
from src.db.kmdManager import kmdManager, FilterValue
from src.shemas import pagination
from src.shemas.kmd import KMDRead
from src.shemas.pagination import Filters

log = logging.getLogger('KMD роутер')

router = APIRouter(
    tags=["orders"],
)


@router.get('/{kmd_uuid}')
async def get_kmd(
        request: Request,
        kmd_uuid: UUID4,
        session: AsyncSession = Depends(get_async_session)) -> KMDRead:
    request_id = request.state.request_id
    log.info(f'{request_id}| Получение кмд')

    try:
        kmd = await kmdManager.get_with_total(pk=kmd_uuid, session=session, request_id=request_id)

    except DataBaseError:
        log.error(f'{request_id}| база данных недоступна')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='База данных недоступна')

    except ErrorInDataBase:
        log.error(f'{request_id}| ошибка в получении')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Ошибка при получении')

    if kmd:
        log.info(f'{request_id}| Кмд успешно получено')
        return kmd
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Кмд не найден')


@router.get(
    '/{kmd_uuid}/marks'
)
async def get_marks(
        request: Request,
        kmd_uuid: UUID4,
        sort_by: Literal['title', 'quantity', 'weight', 'sum_weight'] = Query(None, ),
        order_by: Literal['asc', 'desc'] = Query(None, ),
        filter_name: list[str] | None = Query(None, description="Filter by name"),
        filter_cooperation: list[str | FilterValue] | None = Query(None, description="Filter by cooperation"),
        filter_mounting_part: list[str | FilterValue] | None = Query(None, description="Filter by mounting_part"),
        limit: int = Query(5, gt=0),
        page: int = Query(1, gt=0),
        session: AsyncSession = Depends(get_async_session)) -> pagination.PaginatedResponseMarks:
    request_id = request.state.request_id
    log.info(f'{request_id}| Получение марок')

    try:
        filters = kmdManager.create_filters_marks(filter_name, filter_cooperation, filter_mounting_part)
        list_marks, total_items = await kmdManager.get_marks(session=session,
                                                             kmd_uuid=kmd_uuid,
                                                             limit=limit,
                                                             page=page, sort_by=sort_by, order_by=order_by,
                                                             filters=filters,
                                                             request_id=request_id)

        total_pages = math.ceil(total_items / limit) if total_items > 0 else 0

        res = pagination.PaginatedResponseMarks(
            marks=list_marks,
            pagination=pagination.PaginationInfo(
                page=page,
                limit=limit,
                total_items=total_items,
                total_pages=total_pages,
                has_more=page < total_pages,
                has_previous=page > 1,
                next_page=page + 1 if page < total_pages else None,
                previous_page=page - 1 if page > 1 else None
            )
        )

    except DataBaseError:
        log.error(f'{request_id}| база данных недоступна')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='База данных недоступна')

    except ErrorInDataBase:
        log.error(f'{request_id}| ошибка в получении')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Ошибка при создании')

    log.info(f'{request_id}| Марки успешно получены')
    return res


@router.get(
    '/{kmd_uuid}/filters'
)
async def get_filters(request: Request, kmd_uuid: UUID4,
                      column: Literal['name', 'cooperation', 'mounting_part'] = Query(..., ),
                      session: AsyncSession = Depends(get_async_session)) -> list[Filters]:
    request_id = request.state.request_id
    try:
        log.info(f'{request_id}| Получение фильтров')
        filters_value = await kmdManager.get_filters_column(kmd_uuid, column, session)
        log.info(f'{request_id}| Значение фильтров успешно получены')
        return filters_value
    except Exception:
        log.error(f'{request_id}| Неизвестная ошибка при получении фильтров')
        raise
