from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.connection import get_async_session
from src.models.delivery import DeliveryTruck, DeliveryItem, DeliveryAllocation
from src.models.KMD import KMD
from src.models.orders import Orders
from src.models.rel_markadet import RelMarkaDel
from src.models.details import Details

router = APIRouter(tags=["delivery"])

_Q3 = Decimal('0.001')
_Q1 = Decimal('0.1')


def _d(value) -> Decimal:
    """Безопасное приведение к Decimal с 3 знаками."""
    return Decimal(str(value)).quantize(_Q3, rounding=ROUND_HALF_UP)


# ============================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================================

async def _get_stock(
        session: AsyncSession,
        profile_type: str | None = None,
        profile_size: str | None = None,
        steel_grade: str | None = None,
) -> dict[tuple[str, str, str], dict]:
    """
    Возвращает складские остатки, сгруппированные по (type, size, steel).

    {
        (type, size, steel): {
            'stock_weight': Decimal,
            'stock_quantity': Decimal,
            'unit_weight': Decimal,   ← вес штуки последней найденной позиции
        }
    }

    Количество — производная от веса, не хранится отдельно.
    При разных unit_weight у одного профиля (например, партии разных длин)
    group_unit_weight будет от последней позиции; для показа это приемлемо,
    для детального расчёта используйте отдельные позиции.
    """
    stmt = (
        select(DeliveryItem)
        .where(DeliveryItem.total_weight > DeliveryItem.allocated_weight)
    )
    if profile_type:
        stmt = stmt.where(DeliveryItem.profile_type == profile_type)
    if profile_size:
        stmt = stmt.where(DeliveryItem.profile_size == profile_size)
    if steel_grade:
        stmt = stmt.where(DeliveryItem.steel_grade == steel_grade)

    items = (await session.execute(stmt)).scalars().all()

    result: dict[tuple, dict] = {}
    for item in items:
        remaining = item.remaining_weight
        if remaining <= 0:
            continue

        key = (item.profile_type, item.profile_size, item.steel_grade)
        if key not in result:
            result[key] = {
                'stock_weight': Decimal('0'),
                'unit_weight': item.unit_weight,
            }
        result[key]['stock_weight'] += remaining

    for data in result.values():
        unit_w = data['unit_weight']
        data['stock_quantity'] = (
            (data['stock_weight'] / unit_w).quantize(_Q3)
            if unit_w > 0 else Decimal('0')
        )

    return result


async def _validate_kmd_capacity(
        checks: list[tuple[str, str, str, str, Decimal]],
        session: AsyncSession,
        exclude_item_id: int | None = None,
) -> None:
    """
    Проверяет, что новые аллокации не превышают дефицит КМД.

    checks: [(kmd_uuid, profile_type, profile_size, steel_grade, weight), ...]
    exclude_item_id: при обновлении аллокации передать id позиции, чтобы
                     её текущие аллокации не считались как "уже занятые".
    """
    kmd_uuids = list({c[0] for c in checks})

    # Плановый вес по каждому КМД
    plan_rows = (await session.execute(
        select(
            KMD.uuid.label('kmd_uuid'),
            Details.type,
            Details.size,
            Details.steel_grade,
            func.sum(Details.weight * RelMarkaDel.details_quantity).label('plan_weight'),
        )
        .select_from(RelMarkaDel)
        .join(Details, Details.id == RelMarkaDel.details_id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .where(RelMarkaDel.kmd_uuid.in_(kmd_uuids))
        .group_by(KMD.uuid, Details.type, Details.size, Details.steel_grade)
    )).all()

    plan_map: dict[tuple, Decimal] = {
        (str(r.kmd_uuid), r.type, r.size, r.steel_grade): _d(r.plan_weight)
        for r in plan_rows
    }

    # Уже распределено в эти КМД
    alloc_stmt = (
        select(
            DeliveryAllocation.kmd_uuid,
            DeliveryItem.profile_type,
            DeliveryItem.profile_size,
            DeliveryItem.steel_grade,
            func.sum(DeliveryAllocation.allocated_weight).label('allocated'),
        )
        .join(DeliveryItem, DeliveryItem.id == DeliveryAllocation.delivery_item_id)
        .where(DeliveryAllocation.kmd_uuid.in_(kmd_uuids))
    )
    if exclude_item_id is not None:
        alloc_stmt = alloc_stmt.where(DeliveryAllocation.delivery_item_id != exclude_item_id)

    alloc_stmt = alloc_stmt.group_by(
        DeliveryAllocation.kmd_uuid,
        DeliveryItem.profile_type,
        DeliveryItem.profile_size,
        DeliveryItem.steel_grade,
    )

    alloc_rows = (await session.execute(alloc_stmt)).all()
    alloc_map: dict[tuple, Decimal] = {
        (str(r.kmd_uuid), r.profile_type, r.profile_size, r.steel_grade): _d(r.allocated)
        for r in alloc_rows
    }

    TOLERANCE = Decimal('0.005')  # 5 граммов — на погрешности округления

    for kmd_uuid, profile_type, profile_size, steel_grade, new_weight in checks:
        key = (kmd_uuid, profile_type, profile_size, steel_grade)
        plan = plan_map.get(key, Decimal('0'))
        already = alloc_map.get(key, Decimal('0'))
        available = (plan - already).quantize(_Q3)

        if new_weight > available + TOLERANCE:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"КМД {kmd_uuid}: {profile_type} {profile_size} {steel_grade} — "
                    f"нельзя распределить {new_weight} кг. "
                    f"По плану: {plan.quantize(_Q1)} кг, "
                    f"уже распределено: {already.quantize(_Q1)} кг, "
                    f"доступно: {available.quantize(_Q1)} кг"
                )
            )


# ============================================================
# PYDANTIC СХЕМЫ
# ============================================================

class AllocationInput(BaseModel):
    kmd_uuid: str
    allocated_weight: float = Field(..., gt=0)


class DeliveryItemInput(BaseModel):
    profile_type: str
    profile_size: str
    steel_grade: str
    total_weight: float = Field(..., gt=0, description="Общий вес в кг")
    total_quantity: float = Field(..., gt=0, description="Количество штук по документам (справочно)")
    unit_weight: float | None = Field(
        None,
        description="Вес одной штуки в кг. Если не указан — вычисляется как total_weight / total_quantity"
    )
    allocations: list[AllocationInput] = Field(default_factory=list)

    @model_validator(mode='after')
    def resolve_unit_weight_and_validate_allocations(self) -> 'DeliveryItemInput':
        # Вес одной штуки: явный приоритет над вычисленным
        if self.unit_weight is None:
            self.unit_weight = round(self.total_weight / self.total_quantity, 3)

        # Аллокации не должны превышать total_weight
        total_alloc = sum(a.allocated_weight for a in self.allocations)
        if total_alloc > self.total_weight + 0.005:
            raise ValueError(
                f"{self.profile_type} {self.profile_size} {self.steel_grade}: "
                f"сумма аллокаций ({total_alloc} кг) превышает общий вес ({self.total_weight} кг)"
            )
        return self


class TruckCreateRequest(BaseModel):
    name: str = Field(..., max_length=255)
    delivery_date: date
    note: str | None = None
    items: list[DeliveryItemInput] = Field(..., min_length=1)


class AllocationRead(BaseModel):
    kmd_uuid: str
    kmd_num: str
    allocated_weight: float


class DeliveryItemRead(BaseModel):
    id: int
    profile_type: str
    profile_size: str
    steel_grade: str
    total_weight: float
    total_quantity: float       # справочно
    unit_weight: float
    allocated_weight: float
    remaining_weight: float
    remaining_quantity: float   # производная от remaining_weight / unit_weight
    allocations: list[AllocationRead] = []


class TruckRead(BaseModel):
    id: int
    name: str
    delivery_date: date
    note: str | None
    items_count: int = 0


class TruckDetailRead(TruckRead):
    items: list[DeliveryItemRead] = []


class StockItem(BaseModel):
    profile_type: str
    profile_size: str
    steel_grade: str
    stock_weight: float
    stock_quantity: float
    unit_weight: float


class CheckKmdItem(BaseModel):
    kmd_uuid: str
    kmd_num: str
    plan_weight: float
    allocated_weight: float
    deficit: float
    covered_by_stock: float
    real_deficit: float


class CheckResponse(BaseModel):
    profile_type: str
    profile_size: str
    steel_grade: str
    stock_weight: float
    stock_quantity: float
    unit_weight: float
    orders: list[CheckKmdItem]


class StockAllocateRequest(BaseModel):
    profile_type: str
    profile_size: str
    steel_grade: str
    kmd_uuid: str
    weight: float = Field(..., gt=0, description="Сколько кг взять со склада")


# ============================================================
# ХЕЛПЕР: сборка DeliveryItemRead из ORM-объекта
# ============================================================

def _item_to_read(item: DeliveryItem, alloc_kmd_map: dict[str, str] | None = None) -> DeliveryItemRead:
    """
    alloc_kmd_map: {kmd_uuid_str: num_kmd} — чтобы не делать N+1 запросов.
    Если None — берём из уже загруженных item.allocations[i].kmd (lazy должен быть уже загружен).
    """
    remaining_weight = item.remaining_weight
    unit_w = item.unit_weight

    return DeliveryItemRead(
        id=item.id,
        profile_type=item.profile_type,
        profile_size=item.profile_size,
        steel_grade=item.steel_grade,
        total_weight=float(item.total_weight),
        total_quantity=float(item.total_quantity),
        unit_weight=float(unit_w),
        allocated_weight=float(item.allocated_weight),
        remaining_weight=float(remaining_weight),
        remaining_quantity=float(item.remaining_quantity),
        allocations=[
            AllocationRead(
                kmd_uuid=str(a.kmd_uuid),
                kmd_num=(
                    alloc_kmd_map.get(str(a.kmd_uuid), '—')
                    if alloc_kmd_map is not None
                    else (a.kmd.num_kmd if a.kmd else '—')
                ),
                allocated_weight=float(a.allocated_weight),
            )
            for a in item.allocations
        ],
    )


# ============================================================
# СПРАВОЧНЫЕ РОУТЫ
# ============================================================

@router.get("/profile/types", response_model=list[str], summary="Все типы профилей из активных заказов")
async def get_profile_types(
        search: str | None = Query(None),
        session: AsyncSession = Depends(get_async_session),
):
    stmt = (
        select(Details.type).distinct()
        .join(RelMarkaDel, RelMarkaDel.details_id == Details.id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .join(Orders, Orders.uuid == KMD.order_uuid)
        .where(Orders.is_active == True)
        .order_by(Details.type)
    )
    if search:
        stmt = stmt.where(Details.type.ilike(f"%{search}%"))
    return (await session.execute(stmt)).scalars().all()


@router.get("/profile/sizes", response_model=list[str], summary="Размеры профиля по типу")
async def get_profile_sizes(
        type: str = Query(...),
        search: str | None = Query(None),
        session: AsyncSession = Depends(get_async_session),
):
    stmt = (
        select(Details.size).distinct()
        .join(RelMarkaDel, RelMarkaDel.details_id == Details.id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .join(Orders, Orders.uuid == KMD.order_uuid)
        .where(and_(Orders.is_active == True, Details.type == type))
        .order_by(Details.size)
    )
    if search:
        stmt = stmt.where(Details.size.ilike(f"{search}%"))
    return (await session.execute(stmt)).scalars().all()


@router.get("/profile/steels", response_model=list[str], summary="Марки стали по типу и размеру")
async def get_profile_steels(
        type: str = Query(...),
        size: str = Query(...),
        session: AsyncSession = Depends(get_async_session),
):
    stmt = (
        select(Details.steel_grade).distinct()
        .join(RelMarkaDel, RelMarkaDel.details_id == Details.id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .join(Orders, Orders.uuid == KMD.order_uuid)
        .where(and_(Orders.is_active == True, Details.type == type, Details.size == size))
        .order_by(Details.steel_grade)
    )
    rows = (await session.execute(stmt)).scalars().all()
    if not rows:
        raise HTTPException(404, detail=f"Профиль '{type} {size}' не найден в активных заказах")
    return rows


# ============================================================
# ОСНОВНЫЕ РОУТЫ
# ============================================================

@router.get("/check", response_model=CheckResponse, summary="В каких заказах нужен металл + складской остаток")
async def check_metal(
        profile_type: str = Query(...),
        profile_size: str = Query(...),
        steel_grade: str = Query(...),
        session: AsyncSession = Depends(get_async_session),
):
    plan_rows = (await session.execute(
        select(
            KMD.uuid.label('kmd_uuid'),
            KMD.num_kmd,
            func.sum(Details.weight * RelMarkaDel.details_quantity).label('plan_weight'),
        )
        .select_from(RelMarkaDel)
        .join(Details, Details.id == RelMarkaDel.details_id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .join(Orders, Orders.uuid == KMD.order_uuid)
        .where(and_(
            Orders.is_active == True,
            Details.type == profile_type,
            Details.size == profile_size,
            Details.steel_grade == steel_grade,
        ))
        .group_by(KMD.uuid, KMD.num_kmd)
        .order_by(KMD.num_kmd)
    )).all()

    kmd_uuids = [str(r.kmd_uuid) for r in plan_rows]
    allocated_map: dict[str, Decimal] = {}
    if kmd_uuids:
        alloc_rows = (await session.execute(
            select(
                DeliveryAllocation.kmd_uuid,
                func.sum(DeliveryAllocation.allocated_weight).label('allocated'),
            )
            .join(DeliveryItem, DeliveryItem.id == DeliveryAllocation.delivery_item_id)
            .where(and_(
                DeliveryAllocation.kmd_uuid.in_(kmd_uuids),
                DeliveryItem.profile_type == profile_type,
                DeliveryItem.profile_size == profile_size,
                DeliveryItem.steel_grade == steel_grade,
            ))
            .group_by(DeliveryAllocation.kmd_uuid)
        )).all()
        allocated_map = {str(r.kmd_uuid): _d(r.allocated) for r in alloc_rows}

    stock_map = await _get_stock(session, profile_type, profile_size, steel_grade)
    key = (profile_type, profile_size, steel_grade)
    stock_data = stock_map.get(key, {})
    stock_weight = stock_data.get('stock_weight', Decimal('0'))
    stock_quantity = stock_data.get('stock_quantity', Decimal('0'))
    unit_weight = stock_data.get('unit_weight', Decimal('0'))

    remaining_stock = stock_weight
    orders_result = []
    for r in plan_rows:
        plan = _d(r.plan_weight)
        allocated = allocated_map.get(str(r.kmd_uuid), Decimal('0'))
        deficit = (plan - allocated).quantize(_Q1)

        covered = min(max(deficit, Decimal('0')), remaining_stock).quantize(_Q1)
        remaining_stock = (remaining_stock - covered).quantize(_Q1)

        orders_result.append(CheckKmdItem(
            kmd_uuid=str(r.kmd_uuid),
            kmd_num=r.num_kmd,
            plan_weight=float(plan),
            allocated_weight=float(allocated),
            deficit=float(deficit),
            covered_by_stock=float(covered),
            real_deficit=float(max(deficit - covered, Decimal('0')).quantize(_Q1)),
        ))

    return CheckResponse(
        profile_type=profile_type,
        profile_size=profile_size,
        steel_grade=steel_grade,
        stock_weight=float(stock_weight),
        stock_quantity=float(stock_quantity),
        unit_weight=float(unit_weight),
        orders=[o for o in orders_result if o.deficit > 0],
    )


@router.get("/stock", response_model=list[StockItem], summary="Весь складской остаток")
async def get_stock(
        profile_type: str | None = Query(None),
        profile_size: str | None = Query(None),
        steel_grade: str | None = Query(None),
        session: AsyncSession = Depends(get_async_session),
):
    stock_map = await _get_stock(session, profile_type, profile_size, steel_grade)
    return [
        StockItem(
            profile_type=k[0],
            profile_size=k[1],
            steel_grade=k[2],
            stock_weight=float(v['stock_weight']),
            stock_quantity=float(v['stock_quantity']),
            unit_weight=float(v['unit_weight']),
        )
        for k, v in sorted(stock_map.items())
    ]


@router.post("/stock/allocate", response_model=dict, status_code=status.HTTP_201_CREATED,
             summary="Распределить складской остаток в КМД")
async def allocate_from_stock(
        body: StockAllocateRequest,
        session: AsyncSession = Depends(get_async_session),
):
    """
    Берёт металл со склада и распределяет в КМД.
    Учёт только по весу. FIFO по id позиции.
    После каждого изменения аллокации — recalculate_allocated_weight().
    """
    kmd = await session.get(KMD, body.kmd_uuid)
    if not kmd:
        raise HTTPException(404, detail="КМД не найден")

    weight = _d(body.weight)

    await _validate_kmd_capacity(
        [(body.kmd_uuid, body.profile_type, body.profile_size, body.steel_grade, weight)],
        session,
    )

    items_with_stock = (await session.execute(
        select(DeliveryItem)
        .where(and_(
            DeliveryItem.profile_type == body.profile_type,
            DeliveryItem.profile_size == body.profile_size,
            DeliveryItem.steel_grade == body.steel_grade,
            DeliveryItem.total_weight > DeliveryItem.allocated_weight,
        ))
        .options(selectinload(DeliveryItem.allocations))
        .order_by(DeliveryItem.id.asc())
        .with_for_update()   # блокируем строки на время транзакции
    )).scalars().all()

    total_stock = sum(i.remaining_weight for i in items_with_stock)
    if total_stock < weight:
        raise HTTPException(400, detail=f"Недостаточно на складе. Доступно: {total_stock.quantize(_Q1)} кг")

    remaining_to_allocate = weight
    allocated_entries = []

    for item in items_with_stock:
        if remaining_to_allocate <= 0:
            break

        take = min(item.remaining_weight, remaining_to_allocate).quantize(_Q3)

        existing = next(
            (a for a in item.allocations if str(a.kmd_uuid) == body.kmd_uuid),
            None
        )
        if existing:
            existing.allocated_weight += take
        else:
            item.allocations.append(DeliveryAllocation(
                delivery_item_id=item.id,
                kmd_uuid=body.kmd_uuid,
                allocated_weight=take,
            ))

        await session.flush()
        # Пересчёт денормализованного кеша — единственное место где он обновляется
        item.recalculate_allocated_weight()

        remaining_to_allocate = (remaining_to_allocate - take).quantize(_Q3)
        allocated_entries.append({"delivery_item_id": item.id, "taken": float(take)})

    await session.commit()

    return {
        "kmd_uuid": body.kmd_uuid,
        "kmd_num": kmd.num_kmd,
        "profile": f"{body.profile_type} {body.profile_size}",
        "steel_grade": body.steel_grade,
        "allocated_weight": float(weight),
        "stock_remaining": float((total_stock - weight).quantize(_Q1)),
        "sources": allocated_entries,
    }


@router.post("/trucks", response_model=TruckDetailRead, status_code=status.HTTP_201_CREATED,
             summary="Создать поставку")
async def create_truck(
        body: TruckCreateRequest,
        session: AsyncSession = Depends(get_async_session),
):
    # 1. Собираем все KMD UUID из запроса и проверяем существование одним запросом
    all_kmd_uuids = {a.kmd_uuid for item in body.items for a in item.allocations}
    kmd_map: dict[str, KMD] = {}
    if all_kmd_uuids:
        kmds = (await session.execute(
            select(KMD).where(KMD.uuid.in_(list(all_kmd_uuids)))
        )).scalars().all()
        kmd_map = {str(k.uuid): k for k in kmds}

        missing = all_kmd_uuids - kmd_map.keys()
        if missing:
            raise HTTPException(400, detail=f"КМД не найдены: {', '.join(missing)}")

    # 2. Валидация дефицита КМД (Pydantic уже проверил item.total_weight >= sum(allocations))
    checks = [
        (a.kmd_uuid, item.profile_type, item.profile_size, item.steel_grade, _d(a.allocated_weight))
        for item in body.items
        for a in item.allocations
    ]
    if checks:
        await _validate_kmd_capacity(checks, session)

    # 3. Создаём поставку
    truck = DeliveryTruck(name=body.name, delivery_date=body.delivery_date, note=body.note)
    session.add(truck)
    await session.flush()

    result_items = []
    for item_data in body.items:
        total_alloc = _d(sum(a.allocated_weight for a in item_data.allocations))

        db_item = DeliveryItem(
            truck_id=truck.id,
            profile_type=item_data.profile_type,
            profile_size=item_data.profile_size,
            steel_grade=item_data.steel_grade,
            total_weight=_d(item_data.total_weight),
            total_quantity=_d(item_data.total_quantity),
            unit_weight=_d(item_data.unit_weight),
            allocated_weight=total_alloc,  # сразу правильное значение
        )
        session.add(db_item)
        await session.flush()

        for alloc_data in item_data.allocations:
            session.add(DeliveryAllocation(
                delivery_item_id=db_item.id,
                kmd_uuid=alloc_data.kmd_uuid,
                allocated_weight=_d(alloc_data.allocated_weight),
            ))

        # Загружаем аллокации чтобы _item_to_read мог их сериализовать
        await session.flush()
        await session.refresh(db_item, ['allocations'])

        result_items.append(_item_to_read(db_item, alloc_kmd_map={
            uuid: k.num_kmd for uuid, k in kmd_map.items()
        }))

    await session.commit()

    return TruckDetailRead(
        id=truck.id,
        name=truck.name,
        delivery_date=truck.delivery_date,
        note=truck.note,
        items_count=len(result_items),
        items=result_items,
    )


@router.get("/trucks", response_model=dict, summary="Список поставок")
async def get_trucks(
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        session: AsyncSession = Depends(get_async_session),
):
    total = (await session.execute(
        select(func.count()).select_from(DeliveryTruck)
    )).scalar_one()

    trucks = (await session.execute(
        select(DeliveryTruck)
        .order_by(DeliveryTruck.delivery_date.desc(), DeliveryTruck.id.desc())
        .offset((page - 1) * limit).limit(limit)
    )).scalars().all()

    counts: dict[int, int] = {}
    if trucks:
        counts_raw = (await session.execute(
            select(DeliveryItem.truck_id, func.count(DeliveryItem.id))
            .where(DeliveryItem.truck_id.in_([t.id for t in trucks]))
            .group_by(DeliveryItem.truck_id)
        )).all()
        counts = {row[0]: row[1] for row in counts_raw}

    total_pages = ceil(total / limit) if total else 1
    return {
        "trucks": [
            TruckRead(id=t.id, name=t.name, delivery_date=t.delivery_date,
                      note=t.note, items_count=counts.get(t.id, 0))
            for t in trucks
        ],
        "pagination": {
            "page": page, "limit": limit,
            "total_items": total, "total_pages": total_pages,
            "has_more": page < total_pages, "has_previous": page > 1,
            "next_page": page + 1 if page < total_pages else None,
            "previous_page": page - 1 if page > 1 else None,
        },
    }


@router.get("/trucks/{truck_id}", response_model=TruckDetailRead, summary="Поставка с позициями")
async def get_truck(
        truck_id: int,
        session: AsyncSession = Depends(get_async_session),
):
    truck = (await session.execute(
        select(DeliveryTruck)
        .where(DeliveryTruck.id == truck_id)
        .options(
            selectinload(DeliveryTruck.items)
            .selectinload(DeliveryItem.allocations)
            .selectinload(DeliveryAllocation.kmd)
        )
    )).scalar_one_or_none()

    if not truck:
        raise HTTPException(404, detail="Поставка не найдена")

    return TruckDetailRead(
        id=truck.id,
        name=truck.name,
        delivery_date=truck.delivery_date,
        note=truck.note,
        items_count=len(truck.items),
        items=[_item_to_read(item) for item in truck.items],
    )