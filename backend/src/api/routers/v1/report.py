import asyncio
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.connection import get_async_session
from src.models.orders import Orders
from src.models.KMD import KMD
from src.models.marks import Marks
from src.models.rel_markadet import RelMarkaDel, DetailsStatus
from src.models.rel_userdel import RelUserDel
from src.models.rel_usermark import RelUserMark
from src.models.markshipment import MarkShipment
from src.models.delivery import DeliveryItem, DeliveryAllocation
from src.models.users import Users
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, computed_field


class KMDSummary(BaseModel):
    uuid: str
    num_kmd: str
    status: str
    marks_total: int
    marks_completed: int
    marks_shipped: int
    marks_weight: Decimal
    shipped_weight: Decimal

    @computed_field
    @property
    def completion_pct(self) -> float:
        if self.marks_total == 0:
            return 0.0
        return round(self.marks_shipped / self.marks_total * 100, 1)


class TimeMetrics(BaseModel):
    order_created_date: date
    first_activity_date: Optional[date]       # первая запись RelUserDel или RelUserMark
    last_activity_date: Optional[date]        # последняя активность
    first_shipment_date: Optional[date]
    last_shipment_date: Optional[date]

    days_since_created: int
    days_in_production: Optional[int]         # last_activity - first_activity
    days_to_completion: Optional[int]         # только если заказ завершён

    avg_days_per_mark: Optional[float]        # среднее: сколько дней от первой до последней сборки марки
    avg_days_per_detail: Optional[float]      # среднее по деталям


class ProgressMetrics(BaseModel):
    # Марки
    total_marks_uq: int                       # уникальных марок
    total_marks_qty: int                      # с учётом quantity
    assembled_marks: int
    shipped_marks: int
    marks_assembly_pct: float
    marks_shipment_pct: float

    # Детали
    total_details: int
    completed_details: int
    details_completion_pct: float

    # КМД
    total_kmd: int
    completed_kmd: int
    kmd_completion_pct: float

    # Вес
    total_marks_weight: Decimal
    shipped_marks_weight: Decimal
    weight_shipment_pct: float


class DeliveryMetrics(BaseModel):
    total_deliveries: int                     # кол-во поставок (trucks)
    total_delivery_items: int                 # позиций в поставках
    total_delivery_weight: Decimal            # общий вес по всем поставкам
    allocated_weight: Decimal                 # распределено в КМД
    remaining_weight: Decimal                 # остаток на складе

    @computed_field
    @property
    def allocation_pct(self) -> float:
        if self.total_delivery_weight == 0:
            return 0.0
        return round(float(self.allocated_weight) / float(self.total_delivery_weight) * 100, 1)


class WorkloadMetrics(BaseModel):
    total_workers: int                        # уникальных рабочих на заказ
    total_detail_operations: int              # записей RelUserDel
    total_assembly_operations: int            # записей RelUserMark
    total_shipment_operations: int            # записей MarkShipment
    busiest_worker_name: Optional[str]        # кто сделал больше всего деталей
    busiest_worker_operations: Optional[int]

class OrderReportResponse(BaseModel):
    order_uuid: str
    order_name: str
    internal_num_orders: int
    order_status: str
    is_active: bool

    time: TimeMetrics
    progress: ProgressMetrics
    delivery: DeliveryMetrics
    workload: WorkloadMetrics
    kmd_breakdown: list[KMDSummary]

router = APIRouter(prefix="/orders", tags=["orders"])


async def _get_order_or_404(session: AsyncSession, order_uuid: UUID) -> Orders:
    result = await session.execute(
        select(Orders).where(Orders.uuid == order_uuid)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

async def _build_time_metrics(
    session: AsyncSession,
    order: Orders,
    kmd_uuids: list[UUID],
) -> TimeMetrics:
    today = date.today()
    days_since_created = (today - order.internal_create_date).days

    empty = TimeMetrics(
        order_created_date=order.internal_create_date,
        first_activity_date=None,
        last_activity_date=None,
        first_shipment_date=None,
        last_shipment_date=None,
        days_since_created=days_since_created,
        days_in_production=None,
        days_to_completion=None,
        avg_days_per_mark=None,
        avg_days_per_detail=None,
    )

    if not kmd_uuids:
        return empty

    rel_ids_subq = (
        select(RelMarkaDel.id)
        .where(RelMarkaDel.kmd_uuid.in_(kmd_uuids))
        .scalar_subquery()
    )
    mark_ids_subq = (
        select(Marks.id)
        .where(Marks.kmd_uuid.in_(kmd_uuids))
        .scalar_subquery()
    )

    # Даты по деталям
    detail_dates_result = await session.execute(
        select(
            func.min(RelUserDel.completion_date).label("d_min"),
            func.max(RelUserDel.completion_date).label("d_max"),
        ).where(RelUserDel.rel_markadel_id.in_(rel_ids_subq))
    )
    detail_dates = detail_dates_result.one()

    mark_dates_result = await session.execute(
        select(
            func.min(RelUserMark.assembly_date).label("m_min"),
            func.max(RelUserMark.assembly_date).label("m_max"),
        ).where(RelUserMark.mark_id.in_(mark_ids_subq))
    )
    mark_dates = mark_dates_result.one()

    shipment_dates_result = await session.execute(
        select(
            func.min(MarkShipment.shipment_date).label("s_min"),
            func.max(MarkShipment.shipment_date).label("s_max"),
        ).where(MarkShipment.mark_id.in_(mark_ids_subq))
    )
    shipment_dates = shipment_dates_result.one()

    all_mins = [x for x in [detail_dates.d_min, mark_dates.m_min] if x is not None]
    all_maxs = [x for x in [detail_dates.d_max, mark_dates.m_max] if x is not None]
    first_activity = min(all_mins) if all_mins else None
    last_activity = max(all_maxs) if all_maxs else None

    days_in_production = (
        (last_activity - first_activity).days
        if first_activity and last_activity and last_activity != first_activity
        else None
    )

    avg_mark_result = await session.execute(
        select(
            (
                func.max(RelUserMark.assembly_date) - func.min(RelUserMark.assembly_date)
            ).label("days_diff")
        )
        .where(RelUserMark.mark_id.in_(mark_ids_subq))
        .group_by(RelUserMark.mark_id)
    )
    mark_day_rows = avg_mark_result.fetchall()
    avg_days_per_mark: Optional[float] = None
    if mark_day_rows:
        vals = [float(r.days_diff) for r in mark_day_rows if r.days_diff is not None]
        avg_days_per_mark = round(sum(vals) / len(vals), 1) if vals else None

    avg_detail_result = await session.execute(
        select(
            (
                func.max(RelUserDel.completion_date) - func.min(RelUserDel.completion_date)
            ).label("days_diff")
        )
        .where(RelUserDel.rel_markadel_id.in_(rel_ids_subq))
        .group_by(RelUserDel.rel_markadel_id)
    )
    detail_day_rows = avg_detail_result.fetchall()
    avg_days_per_detail: Optional[float] = None
    if detail_day_rows:
        vals = [float(r.days_diff) for r in detail_day_rows if r.days_diff is not None]
        avg_days_per_detail = round(sum(vals) / len(vals), 1) if vals else None

    days_to_completion = None
    if order.status == "Завершен" and first_activity:
        days_to_completion = (last_activity - order.internal_create_date).days

    return TimeMetrics(
        order_created_date=order.internal_create_date,
        first_activity_date=first_activity,
        last_activity_date=last_activity,
        first_shipment_date=shipment_dates.s_min,
        last_shipment_date=shipment_dates.s_max,
        days_since_created=days_since_created,
        days_in_production=days_in_production,
        days_to_completion=days_to_completion,
        avg_days_per_mark=avg_days_per_mark,
        avg_days_per_detail=avg_days_per_detail,
    )


async def _build_progress_metrics(
    session: AsyncSession,
    kmd_uuids: list[UUID],
) -> ProgressMetrics:
    zero = Decimal("0")

    if not kmd_uuids:
        return ProgressMetrics(
            total_marks_uq=0, total_marks_qty=0,
            assembled_marks=0, shipped_marks=0,
            marks_assembly_pct=0.0, marks_shipment_pct=0.0,
            total_details=0, completed_details=0, details_completion_pct=0.0,
            total_kmd=0, completed_kmd=0, kmd_completion_pct=0.0,
            total_marks_weight=zero, shipped_marks_weight=zero, weight_shipment_pct=0.0,
        )

    def pct(a: float, b: float) -> float:
        return round(a / b * 100, 1) if b else 0.0

    # Три агрегирующих запроса параллельно
    marks_q = session.execute(
        select(
            func.count(Marks.id).label("total_uq"),
            func.coalesce(func.sum(Marks.quantity), 0).label("total_qty"),
            func.coalesce(func.sum(Marks.assembled_quantity), 0).label("assembled"),
            func.coalesce(func.sum(Marks.shipped_quantity), 0).label("shipped"),
            func.coalesce(func.sum(Marks.weight * Marks.quantity), zero).label("total_weight"),
            func.coalesce(func.sum(Marks.weight * Marks.shipped_quantity), zero).label("shipped_weight"),
        ).where(Marks.kmd_uuid.in_(kmd_uuids))
    )

    details_q = session.execute(
        select(
            func.count(RelMarkaDel.id).label("total"),
            func.count(RelMarkaDel.id).filter(
                RelMarkaDel.status == DetailsStatus.COMPLETED
            ).label("completed"),
        ).where(RelMarkaDel.kmd_uuid.in_(kmd_uuids))
    )

    kmd_q = session.execute(
        select(
            func.count(KMD.uuid).label("total"),
            func.count(KMD.uuid).filter(KMD.status == "Завершен").label("completed"),
        ).where(KMD.uuid.in_(kmd_uuids))
    )

    marks_res, details_res, kmd_res = await asyncio.gather(marks_q, details_q, kmd_q)

    m = marks_res.one()
    d = details_res.one()
    k = kmd_res.one()

    total_qty = int(m.total_qty)
    assembled = int(m.assembled)
    shipped = int(m.shipped)
    total_weight = m.total_weight or zero
    shipped_weight = m.shipped_weight or zero

    return ProgressMetrics(
        total_marks_uq=m.total_uq or 0,
        total_marks_qty=total_qty,
        assembled_marks=assembled,
        shipped_marks=shipped,
        marks_assembly_pct=pct(assembled, total_qty),
        marks_shipment_pct=pct(shipped, total_qty),
        total_details=d.total or 0,
        completed_details=d.completed or 0,
        details_completion_pct=pct(d.completed or 0, d.total or 0),
        total_kmd=k.total or 0,
        completed_kmd=k.completed or 0,
        kmd_completion_pct=pct(k.completed or 0, k.total or 0),
        total_marks_weight=total_weight,
        shipped_marks_weight=shipped_weight,
        weight_shipment_pct=pct(float(shipped_weight), float(total_weight)),
    )


async def _build_delivery_metrics(
    session: AsyncSession,
    kmd_uuids: list[UUID],
) -> DeliveryMetrics:
    if not kmd_uuids:
        zero = Decimal("0")
        return DeliveryMetrics(
            total_deliveries=0, total_delivery_items=0,
            total_delivery_weight=zero, allocated_weight=zero, remaining_weight=zero,
        )

    result = await session.execute(
        select(
            func.count(func.distinct(DeliveryItem.truck_id)).label("truck_count"),
            func.count(func.distinct(DeliveryItem.id)).label("item_count"),
            func.coalesce(func.sum(DeliveryItem.total_weight), 0).label("total_weight"),
            func.coalesce(func.sum(DeliveryItem.allocated_weight), 0).label("allocated_weight"),
        )
        .join(DeliveryAllocation, DeliveryAllocation.delivery_item_id == DeliveryItem.id)
        .where(DeliveryAllocation.kmd_uuid.in_(kmd_uuids))
    )
    row = result.one()

    total_w = row.total_weight or Decimal("0")
    alloc_w = row.allocated_weight or Decimal("0")

    return DeliveryMetrics(
        total_deliveries=row.truck_count or 0,
        total_delivery_items=row.item_count or 0,
        total_delivery_weight=total_w,
        allocated_weight=alloc_w,
        remaining_weight=total_w - alloc_w,
    )


async def _build_workload_metrics(
    session: AsyncSession,
    kmd_uuids: list[UUID],
) -> WorkloadMetrics:
    if not kmd_uuids:
        return WorkloadMetrics(
            total_workers=0, total_detail_operations=0,
            total_assembly_operations=0, total_shipment_operations=0,
            busiest_worker_name=None, busiest_worker_operations=None,
        )

    rel_ids_subq = (
        select(RelMarkaDel.id)
        .where(RelMarkaDel.kmd_uuid.in_(kmd_uuids))
        .scalar_subquery()
    )
    mark_ids_subq = (
        select(Marks.id)
        .where(Marks.kmd_uuid.in_(kmd_uuids))
        .scalar_subquery()
    )

    # Уникальные рабочие через UNION (два scalar_subquery → один запрос на счёт)
    workers_union = (
        select(RelUserDel.user_uuid)
        .where(RelUserDel.rel_markadel_id.in_(rel_ids_subq))
        .union(
            select(RelUserMark.user_uuid)
            .where(RelUserMark.mark_id.in_(mark_ids_subq))
        )
    ).subquery()

    workers_q = session.execute(select(func.count()).select_from(workers_union))

    det_ops_q = session.execute(
        select(func.count(RelUserDel.id))
        .where(RelUserDel.rel_markadel_id.in_(rel_ids_subq))
    )
    asm_ops_q = session.execute(
        select(func.count(RelUserMark.id))
        .where(RelUserMark.mark_id.in_(mark_ids_subq))
    )
    ship_ops_q = session.execute(
        select(func.count(MarkShipment.id))
        .where(MarkShipment.mark_id.in_(mark_ids_subq))
    )
    busiest_q = session.execute(
        select(
            Users.name,
            Users.lastname,
            func.sum(RelUserDel.quantity).label("total_qty"),
        )
        .join(Users, Users.uuid == RelUserDel.user_uuid)
        .where(RelUserDel.rel_markadel_id.in_(rel_ids_subq))
        .group_by(Users.uuid, Users.name, Users.lastname)
        .order_by(func.sum(RelUserDel.quantity).desc())
        .limit(1)
    )

    workers_res, det_res, asm_res, ship_res, busiest_res = await asyncio.gather(
        workers_q, det_ops_q, asm_ops_q, ship_ops_q, busiest_q
    )

    busiest = busiest_res.one_or_none()

    return WorkloadMetrics(
        total_workers=workers_res.scalar() or 0,
        total_detail_operations=det_res.scalar() or 0,
        total_assembly_operations=asm_res.scalar() or 0,
        total_shipment_operations=ship_res.scalar() or 0,
        busiest_worker_name=f"{busiest.name} {busiest.lastname}" if busiest else None,
        busiest_worker_operations=int(busiest.total_qty) if busiest else None,
    )


async def _build_kmd_breakdown(
    session: AsyncSession,
    kmd_uuids: list[UUID],
) -> list[KMDSummary]:
    if not kmd_uuids:
        return []

    result = await session.execute(
        select(KMD).where(KMD.uuid.in_(kmd_uuids))
    )
    kmds = result.scalars().all()

    return [
        KMDSummary(
            uuid=str(k.uuid),
            num_kmd=k.num_kmd,
            status=k.status,
            marks_total=k.count_marks,
            marks_completed=k.shipped_marks_count,
            marks_shipped=k.shipped_marks_count,
            marks_weight=k.marks_weight,
            shipped_weight=k.shipped_marks_weight,
        )
        for k in kmds
    ]

@router.get("/{order_uuid}/report", response_model=OrderReportResponse)
async def get_order_report(
    order_uuid: UUID,
    session: AsyncSession = Depends(get_async_session),
) -> OrderReportResponse:
    """
    Полный отчёт по заказу.

    Включает:
    - Временные метрики (даты, длительность, среднее время марки/детали)
    - Прогресс (% сборки, отгрузки, деталей, КМД, вес)
    - Поставки металла (распределение по КМД, остаток на складе)
    - Нагрузка на рабочих
    - Разбивка по каждому КМД
    """
    order = await _get_order_or_404(session, order_uuid)

    kmd_result = await session.execute(
        select(KMD.uuid).where(KMD.order_uuid == order_uuid)
    )
    kmd_uuids: list[UUID] = kmd_result.scalars().all()

    time_metrics, progress, delivery, workload, kmd_breakdown = await asyncio.gather(
        _build_time_metrics(session, order, kmd_uuids),
        _build_progress_metrics(session, kmd_uuids),
        _build_delivery_metrics(session, kmd_uuids),
        _build_workload_metrics(session, kmd_uuids),
        _build_kmd_breakdown(session, kmd_uuids),
    )

    return OrderReportResponse(
        order_uuid=str(order.uuid),
        order_name=order.name,
        internal_num_orders=order.internal_num_orders,
        order_status=order.status,
        is_active=order.is_active,
        time=time_metrics,
        progress=progress,
        delivery=delivery,
        workload=workload,
        kmd_breakdown=kmd_breakdown,
    )