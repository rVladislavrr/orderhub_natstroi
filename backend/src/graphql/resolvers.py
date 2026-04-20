import logging
import time

import strawberry
from typing import List, Optional
from strawberry.types import Info
from sqlalchemy import select, and_
from collections import defaultdict
from src.models import Details, Marks, RelMarkaDel
from src.graphql.types import GroupNode, DetailType, GroupByLevel, HierarchyFilters, ResponseGraph, Statistics
from src.service.redis_conn import redis_client, load_inf, get_inf

log = logging.getLogger('Graphql')

@strawberry.type
class Query:

    @strawberry.field
    async def dynamic_hierarchy(
            self,
            info: Info,
            kmd_uuids: List[str],
            group_by: List[GroupByLevel],
            filters: Optional[HierarchyFilters] = None
    ) -> ResponseGraph:
        log.info('Запрос на получение')
        nodes = await dynamic_hierarchy_table(info, kmd_uuids, group_by, filters)

        if any(g.field == 'num_detail' for g in group_by):
            total_weight = round(sum(w.total_weight for w in nodes if w and hasattr(w, 'total_weight')),3)
            total_quantity = sum(w.total_quantity for w in nodes if w and hasattr(w, 'total_quantity'))
        else:
            total_weight = round(sum(w.total_mark_weight for w in nodes if w and hasattr(w, 'total_mark_weight')),3)
            total_quantity = sum(w.total_quantity_marks for w in nodes if w and hasattr(w, 'total_quantity_marks'))
        stat = Statistics(total_weight=total_weight, total_quantity=total_quantity)
        log.info('Получены объекты')
        return ResponseGraph(nodes=nodes, statistics=stat)

async def dynamic_hierarchy_table(
        info: Info,
        kmd_uuids: List[str],
        group_by: List[GroupByLevel],
        filters: Optional[HierarchyFilters] = None,
) -> List[GroupNode]:
    db = info.context['db']

    cache_key = f"hierarchy:{','.join(sorted(kmd_uuids))}:{filters.to_str()if filters else ''}:{','.join(str(g.order) for g in sorted(group_by, key=lambda x: x.order))}"
    log.info('Получение данных из хранилища')

    s = time.time()
    if items := await get_inf(cache_key):
        log.info(f'Есть в кеше, получены время:{time.time() - s}')
        s = time.time()
        sorted_levels = sorted(group_by, key=lambda x: x.order)
        res = build_hierarchy_fast(items, sorted_levels)

        log.info(f'Обработанные данные время:{time.time() - s}')
        return res

    rel_conditions = [RelMarkaDel.kmd_uuid.in_(kmd_uuids)]

    if filters and filters.que_num:
        rel_conditions.append(RelMarkaDel.que_num.in_(filters.que_num))

    filtered_rel_cte = (
        select(RelMarkaDel)
        .where(and_(*rel_conditions))
        .cte("filtered_rel")
    )

    query = (
        select(
            Details.id,
            Details.num_detail,
            Details.type,
            Details.size,
            Details.width,
            Details.length,
            Details.weight,
            Details.steel_grade,
            Details.operation,
            Marks.mounting_part,
            Marks.id.label('mark_id'),
            Marks.title.label('mark_title'),
            Marks.name.label('mark_name'),
            Marks.quantity.label('mark_quantity'),
            Marks.weight.label('mark_weight'),
            filtered_rel_cte.c.details_quantity.label('quantity'),
            filtered_rel_cte.c.que_num,
        )
        .select_from(filtered_rel_cte)
        .join(Details, Details.id == filtered_rel_cte.c.details_id)
        .join(Marks, Marks.id == filtered_rel_cte.c.marks_id)
    )

    if filters:
        query = apply_filters(query, filters)

    result = await db.execute(query)
    rows = result.all()

    items = []
    for row in rows:
        items.append({
            'id': row.id,
            'num_detail': row.num_detail,
            'type': row.type,
            'size': row.size,
            'que_num': row.que_num,
            'width': float(row.width) if row.width else None,
            'length': float(row.length),
            'weight': float(row.weight),
            'steel_grade': row.steel_grade,
            'operation': row.operation,
            'mark_title': row.mark_title,
            'mark_name': row.mark_name,
            'mark_quantity': row.mark_quantity,
            'mark_weight': float(row.mark_weight) if row.mark_weight else 0,
            'total_weight_for_mark': row.mark_quantity * float(row.mark_weight),
            'quantity': row.quantity,
            'total_weight_for_position': row.quantity * float(row.weight),
            'mounting_part': row.mounting_part,
        })

    # Сортируем один раз
    items.sort(key=lambda x: int(x['num_detail'].split('.')[1]))

    # Сохраняем в кэш
    await load_inf(cache_key, items)

    sorted_levels = sorted(group_by, key=lambda x: x.order)
    return build_hierarchy_fast(items, sorted_levels)


def apply_filters(query, filters: HierarchyFilters):
    if filters.mark_name:
        query = query.where(Marks.name.in_(filters.mark_name))
    if filters.steel_grade:
        query = query.where(Details.steel_grade.in_(filters.steel_grade))
    if filters.type:
        query = query.where(Details.type.in_(filters.type))
    if filters.size:
        query = query.where(Details.size.in_(filters.size))
    if filters.num_detail:
        query = query.where(Details.num_detail.in_(filters.num_detail))
    if filters.length:
        query = query.where(Details.length.in_(filters.length))
    if filters.mounting_part:
        mounting_part_values = []
        has_null = False

        for i in filters.mounting_part:
            if i == 'Нет':
                has_null = True
            else:
                mounting_part_values.append(i)
        conditions = []
        if mounting_part_values:
            conditions.append(Marks.mounting_part.in_(mounting_part_values))
        if has_null:
            conditions.append(Marks.mounting_part.is_(None))

        if conditions:
            query = query.where(and_(*conditions) if len(conditions) > 1 else conditions[0])
    return query


def build_hierarchy_fast(items: List[dict], levels: List[GroupByLevel]) -> List[GroupNode]:
    if not levels:
        return []

    groups = defaultdict(list)

    for item in items:
        key_parts = []
        for level in levels:
            value = item.get(level.field)
            if value is None:
                value = 'Нет'
            elif isinstance(value, float):
                value = str(value)
            else:
                value = str(value)
            key_parts.append(value)

        groups[tuple(key_parts)].append(item)

    return build_level(groups, levels, 0)


def build_level(groups: dict, levels: List[GroupByLevel], depth: int) -> List[GroupNode]:
    if depth >= len(levels):
        return []

    current_level = levels[depth]
    is_last = (depth == len(levels) - 1)

    grouped_by_value = defaultdict(list)

    for key_tuple, group_items in groups.items():
        value = key_tuple[depth]
        grouped_by_value[value].extend(group_items)

    nodes = []
    for value, group_items in sorted(grouped_by_value.items()):
        total_quantity = 0
        total_weight = 0.0
        total_mark_weight = 0.0
        total_quantity_marks = 0
        unique_positions = set()
        unique_marks = set()

        for item in group_items:
            total_quantity += item.get('quantity', 0)  # количество деталей уже для марки
            total_weight += item.get('total_weight_for_position', 0)  # количество деталей на вес деталей
            mark_key = (item.get('mark_title', ''))

            if mark_key not in unique_marks:
                unique_marks.add(mark_key)
                total_mark_weight += item.get('total_weight_for_mark', 0)
                total_quantity_marks += item.get('mark_quantity', 0)

            position_key = (item.get('num_detail', ''), item.get('length', 0))
            unique_positions.add(position_key)

        if is_last:
            children = []
        else:
            subgroup = {}
            for key_tuple, group_items in groups.items():
                if key_tuple[depth] == value:
                    subgroup[key_tuple] = group_items

            children = build_level(subgroup, levels, depth + 1)

        try:
            value = int(value)
        except (ValueError, TypeError):
            pass

        node = GroupNode(
            level=current_level.field,
            value=value,
            children=children,
            total_quantity=total_quantity,
            total_weight=round(total_weight, 3),
            total_count=len(unique_positions),
            total_mark_weight=round(total_mark_weight, 3),
            total_quantity_marks=total_quantity_marks
        )
        nodes.append(node)

    return nodes


def create_detail_type(item: dict) -> DetailType:
    return DetailType(
        id=item.get('id', 0),
        num_detail=item.get('num_detail', ''),
        type=item.get('type', ''),
        size=item.get('size', ''),
        width=item.get('width'),
        length=item.get('length', 0),
        weight=item.get('weight', 0),
        steel_grade=item.get('steel_grade', ''),
        operation=item.get('operation'),
        mark_title=item.get('mark_title', ''),
        mark_name=item.get('mark_name', ''),
        mark_quantity=item.get('mark_quantity', 0),
        mark_weight=item.get('mark_weight', 0),
        quantity=item.get('quantity', 0),
        total_weight_for_position=round(item.get('total_weight_for_position', 0), 3),
        que_num=item.get('que_num', ''),
        total_weight_for_mark=round(item.get('total_weight_for_mark', 0)),
        mounting_part=item.get('mounting_part', ''),
    )
