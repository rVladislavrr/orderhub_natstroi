import logging
import math

from typing import Literal
from fastapi import APIRouter, Request, Depends, status, HTTPException, Query
from pydantic import UUID4, BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.base import ErrorInDataBase, DataBaseError
from src.db.connection import get_async_session
from src.db.kmdManager import kmdManager, FilterValue
from src.models import Details, KMD, RelMarkaDel, Marks
from src.models.marks import MarkStatus
from src.models.rel_markadet import DetailsStatus
from src.shemas import pagination
from src.shemas.kmd import KMDRead
from src.shemas.pagination import Filters

log = logging.getLogger('KMD роутер')

router = APIRouter(
    tags=["kmd"],
)


@router.get('/{kmd_uuid}', summary='Получение конкретного кмд')
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
    '/{kmd_uuid}/marks',
summary='Получение всех макрок из кмд'
)
async def get_marks(
        request: Request,
        kmd_uuid: UUID4,
        sort_by: Literal['title', 'quantity', 'weight', 'sum_weight'] = Query(None, ),
        order_by: Literal['asc', 'desc'] = Query(None, ),
        filter_name: list[str] | None = Query(None, description="Filter by name"),
        filter_cooperation: list[str | FilterValue] | None = Query(None, description="Filter by cooperation"),
        filter_mounting_part: list[str | FilterValue] | None = Query(None, description="Filter by mounting_part"),
        filter_status: list[MarkStatus | FilterValue] | None = Query(None, description="Filter by status"),
        limit: int = Query(5, gt=0),
        page: int = Query(1, gt=0),
        session: AsyncSession = Depends(get_async_session)) -> pagination.PaginatedResponseMarks:
    request_id = request.state.request_id
    log.info(f'{request_id}| Получение марок')

    try:
        filters = kmdManager.create_filters_marks(filter_name, filter_cooperation, filter_mounting_part, filter_status)
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
    '/{kmd_uuid}/filters',
summary='Получение всех фильтров в кмд'
)
async def get_filters(request: Request, kmd_uuid: UUID4,
                      column: Literal['name', 'cooperation', 'mounting_part', 'que_num', 'status'] = Query(..., ),
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


class DetailSearchItem(BaseModel):
    """Одна марка из результатов поиска детали."""
    rel_markadel_id: int  # ID связи — нужен для bulk записи
    mark_id: int
    mark_title: str  # Б2-30
    mark_name: str  # Балка
    mark_quantity: int
    detail_quantity: int
    remaining_quantity: int
    que_num: str | None
    status: str


class DetailSearchResponse(BaseModel):
    num_detail: str
    que_num: str | None
    items: list[DetailSearchItem]
    total_remaining: int  # суммарный остаток по всем маркам


# В kmd роутер добавить:
@router.get(
    "/{kmd_uuid}/detail-search",
    response_model=DetailSearchResponse,
    summary="Найти марки по номеру детали и очереди",
)
async def detail_search(
        kmd_uuid: UUID4,
        num_detail: str = Query(..., description="Номер детали, например '001.1'"),
        que_num: str | None = Query(None, description="Номер очереди"),
        session: AsyncSession = Depends(get_async_session),
):

    # Проверяем что KMD существует
    kmd = await session.get(KMD, kmd_uuid)
    if kmd is None:
        raise HTTPException(status_code=404, detail="КМД не найден")

    # Ищем деталь в этом KMD по номеру
    detail = (await session.execute(
        select(Details).where(
            Details.kmd_uuid == kmd_uuid,
            Details.num_detail == num_detail,
        )
    )).scalar_one_or_none()

    if detail is None:
        raise HTTPException(
            status_code=404,
            detail=f"Деталь '{num_detail}' не найдена в КМД"
        )

    # Находим все связи этой детали в данном KMD с фильтром по очереди
    stmt = (
        select(RelMarkaDel, Marks)
        .join(Marks, Marks.id == RelMarkaDel.marks_id)
        .where(
            RelMarkaDel.details_id == detail.id,
            RelMarkaDel.kmd_uuid == kmd_uuid,
            RelMarkaDel.status != DetailsStatus.CANCELLED,
        )
    )
    if que_num is not None:
        stmt = stmt.where(RelMarkaDel.que_num == que_num)

    rows = (await session.execute(stmt)).all()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Деталь '{num_detail}' не найдена в марках"
                   + (f" с очередью '{que_num}'" if que_num else "")
        )

    items = []
    total_remaining = 0

    for rel, mark in rows:

        items.append(DetailSearchItem(
            rel_markadel_id=rel.id,
            mark_id=mark.id,
            mark_title=mark.title,
            mark_name=mark.name,
            mark_quantity=mark.quantity,
            detail_quantity=rel.details_quantity,
            remaining_quantity=rel.remaining_quantity,
            que_num=rel.que_num,
            status=rel.status,
        ))
        total_remaining += rel.remaining_quantity

    # Сортируем по названию марки
    items.sort(key=lambda x: x.mark_title)

    return DetailSearchResponse(
        num_detail=num_detail,
        que_num=que_num,
        items=items,
        total_remaining=total_remaining,
    )

@router.get(
    "/{kmd_uuid}/details/search",
    response_model=list[str],
    summary="Поиск номеров деталей в КМД (для автодополнения)",
)
async def search_detail_numbers(
    kmd_uuid: UUID4,
    search: str | None = Query(None, description="Начало номера: '001' → ['001.1', '001.2']"),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = (
        select(Details.num_detail)
        .distinct()
        .join(RelMarkaDel, RelMarkaDel.details_id == Details.id)
        .where(
            RelMarkaDel.kmd_uuid == kmd_uuid,
            RelMarkaDel.status != DetailsStatus.CANCELLED,
        )
        .order_by(Details.num_detail)
    )
    if search:
        stmt = stmt.where(Details.num_detail.ilike(f"%{search}%"))

    return (await session.execute(stmt)).scalars().all()


@router.get(
    "/{kmd_uuid}/queues",
    response_model=list[str],
    summary="Список очередей в КМД (для автодополнения)",
)
async def get_kmd_queues(
    kmd_uuid: UUID4,
    num_detail: str | None = Query(None, description="Фильтр по номеру детали"),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = (
        select(RelMarkaDel.que_num)
        .distinct()
        .where(
            RelMarkaDel.kmd_uuid == kmd_uuid,
            RelMarkaDel.que_num.isnot(None),
            RelMarkaDel.status != DetailsStatus.CANCELLED,
        )
        .order_by(RelMarkaDel.que_num)
    )

    if num_detail:
        stmt = stmt.join(Details, Details.id == RelMarkaDel.details_id).where(
            Details.num_detail == num_detail  # было ilike(f"%{num_detail}%")
        )

    return (await session.execute(stmt)).scalars().all()