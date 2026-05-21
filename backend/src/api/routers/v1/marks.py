import logging
import math

from fastapi import APIRouter, Request, status, Query, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.base import DataBaseError, ErrorInDataBase
from src.db.connection import get_async_session
from src.db.marksManager import marksManager
from src.models import Marks, Users
from src.models.marks import MarkStatus
from src.models.markshipment import MarkShipment
from src.models.rel_usermark import RelUserMark
from src.shemas import pagination
from src.shemas.marks import AssembleResponse, AssembleRequest, ShipResponse, ShipRequest, MarkHistoryResponse, \
    AssemblyHistoryItem
from src.utils.status_utils import cascade_from_mark
from workers.tasks.read_excel import update_kmd_shipped_task

router = APIRouter(
    tags=["marks"],
)
log = logging.getLogger('Марк роутер')


@router.get(
    '/{marks_id}/details',
    summary='Получение всех деталей в марке'
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


@router.post(
    "/{mark_id}/assemble",
    response_model=AssembleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Записать сборку марки",
)
async def assemble_mark(
        mark_id: int,
        body: AssembleRequest,
        session: AsyncSession = Depends(get_async_session),
):
    mark = await session.get(Marks, mark_id)
    if mark is None:
        raise HTTPException(status_code=404, detail="Марка не найдена")

    # Собирать можно только если все детали готовы
    if mark.status not in (MarkStatus.COMPLETED, MarkStatus.ASSEMBLED):
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя собирать марку со статусом «{mark.status}». "
                   f"Все детали должны быть завершены.",
        )

    if mark.status == MarkStatus.SHIPPED:
        raise HTTPException(status_code=400, detail="Марка уже полностью отгружена")

    # Проверяем что не превышаем количество
    remaining_to_assemble = mark.quantity - mark.assembled_quantity
    if body.quantity > remaining_to_assemble:
        raise HTTPException(
            status_code=400,
            detail=f"Указанное количество ({body.quantity}) превышает "
                   f"остаток для сборки ({remaining_to_assemble})",
        )

    user = await session.get(Users, body.user_uuid)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Создаём запись сборки
    entry = RelUserMark(
        user_uuid=body.user_uuid,
        mark_id=mark_id,
        quantity=body.quantity,
        assembly_date=body.assembly_date,
    )
    session.add(entry)

    mark.assembled_quantity += body.quantity

    # Статус марки
    if mark.assembled_quantity >= mark.quantity:
        mark.status = MarkStatus.ASSEMBLED
        message = "Марка полностью собрана"
    else:
        mark.status = MarkStatus.ASSEMBLED  # частично — тоже ASSEMBLED
        message = f"Частичная сборка. Собрано {mark.assembled_quantity} из {mark.quantity}"

    await cascade_from_mark(mark_id, session)
    await session.commit()
    await session.refresh(entry)

    return AssembleResponse(
        assembly_id=entry.id,
        mark_id=mark_id,
        mark_title=mark.title,
        user_uuid=body.user_uuid,
        quantity=body.quantity,
        assembly_date=body.assembly_date,
        assembled_quantity=mark.assembled_quantity,
        total_quantity=mark.quantity,
        mark_status=mark.status,
        message=message,
    )


@router.post(
    "/{mark_id}/ship",
    response_model=ShipResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Записать отгрузку марки",
)
async def ship_mark(
        request: Request,
        mark_id: int,
        body: ShipRequest,
        session: AsyncSession = Depends(get_async_session),
):
    mark = await session.get(Marks, mark_id)
    if mark is None:
        raise HTTPException(status_code=404, detail="Марка не найдена")

    if mark.status not in (MarkStatus.ASSEMBLED, MarkStatus.SHIPPED):
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя отгружать марку со статусом «{mark.status}». "
                   f"Марка должна быть собрана.",
        )

    # Можно отгружать только собранные (не отгруженные ещё)
    available_to_ship = mark.assembled_quantity - mark.shipped_quantity
    if available_to_ship <= 0:
        raise HTTPException(status_code=400, detail="Нет собранных марок для отгрузки")

    if body.quantity > available_to_ship:
        raise HTTPException(
            status_code=400,
            detail=f"Указанное количество ({body.quantity}) превышает "
                   f"доступное для отгрузки ({available_to_ship})",
        )

    user = await session.get(Users, body.user_uuid)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    shipment = MarkShipment(
        mark_id=mark_id,
        user_uuid=body.user_uuid,
        quantity=body.quantity,
        shipment_date=body.shipment_date,
        note=body.note,
    )
    session.add(shipment)

    mark.shipped_quantity += body.quantity

    if mark.shipped_quantity >= mark.quantity:
        mark.status = MarkStatus.SHIPPED
        message = "Марка полностью отгружена"
    else:
        message = f"Частичная отгрузка. Отгружено {mark.shipped_quantity} из {mark.quantity}"

    await cascade_from_mark(mark_id, session)
    await session.commit()
    request_id = request.state.request_id
    await update_kmd_shipped_task.kiq(
        kmd_uuids=[str(mark.kmd_uuid)],
        request_id=request_id,
    )
    await session.refresh(shipment)

    return ShipResponse(
        shipment_id=shipment.id,
        mark_id=mark_id,
        mark_title=mark.title,
        user_uuid=body.user_uuid,
        quantity=body.quantity,
        shipment_date=body.shipment_date,
        shipped_quantity=mark.shipped_quantity,
        assembled_quantity=mark.assembled_quantity,
        total_quantity=mark.quantity,
        mark_status=mark.status,
        message=message,
    )


@router.get(
    "/{mark_id}/history",
    response_model=MarkHistoryResponse,
    summary="История сборок и отгрузок по марке",
)
async def get_mark_history(
        mark_id: int,
        session: AsyncSession = Depends(get_async_session),
):
    mark = await session.get(Marks, mark_id)
    if mark is None:
        raise HTTPException(status_code=404, detail="Марка не найдена")

    assemblies = (await session.execute(
        select(RelUserMark).where(RelUserMark.mark_id == mark_id)
    )).scalars().all()

    shipments = (await session.execute(
        select(MarkShipment).where(MarkShipment.mark_id == mark_id)
    )).scalars().all()

    history: list[AssemblyHistoryItem] = []

    for a in assemblies:
        u = await session.get(Users, a.user_uuid)
        history.append(AssemblyHistoryItem(
            id=a.id,
            type="assembly",
            user_name=u.name if u else "—",
            user_lastname=u.lastname if u else "—",
            quantity=a.quantity,
            event_date=a.assembly_date,
        ))

    for s in shipments:
        u = await session.get(Users, s.user_uuid)
        history.append(AssemblyHistoryItem(
            id=s.id,
            type="shipment",
            user_name=u.name if u else "—",
            user_lastname=u.lastname if u else "—",
            quantity=s.quantity,
            event_date=s.shipment_date,
        ))

    history.sort(key=lambda x: x.event_date)

    return MarkHistoryResponse(
        mark_id=mark_id,
        mark_title=mark.title,
        mark_name=mark.name,
        total_quantity=mark.quantity,
        assembled_quantity=mark.assembled_quantity,
        shipped_quantity=mark.shipped_quantity,
        status=mark.status,
        history=history,
    )
