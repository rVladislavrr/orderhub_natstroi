"""
Хелпер для каскадного обновления статусов:
    RelMarkaDel → KMD → Orders

Вызывается после любого изменения статуса детали.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.KMD import KMD
from src.models.orders import Orders, OrderStatus
from src.models.rel_markadet import RelMarkaDel, DetailsStatus


async def recalculate_kmd_status(kmd_uuid, session: AsyncSession) -> None:
    """Пересчитывает статус KMD по статусам его деталей."""

    result = await session.execute(
        select(RelMarkaDel).where(RelMarkaDel.kmd_uuid == kmd_uuid)
    )
    entries = result.scalars().all()

    if not entries:
        return

    kmd = await session.get(KMD, kmd_uuid)
    if kmd is None:
        return

    statuses = {e.status for e in entries}

    # Все завершены (игнорируем CANCELLED при подсчёте)
    active_entries = [e for e in entries if e.status != DetailsStatus.CANCELLED]

    if not active_entries:
        # Все отменены — не меняем статус KMD
        return

    all_completed = all(e.status == DetailsStatus.COMPLETED for e in active_entries)
    any_in_progress = any(
        e.status in (DetailsStatus.IN_PROGRESS, DetailsStatus.COMPLETED)
        for e in active_entries
    )

    from src.models.KMD import KMDStatus  # импорт здесь чтобы не было цикла

    if all_completed:
        kmd.status = KMDStatus.COMPLETED
    elif any_in_progress:
        kmd.status = KMDStatus.IN_PROGRESS


async def recalculate_order_status(order_uuid, session: AsyncSession) -> None:
    """Пересчитывает статус заказа по статусам его KMD."""

    result = await session.execute(
        select(KMD).where(KMD.order_uuid == order_uuid)
    )
    kmd_list = result.scalars().all()

    if not kmd_list:
        return

    order = await session.get(Orders, order_uuid)
    if order is None:
        return

    from src.models.KMD import KMDStatus

    active_kmd = [k for k in kmd_list if k.status != KMDStatus.CANCELLED]

    if not active_kmd:
        return

    all_completed = all(k.status == KMDStatus.COMPLETED for k in active_kmd)
    any_in_progress = any(
        k.status in (KMDStatus.IN_PROGRESS, KMDStatus.COMPLETED)
        for k in active_kmd
    )

    if all_completed:
        order.status = OrderStatus.COMPLETED
    elif any_in_progress:
        order.status = OrderStatus.IN_PROGRESS


async def cascade_status_update(kmd_uuid, session: AsyncSession) -> None:
    """
    Точка входа: обновляет KMD и его заказ.
    Вызывать после commit не нужно — commit делает вызывающий код.
    """
    await recalculate_kmd_status(kmd_uuid, session)

    # Получаем order_uuid из KMD
    kmd = await session.get(KMD, kmd_uuid)
    if kmd:
        await recalculate_order_status(kmd.order_uuid, session)