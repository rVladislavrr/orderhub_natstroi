import logging
import math

from fastapi import APIRouter, Request, status, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.base import DataBaseError, ErrorInDataBase
from src.db.connection import get_async_session
from src.db.marksManager import marksManager
from src.shemas import pagination

router = APIRouter(
    tags=["marks"],
)
log = logging.getLogger('Марк роутер')


@router.get(
    '/{marks_id}/details'
)
async def get_marks(
        request: Request,
        marks_id: int,
        limit: int = Query(5, gt=0),
        page: int = Query(1, gt=0),
        session: AsyncSession = Depends(get_async_session)) -> pagination.PaginatedResponseDetails:
    request_id = request.state.request_id
    log.info(f'{request_id}| Получение деталей')

    try:
        list_details, total_items = await marksManager.get_details(session=session,
                                                                   marks_id=marks_id,
                                                                   limit=limit,
                                                                   page=page,
                                                                   request_id=request_id)

        total_pages = math.ceil(total_items / limit) if total_items > 0 else 0

        res = pagination.PaginatedResponseDetails(
            details=list_details,
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
