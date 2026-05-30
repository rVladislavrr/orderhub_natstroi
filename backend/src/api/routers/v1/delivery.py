from datetime import date
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
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


@router.get(
    "/profile/types",
    response_model=list[str],
    summary="Все типы профилей из активных заказов",
)
async def get_profile_types(
    search: str | None = Query(None, description="Поиск по вхождению: 'Швел' → ['Швеллер']"),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = (
        select(Details.type)
        .distinct()
        .join(RelMarkaDel, RelMarkaDel.details_id == Details.id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .join(Orders, Orders.uuid == KMD.order_uuid)
        .where(Orders.is_active == True)  # noqa
        .order_by(Details.type)
    )
    if search:
        stmt = stmt.where(Details.type.ilike(f"%{search}%"))

    rows = (await session.execute(stmt)).scalars().all()
    return rows


@router.get(
    "/profile/sizes",
    response_model=list[str],
    summary="Размеры профиля по типу",
)
async def get_profile_sizes(
    type: str = Query(..., description="Тип профиля: 'Швеллер'"),
    search: str | None = Query(None, description="Поиск по вхождению: '12' → ['12П', '120']"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Шаг 2 — выбрал тип 'Швеллер', получает ['10П', '12П', '16П', ...].
    """
    stmt = (
        select(Details.size)
        .distinct()
        .join(RelMarkaDel, RelMarkaDel.details_id == Details.id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .join(Orders, Orders.uuid == KMD.order_uuid)
        .where(and_(
            Orders.is_active == True,  # noqa
            Details.type == type,
        ))
        .order_by(Details.size)
    )
    if search:
        stmt = stmt.where(Details.size.ilike(f"{search}%"))

    rows = (await session.execute(stmt)).scalars().all()
    return rows


@router.get(
    "/profile/steels",
    response_model=list[str],
    summary="Марки стали по типу и размеру",
)
async def get_profile_steels(
    type: str = Query(..., description="Тип профиля: 'Швеллер'"),
    size: str = Query(..., description="Размер: '12П'"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Шаг 3 — выбрал тип + размер, получает ['C245-4', 'C345-5'].
    После этого можно делать запрос на /delivery/check.
    """
    stmt = (
        select(Details.steel_grade)
        .distinct()
        .join(RelMarkaDel, RelMarkaDel.details_id == Details.id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .join(Orders, Orders.uuid == KMD.order_uuid)
        .where(and_(
            Orders.is_active == True,  # noqa
            Details.type == type,
            Details.size == size,
        ))
        .order_by(Details.steel_grade)
    )
    rows = (await session.execute(stmt)).scalars().all()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Профиль '{type} {size}' не найден в активных заказах"
        )

    return rows

class StockItem(BaseModel):
    profile_type: str
    profile_size: str
    steel_grade: str
    stock_weight: float          # суммарный остаток по всем поставкам


class CheckKmdItem(BaseModel):
    kmd_uuid: str
    kmd_num: str
    plan_weight: float           # нужно по плану
    allocated_weight: float      # уже распределено из поставок
    deficit: float               # plan - allocated (без учёта склада)
    covered_by_stock: float      # сколько дефицита закрывает склад
    real_deficit: float          # deficit - covered_by_stock (реальная потребность)


class CheckResponse(BaseModel):
    profile_type: str
    profile_size: str
    steel_grade: str
    stock_weight: float          # сколько есть на складе прямо сейчас
    orders: list[CheckKmdItem]


class AllocationInput(BaseModel):
    kmd_uuid: str
    allocated_weight: float = Field(..., gt=0)


class DeliveryItemInput(BaseModel):
    profile_type: str
    profile_size: str
    steel_grade: str
    total_weight: float = Field(..., gt=0)
    allocations: list[AllocationInput] = Field(default_factory=list)


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
    allocated_weight: float
    remaining_weight: float      # складской остаток этой позиции
    allocations: list[AllocationRead] = []


class TruckRead(BaseModel):
    id: int
    name: str
    delivery_date: date
    note: str | None
    items_count: int = 0


class TruckDetailRead(TruckRead):
    items: list[DeliveryItemRead] = []


class StockAllocateRequest(BaseModel):
    """Распределить складской остаток в КМД без создания новой поставки."""
    profile_type: str
    profile_size: str
    steel_grade: str
    kmd_uuid: str
    weight: float = Field(..., gt=0, description="Сколько кг взять со склада")

async def _get_stock(
        session: AsyncSession,
        profile_type: str | None = None,
        profile_size: str | None = None,
        steel_grade: str | None = None,
) -> dict[tuple[str, str, str], float]:
    stmt = (
        select(
            DeliveryItem.profile_type,
            DeliveryItem.profile_size,
            DeliveryItem.steel_grade,
            func.sum(
                DeliveryItem.total_weight - DeliveryItem.allocated_weight
            ).label('stock'),
        )
        .group_by(
            DeliveryItem.profile_type,
            DeliveryItem.profile_size,
            DeliveryItem.steel_grade,
        )
        .having(
            func.sum(DeliveryItem.total_weight - DeliveryItem.allocated_weight) > 0
        )
    )
    if profile_type:
        stmt = stmt.where(DeliveryItem.profile_type == profile_type)
    if profile_size:
        stmt = stmt.where(DeliveryItem.profile_size == profile_size)
    if steel_grade:
        stmt = stmt.where(DeliveryItem.steel_grade == steel_grade)

    rows = (await session.execute(stmt)).all()
    return {
        (r.profile_type, r.profile_size, r.steel_grade): round(float(r.stock), 3)
        for r in rows
    }

@router.get(
    "/check",
    response_model=CheckResponse,
    summary="В каких заказах нужен этот металл + складской остаток",
)
async def check_metal(
    profile_type: str = Query(...),
    profile_size: str = Query(...),
    steel_grade: str = Query(...),
    session: AsyncSession = Depends(get_async_session),
):
    # 1. Плановый вес по каждому КМД
    plan_rows = (await session.execute(
        select(
            Orders.uuid.label('order_uuid'),
            Orders.name.label('order_name'),
            Orders.internal_num_orders,
            KMD.uuid.label('kmd_uuid'),
            KMD.num_kmd,
            func.sum(
                Details.weight * RelMarkaDel.details_quantity
            ).label('plan_weight'),
        )
        .select_from(RelMarkaDel)
        .join(Details, Details.id == RelMarkaDel.details_id)
        .join(KMD, KMD.uuid == RelMarkaDel.kmd_uuid)
        .join(Orders, Orders.uuid == KMD.order_uuid)
        .where(and_(
            Orders.is_active == True,  # noqa
            Details.type == profile_type,
            Details.size == profile_size,
            Details.steel_grade == steel_grade,
        ))
        .group_by(
            Orders.uuid, Orders.name, Orders.internal_num_orders,
            KMD.uuid, KMD.num_kmd,
        )
        .order_by(Orders.internal_num_orders, KMD.num_kmd)
    )).all()

    # 2. Уже распределено в каждый КМД
    kmd_uuids = [r.kmd_uuid for r in plan_rows]
    allocated_map: dict[str, float] = {}
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
        allocated_map = {str(r.kmd_uuid): float(r.allocated) for r in alloc_rows}

    stock_map = await _get_stock(session, profile_type, profile_size, steel_grade)
    stock_weight = stock_map.get((profile_type, profile_size, steel_grade), 0.0)

    remaining_stock = stock_weight
    orders_result = []
    for r in plan_rows:
        plan = round(float(r.plan_weight), 1)
        allocated = round(allocated_map.get(str(r.kmd_uuid), 0.0), 1)
        deficit = round(plan - allocated, 1)

        # сколько из склада покрывает этот дефицит
        covered = round(min(max(deficit, 0.0), remaining_stock), 1)
        remaining_stock = round(remaining_stock - covered, 1)

        orders_result.append(CheckKmdItem(
            kmd_uuid=str(r.kmd_uuid),
            kmd_num=r.num_kmd,
            plan_weight=plan,
            allocated_weight=allocated,
            deficit=deficit,
            covered_by_stock=covered,
            real_deficit=round(max(deficit - covered, 0.0), 1),
        ))

    orders_with_deficit = [o for o in orders_result if o.deficit > 0]

    return CheckResponse(
        profile_type=profile_type,
        profile_size=profile_size,
        steel_grade=steel_grade,
        stock_weight=stock_weight,
        orders=orders_with_deficit,
    )


@router.get(
    "/stock",
    response_model=list[StockItem],
    summary="Весь складской остаток",
)
async def get_stock(
    profile_type: str | None = Query(None),
    profile_size: str | None = Query(None),
    steel_grade: str | None = Query(None),
    session: AsyncSession = Depends(get_async_session),
):
    """Показывает что лежит на складе (остатки из всех поставок)."""
    stock_map = await _get_stock(session, profile_type, profile_size, steel_grade)
    return [
        StockItem(
            profile_type=k[0],
            profile_size=k[1],
            steel_grade=k[2],
            stock_weight=v,
        )
        for k, v in sorted(stock_map.items())
    ]

@router.post(
    "/stock/allocate",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Распределить складской остаток в КМД",
)
async def allocate_from_stock(
    body: StockAllocateRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Берёт металл со склада (из остатков существующих поставок) и
    распределяет в указанный КМД. Списывает с позиций поставок
    в порядке FIFO (сначала старые поставки).
    """
    kmd = await session.get(KMD, body.kmd_uuid)
    if not kmd:
        raise HTTPException(status_code=404, detail="КМД не найден")

    # Проверяем что не превышаем дефицит КМД
    await _validate_kmd_capacity(
        [(body.kmd_uuid, body.profile_type, body.profile_size, body.steel_grade, body.weight)],
        session,
    )

    # Находим позиции с остатком — FIFO по id (старые сначала)
    items_with_stock = (await session.execute(
        select(DeliveryItem)
        .where(and_(
            DeliveryItem.profile_type == body.profile_type,
            DeliveryItem.profile_size == body.profile_size,
            DeliveryItem.steel_grade == body.steel_grade,
            DeliveryItem.total_weight > DeliveryItem.allocated_weight,
        ))
        .order_by(DeliveryItem.id.asc())
    )).scalars().all()

    total_stock = sum(i.remaining_weight for i in items_with_stock)
    if total_stock < body.weight:
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно на складе. Доступно: {round(total_stock, 1)} кг"
        )

    # Списываем FIFO
    remaining_to_allocate = body.weight
    allocated_entries = []

    for item in items_with_stock:
        if remaining_to_allocate <= 0:
            break

        take = min(item.remaining_weight, remaining_to_allocate)

        # Обновляем или создаём allocation
        existing = (await session.execute(
            select(DeliveryAllocation).where(and_(
                DeliveryAllocation.delivery_item_id == item.id,
                DeliveryAllocation.kmd_uuid == body.kmd_uuid,
            ))
        )).scalar_one_or_none()

        if existing:
            existing.allocated_weight = float(existing.allocated_weight) + take
        else:
            new_alloc = DeliveryAllocation(
                delivery_item_id=item.id,
                kmd_uuid=body.kmd_uuid,
                allocated_weight=take,
            )
            session.add(new_alloc)

        item.allocated_weight = float(item.allocated_weight) + take
        remaining_to_allocate = round(remaining_to_allocate - take, 3)
        allocated_entries.append({"delivery_item_id": item.id, "taken": take})

    await session.commit()

    return {
        "kmd_uuid": body.kmd_uuid,
        "kmd_num": kmd.num_kmd,
        "profile": f"{body.profile_type} {body.profile_size}",
        "steel_grade": body.steel_grade,
        "allocated_weight": body.weight,
        "stock_remaining": round(total_stock - body.weight, 1),
        "sources": allocated_entries,
    }


# ---------------------------------------------------------------------------
# Вспомогательная функция: проверка что распределение не превышает дефицит КМД
# ---------------------------------------------------------------------------

async def _validate_kmd_capacity(
        checks: list[tuple],
        session: AsyncSession,
) -> None:
    """
    checks: список (kmd_uuid, profile_type, profile_size, steel_grade, new_weight)

    Для каждой пары (kmd_uuid, профиль) считает:
      plan_weight       — сколько нужно по плану
      already_allocated — сколько уже распределено из поставок
      available         — plan_weight - already_allocated

    Если new_weight > available → HTTPException 400.
    """
    # Группируем по (kmd_uuid, profile_type, profile_size, steel_grade)
    # чтобы один запрос покрыл все проверки
    kmd_uuids = list({c[0] for c in checks})
    profile_combos = list({(c[1], c[2], c[3]) for c in checks})

    # plan_weight по каждой паре (kmd_uuid, тип, размер, сталь)
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

    plan_map: dict[tuple, float] = {
        (str(r.kmd_uuid), r.type, r.size, r.steel_grade): float(r.plan_weight)
        for r in plan_rows
    }

    # уже распределено
    alloc_rows = (await session.execute(
        select(
            DeliveryAllocation.kmd_uuid,
            DeliveryItem.profile_type,
            DeliveryItem.profile_size,
            DeliveryItem.steel_grade,
            func.sum(DeliveryAllocation.allocated_weight).label('allocated'),
        )
        .join(DeliveryItem, DeliveryItem.id == DeliveryAllocation.delivery_item_id)
        .where(DeliveryAllocation.kmd_uuid.in_(kmd_uuids))
        .group_by(
            DeliveryAllocation.kmd_uuid,
            DeliveryItem.profile_type,
            DeliveryItem.profile_size,
            DeliveryItem.steel_grade,
        )
    )).all()

    alloc_map: dict[tuple, float] = {
        (str(r.kmd_uuid), r.profile_type, r.profile_size, r.steel_grade): float(r.allocated)
        for r in alloc_rows
    }

    # Проверяем каждый check
    for kmd_uuid, profile_type, profile_size, steel_grade, new_weight in checks:
        key = (kmd_uuid, profile_type, profile_size, steel_grade)
        plan = plan_map.get(key, 0.0)
        already = alloc_map.get(key, 0.0)
        available = round(plan - already, 3)

        if new_weight > available + 0.001:  # допуск на округление
            raise HTTPException(
                status_code=400,
                detail=(
                    f"КМД {kmd_uuid}: {profile_type} {profile_size} {steel_grade} — "
                    f"нельзя распределить {new_weight} кг. "
                    f"По плану: {round(plan, 1)} кг, "
                    f"уже распределено: {round(already, 1)} кг, "
                    f"доступно: {round(available, 1)} кг"
                )
            )


# ---------------------------------------------------------------------------
# POST /delivery/trucks
# ---------------------------------------------------------------------------

@router.post(
    "/trucks",
    response_model=TruckDetailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать поставку. Нераспределённый остаток автоматически идёт на склад",
)
async def create_truck(
    body: TruckCreateRequest,
    session: AsyncSession = Depends(get_async_session),
):
    # Валидация kmd_uuid
    all_kmd_uuids = {a.kmd_uuid for item in body.items for a in item.allocations}
    if all_kmd_uuids:
        existing = {
            str(u) for u in (await session.execute(
                select(KMD.uuid).where(KMD.uuid.in_(list(all_kmd_uuids)))
            )).scalars().all()
        }
        missing = all_kmd_uuids - existing
        if missing:
            raise HTTPException(400, detail=f"КМД не найдены: {', '.join(missing)}")

    # Валидация 1: сумма распределений не превышает total_weight позиции
    for item in body.items:
        total_alloc = sum(a.allocated_weight for a in item.allocations)
        if total_alloc > item.total_weight:
            raise HTTPException(
                400,
                detail=(
                    f"{item.profile_type} {item.profile_size} {item.steel_grade}: "
                    f"сумма распределений ({total_alloc} кг) > общий вес ({item.total_weight} кг)"
                )
            )

    # Валидация 2: новое распределение в КМД не превышает его дефицит
    checks = [
        (a.kmd_uuid, item.profile_type, item.profile_size, item.steel_grade, a.allocated_weight)
        for item in body.items
        for a in item.allocations
    ]
    if checks:
        await _validate_kmd_capacity(checks, session)

    truck = DeliveryTruck(name=body.name, delivery_date=body.delivery_date, note=body.note)
    session.add(truck)
    await session.flush()

    result_items = []
    for item_data in body.items:
        total_alloc = sum(a.allocated_weight for a in item_data.allocations)
        remaining = round(item_data.total_weight - total_alloc, 3)

        db_item = DeliveryItem(
            truck_id=truck.id,
            profile_type=item_data.profile_type,
            profile_size=item_data.profile_size,
            steel_grade=item_data.steel_grade,
            total_weight=item_data.total_weight,
            allocated_weight=total_alloc,
        )
        session.add(db_item)
        await session.flush()

        alloc_reads = []
        for alloc_data in item_data.allocations:
            session.add(DeliveryAllocation(
                delivery_item_id=db_item.id,
                kmd_uuid=alloc_data.kmd_uuid,
                allocated_weight=alloc_data.allocated_weight,
            ))
            kmd = await session.get(KMD, alloc_data.kmd_uuid)
            alloc_reads.append(AllocationRead(
                kmd_uuid=alloc_data.kmd_uuid,
                kmd_num=kmd.num_kmd if kmd else '—',
                allocated_weight=alloc_data.allocated_weight,
            ))

        result_items.append(DeliveryItemRead(
            id=db_item.id,
            profile_type=db_item.profile_type,
            profile_size=db_item.profile_size,
            steel_grade=db_item.steel_grade,
            total_weight=float(db_item.total_weight),
            allocated_weight=float(db_item.allocated_weight),
            remaining_weight=remaining,
            allocations=alloc_reads,
        ))

    await session.commit()

    return TruckDetailRead(
        id=truck.id, name=truck.name,
        delivery_date=truck.delivery_date, note=truck.note,
        items_count=len(result_items), items=result_items,
    )


# ---------------------------------------------------------------------------
# GET /delivery/trucks
# ---------------------------------------------------------------------------

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

    counts: dict = {}
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
            "page": page, "limit": limit, "total_items": total,
            "total_pages": total_pages,
            "has_more": page < total_pages,
            "has_previous": page > 1,
            "next_page": page + 1 if page < total_pages else None,
            "previous_page": page - 1 if page > 1 else None,
        },
    }


# ---------------------------------------------------------------------------
# GET /delivery/trucks/{truck_id}
# ---------------------------------------------------------------------------

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
        raise HTTPException(status_code=404, detail="Поставка не найдена")

    return TruckDetailRead(
        id=truck.id, name=truck.name,
        delivery_date=truck.delivery_date, note=truck.note,
        items_count=len(truck.items),
        items=[
            DeliveryItemRead(
                id=item.id,
                profile_type=item.profile_type,
                profile_size=item.profile_size,
                steel_grade=item.steel_grade,
                total_weight=float(item.total_weight),
                allocated_weight=float(item.allocated_weight),
                remaining_weight=item.remaining_weight,
                allocations=[
                    AllocationRead(
                        kmd_uuid=str(a.kmd_uuid),
                        kmd_num=a.kmd.num_kmd if a.kmd else '—',
                        allocated_weight=float(a.allocated_weight),
                    )
                    for a in item.allocations
                ],
            )
            for item in truck.items
        ],
    )