import logging
from collections import defaultdict
from math import ceil
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import UUID4
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.connection import get_async_session
from src.models.orders import Orders
from src.models.KMD import KMD
from src.models.rel_markadet import RelMarkaDel

router = APIRouter(
    tags=["materials"],
)
log = logging.getLogger('Мате роутер')


def _aggregate_rel_entries(
        rel_entries: list[RelMarkaDel],
        column_key: int,
) -> dict[tuple[str, str], dict[int, float]]:
    """
    Считает суммарный вес по парам (профиль, сталь).
    Формула: detail.weight * rel.details_quantity
    """
    result: dict[tuple[str, str], dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for rel in rel_entries:
        d = rel.detail
        profile = f"{d.type} {d.size}".strip()
        total_weight = float(d.weight or 0) * rel.details_quantity
        result[(profile, d.steel_grade)][column_key] += total_weight
    return result


def _merge_aggregates(
        aggregates: list[dict[tuple[str, str], dict[str, float]]],
) -> dict[tuple[str, str], dict[str, float]]:
    merged: dict[tuple[str, str], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for agg in aggregates:
        for (profile, steel), columns in agg.items():
            for col, weight in columns.items():
                merged[(profile, steel)][col] += weight
    return merged


def _build_response(
        merged: dict[tuple[str, str], dict[str, float]],
        columns: list[int],
) -> dict[str, Any]:
    rows = []
    column_totals: dict[str, float] = defaultdict(float)
    grand_total = 0.0

    for (profile, steel), col_weights in sorted(merged.items()):
        totals = {col: round(col_weights.get(col, 0.0), 1) for col in columns}
        row_total = round(sum(totals.values()), 1)
        rows.append(
            {
                "profile": profile,
                "steel_grade": steel,
                "totals": totals,
                "grand_total": row_total,
            }
        )
        for col, w in totals.items():
            column_totals[col] += w
        grand_total += row_total

    return {
        "columns": columns,
        "rows": rows,
        "column_totals": {col: round(v, 1) for col, v in column_totals.items()},
        "grand_total": round(grand_total, 1),
    }


@router.get(
    "/order/{uuid_orders}",
    summary="Профили и сталь по заказу",
    response_model=dict,
)
async def report_by_order(
        uuid_orders: UUID4,
        session: AsyncSession = Depends(get_async_session),
):
    stmt = (
        select(Orders)
        .where(Orders.uuid == uuid_orders)
        .options(
            selectinload(Orders.kmd_list)
            .selectinload(KMD.rel_markadel_entries)
            .selectinload(RelMarkaDel.detail)
        )
    )
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()

    if order is None:
        raise HTTPException(status_code=404, detail=f"Заказ {str(uuid_orders)!r} не найден")

    if not order.kmd_list:
        raise HTTPException(status_code=404, detail="В заказе нет КМД")

    sorted_kmd = sorted(order.kmd_list, key=lambda k: k.num_kmd)
    kmd_numbers = [k.num_kmd for k in sorted_kmd]

    aggregates = [
        _aggregate_rel_entries(kmd.rel_markadel_entries, kmd.num_kmd)
        for kmd in sorted_kmd
    ]
    merged = _merge_aggregates(aggregates)

    return {
        "order": {
            "uuid": str(order.uuid),
            "internal_num_orders": order.internal_num_orders,
            "name": order.name,
            "status": order.status,
        },
        **_build_response(merged, kmd_numbers),
    }


@router.get(
    "/active",
    summary="Профили и сталь по всем активным заказам",
    response_model=dict,
)
async def report_all_active_orders(
        page: int = Query(1, ge=1),
        limit: int = Query(5, ge=1, le=200),
        session: AsyncSession = Depends(get_async_session),
):
    stmt = (
        select(Orders)
        .where(Orders.is_active == True)  # noqa: E712
        .options(
            selectinload(Orders.kmd_list)
            .selectinload(KMD.rel_markadel_entries)
            .selectinload(RelMarkaDel.detail)
        )
        .order_by(Orders.internal_num_orders)
    )
    result = await session.execute(stmt)
    orders = result.scalars().all()

    if not orders:
        raise HTTPException(status_code=404, detail="Нет активных заказов")

    order_numbers = [o.internal_num_orders for o in orders]

    aggregates = []
    for order in orders:
        all_entries: list[RelMarkaDel] = []
        for kmd in order.kmd_list:
            all_entries.extend(kmd.rel_markadel_entries)
        aggregates.append(_aggregate_rel_entries(all_entries, order.internal_num_orders))

    merged = _merge_aggregates(aggregates)

    all_keys = sorted(merged.keys())
    total_items = len(all_keys)
    total_pages = ceil(total_items / limit) if total_items else 1
    offset = (page - 1) * limit
    paged_keys = all_keys[offset: offset + limit]
    paged_merged = {k: merged[k] for k in paged_keys}

    return {
        "orders_count": len(orders),
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_more": page < total_pages,
            "has_previous": page > 1,
            "next_page": page + 1 if page < total_pages else None,
            "previous_page": page - 1 if page > 1 else None,
        },
        **_build_response(paged_merged, order_numbers),
    }
