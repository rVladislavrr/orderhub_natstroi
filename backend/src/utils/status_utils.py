from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.KMD import KMD, KMDStatus
from src.models.marks import Marks, MarkStatus
from src.models.orders import Orders, OrderStatus
from src.models.rel_markadet import RelMarkaDel, DetailsStatus


# ---------------------------------------------------------------------------
# Уровень 1: Деталь → все марки KMD (один батч вместо N запросов)
# ---------------------------------------------------------------------------

async def recalculate_marks_for_kmd(kmd_uuid, session: AsyncSession) -> None:
    """
    Пересчитывает статусы ВСЕХ марок одного KMD за 2 запроса:
      1. SELECT все марки KMD
      2. SELECT все rel_markadel этого KMD
    Вместо N*(SELECT marks + SELECT rel_markadel) в цикле.
    """
    # 1 запрос — все марки KMD
    marks: list[Marks] = (await session.execute(
        select(Marks).where(Marks.kmd_uuid == kmd_uuid)
    )).scalars().all()

    if not marks:
        return

    # Марки которые уже собираются/отгружены — не трогаем
    marks_to_update = {
        m.id: m for m in marks
        if m.status not in (MarkStatus.ASSEMBLED, MarkStatus.SHIPPED)
    }
    if not marks_to_update:
        return

    # 2 запрос — все rel_markadel этого KMD одним SELECT
    entries: list[RelMarkaDel] = (await session.execute(
        select(RelMarkaDel).where(RelMarkaDel.kmd_uuid == kmd_uuid)
    )).scalars().all()

    # Группируем записи по mark_id
    by_mark: dict[int, list[RelMarkaDel]] = defaultdict(list)
    for e in entries:
        by_mark[e.marks_id].append(e)

    # Пересчитываем статус каждой марки без доп. запросов
    for mark_id, mark in marks_to_update.items():
        mark_entries = by_mark.get(mark_id, [])
        active = [e for e in mark_entries if e.status != DetailsStatus.CANCELLED]

        if not active:
            continue

        all_completed = all(e.status == DetailsStatus.COMPLETED for e in active)
        any_started = any(
            e.status in (DetailsStatus.IN_PROGRESS, DetailsStatus.COMPLETED)
            for e in active
        )

        if all_completed:
            mark.status = MarkStatus.COMPLETED
        elif any_started:
            mark.status = MarkStatus.IN_PROGRESS
        else:
            mark.status = MarkStatus.NEW


# ---------------------------------------------------------------------------
# Уровень 2: Марки → KMD (один запрос)
# ---------------------------------------------------------------------------

async def recalculate_kmd_status(kmd_uuid, session: AsyncSession) -> None:
    """1 запрос — все марки KMD, пересчёт статуса KMD."""
    marks: list[Marks] = (await session.execute(
        select(Marks).where(Marks.kmd_uuid == kmd_uuid)
    )).scalars().all()

    kmd = await session.get(KMD, kmd_uuid)
    if kmd is None or not marks:
        return

    all_done = all(
        m.status in (MarkStatus.COMPLETED, MarkStatus.ASSEMBLED, MarkStatus.SHIPPED)
        for m in marks
    )
    any_started = any(m.status != MarkStatus.NEW for m in marks)

    if all_done:
        kmd.status = KMDStatus.COMPLETED
    elif any_started:
        kmd.status = KMDStatus.IN_PROGRESS
    else:
        kmd.status = KMDStatus.NEW


# ---------------------------------------------------------------------------
# Уровень 3: KMD → Заказ (один запрос)
# ---------------------------------------------------------------------------

async def recalculate_order_status(order_uuid, session: AsyncSession) -> None:
    """1 запрос — все KMD заказа, пересчёт статуса заказа."""
    kmd_list: list[KMD] = (await session.execute(
        select(KMD).where(KMD.order_uuid == order_uuid)
    )).scalars().all()

    order = await session.get(Orders, order_uuid)
    if order is None or not kmd_list:
        return

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


# ---------------------------------------------------------------------------
# Точки входа
# ---------------------------------------------------------------------------

async def cascade_status_update(kmd_uuid, session: AsyncSession) -> None:
    """
    Вызывать после изменения статуса детали.
    Итого: 5 запросов на весь каскад вместо N+1.
      1. SELECT marks WHERE kmd_uuid        (recalculate_marks_for_kmd)
      2. SELECT rel_markadel WHERE kmd_uuid  (recalculate_marks_for_kmd)
      3. SELECT marks WHERE kmd_uuid        (recalculate_kmd_status)
      4. GET kmd                            (recalculate_kmd_status)
      5. SELECT kmd WHERE order_uuid        (recalculate_order_status)
      6. GET order                          (recalculate_order_status)
    """
    await recalculate_marks_for_kmd(kmd_uuid, session)
    await recalculate_kmd_status(kmd_uuid, session)

    kmd = await session.get(KMD, kmd_uuid)
    if kmd:
        await recalculate_order_status(kmd.order_uuid, session)


async def cascade_from_mark(mark_id: int, session: AsyncSession) -> None:
    """
    Вызывать после сборки или отгрузки марки.
    Пересчитывает KMD → Заказ (марки не трогаем — их статус уже выставлен).
    """
    mark = await session.get(Marks, mark_id)
    if mark is None:
        return

    await recalculate_kmd_status(mark.kmd_uuid, session)

    kmd = await session.get(KMD, mark.kmd_uuid)
    if kmd:
        await recalculate_order_status(kmd.order_uuid, session)