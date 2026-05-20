import math
from datetime import date
from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config import settings
from src.db.connection import get_async_session
from src.models import Orders, KMD
from src.models.rel_userdel import RelUserDel
from src.models.rel_markadet import RelMarkaDel, DetailsStatus
from src.models.users import Users
from src.shemas.users import Workers
from src.shemas.work import WorkCreateResponse, WorkCreateRequest, WorkLogItem, WorkUserInfo, WorkRelInfo
from src.utils.status_utils import cascade_status_update
from src.shemas.pagination import PaginationInfo, PaginatedResponseWorkers, PaginatedWorkLog

router = APIRouter(tags=["work"])

@router.get(
    "/workers",
    response_model=PaginatedResponseWorkers,
    summary="Список пользователей с пагинацией",
)
async def get_workers(
        page: int = Query(1, ge=1, description="Номер страницы"),
        limit: int = Query(10, ge=1, le=100, description="Записей на странице"),
        session: AsyncSession = Depends(get_async_session),
):
    offset = (page - 1) * limit

    base_stmt = select(Users)
    count_stmt = select(func.count()).select_from(Users)

    base_stmt = base_stmt.where(Users.is_active == True, Users.username != settings.ADMIN_USERNAME)
    count_stmt = count_stmt.where(Users.is_active == True, Users.username != settings.ADMIN_USERNAME)

    total_items = (await session.execute(count_stmt)).scalar_one()
    total_pages = math.ceil(total_items / limit) if total_items else 1

    stmt = (
        base_stmt
        .order_by(Users.lastname, Users.name)
        .offset(offset)
        .limit(limit)
    )
    users = (await session.execute(stmt)).scalars().all()

    return PaginatedResponseWorkers(
        workers=[Workers.model_validate(u, from_attributes=True) for u in users],
        pagination=PaginationInfo(
            page=page,
            limit=limit,
            total_items=total_items,
            total_pages=total_pages,
            has_more=page < total_pages,
            has_previous=page > 1,
            next_page=page + 1 if page < total_pages else None,
            previous_page=page - 1 if page > 1 else None,
        ),
    )


@router.post(
    "/",
    response_model=WorkCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Записать выполнение деталей пользователем",
)
async def record_work(
        body: WorkCreateRequest,
        session: AsyncSession = Depends(get_async_session),
):
    # 1. Проверяем пользователя
    user = await session.get(Users, body.user_uuid)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Пользователь неактивен")

    # 2. Проверяем связь марка-деталь
    rel = await session.get(RelMarkaDel, body.rel_markadel_id)
    if rel is None:
        raise HTTPException(status_code=404, detail="Связь марка-деталь не найдена")
    if rel.status == DetailsStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Связь уже завершена")
    if rel.status == DetailsStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Связь отменена, работа невозможна")

    # 3. Проверяем количество
    if body.quantity > rel.remaining_quantity:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Указанное количество ({body.quantity}) превышает "
                f"остаток ({rel.remaining_quantity})"
            ),
        )

    # 4. Создаём запись о работе
    work_entry = RelUserDel(
        user_uuid=body.user_uuid,
        rel_markadel_id=body.rel_markadel_id,
        quantity=body.quantity,
        completion_date=body.completion_date,
    )
    session.add(work_entry)

    # 5. Обновляем остаток и статус связи
    rel.remaining_quantity -= body.quantity

    if rel.remaining_quantity <= 0:
        rel.remaining_quantity = 0
        rel.status = DetailsStatus.COMPLETED
        message = "Деталь полностью закрыта"
    else:
        rel.status = DetailsStatus.IN_PROGRESS
        message = f"Частичное выполнение. Осталось: {rel.remaining_quantity}"

    # 6. Каскадно обновляем статус KMD → Orders
    await cascade_status_update(rel.kmd_uuid, session)

    await session.commit()
    await session.refresh(work_entry)

    return WorkCreateResponse(
        work_id=work_entry.id,
        rel_markadel_id=rel.id,
        user_uuid=body.user_uuid,
        quantity=body.quantity,
        completion_date=body.completion_date,
        remaining_quantity=rel.remaining_quantity,
        detail_status=rel.status,
        message=message,
    )


@router.get(
    "/",
    response_model=PaginatedWorkLog,
    summary="Журнал выполнения деталей",
)
async def get_work_log(
        page: int = Query(1, ge=1, description="Номер страницы"),
        limit: int = Query(20, ge=1, le=100, description="Записей на странице"),
        user_uuid: UUID | None = Query(None, description="Фильтр по пользователю"),
        completion_date: date | None = Query(None, description="Фильтр по дате выполнения"),
        session: AsyncSession = Depends(get_async_session),
):
    offset = (page - 1) * limit

    base_stmt = (
        select(RelUserDel)
        .options(
            # пользователь
            selectinload(RelUserDel.user),
            # связь → марка
            selectinload(RelUserDel.rel_markadel).selectinload(RelMarkaDel.mark),
            # связь → деталь
            selectinload(RelUserDel.rel_markadel).selectinload(RelMarkaDel.detail),
            # связь → кмд → заказ
            selectinload(RelUserDel.rel_markadel)
            .selectinload(RelMarkaDel.kmd)
            .selectinload(KMD.order),
        )
    )
    count_stmt = select(func.count()).select_from(RelUserDel)

    if user_uuid is not None:
        base_stmt = base_stmt.where(RelUserDel.user_uuid == user_uuid)
        count_stmt = count_stmt.where(RelUserDel.user_uuid == user_uuid)

    if completion_date is not None:
        base_stmt = base_stmt.where(RelUserDel.completion_date == completion_date)
        count_stmt = count_stmt.where(RelUserDel.completion_date == completion_date)

    total_items = (await session.execute(count_stmt)).scalar_one()
    total_pages = ceil(total_items / limit) if total_items else 1

    stmt = (
        base_stmt
        .order_by(RelUserDel.completion_date.desc(), RelUserDel.id.desc())
        .offset(offset)
        .limit(limit)
    )
    entries = (await session.execute(stmt)).scalars().all()

    items = []
    for entry in entries:
        rel = entry.rel_markadel
        kmd = rel.kmd
        order = kmd.order

        items.append(WorkLogItem(
            id=entry.id,
            user=WorkUserInfo(
                uuid=entry.user.uuid,
                name=entry.user.name,
                lastname=entry.user.lastname,
            ),
            relation=WorkRelInfo(
                id=rel.id,
                mark_title=rel.mark.title,
                mark_name=rel.mark.name,
                detail_num=rel.detail.num_detail,
                detail_type=rel.detail.type,
                detail_size=rel.detail.size,
                kmd_num=kmd.num_kmd,
                internal_num_orders=order.internal_num_orders,
                order_name=order.name,
            ),
            quantity=entry.quantity,
            completion_date=entry.completion_date,
        ))

    return PaginatedWorkLog(
        items=items,
        pagination=PaginationInfo(
            page=page,
            limit=limit,
            total_items=total_items,
            total_pages=total_pages,
            has_more=page < total_pages,
            has_previous=page > 1,
            next_page=page + 1 if page < total_pages else None,
            previous_page=page - 1 if page > 1 else None,
        ),
    )
