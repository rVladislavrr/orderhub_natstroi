import strawberry
from typing import List, Optional

from strawberry.types import Info
from sqlalchemy import select, and_
from collections import defaultdict

from src.models import Details, Marks, RelMarkaDel
from src.graphql.types import GroupNode, DetailType, GroupByLevel, HierarchyFilters
from src.service.redis_conn import redis_client, load_inf, get_inf


@strawberry.type
class Query:
    @strawberry.field
    async def dynamic_hierarchy(
            self,
            info: Info,
            kmd_uuids: List[str],
            group_by: List[GroupByLevel],
            filters: Optional[HierarchyFilters] = None
    ) -> List[GroupNode]:
        return await dynamic_hierarchy_table(info,
                                             kmd_uuids,
                                             group_by,
                                             filters)

    @strawberry.field
    async def dynamic_check(
            self,
            info: Info,
            kmd_uuids: List[str],
            group_by: List[GroupByLevel],
            filters: Optional[HierarchyFilters] = None,
    ) -> List[GroupNode]:
        return await dynamic_hierarchy_table(info,
                                             kmd_uuids,
                                             group_by,
                                             filters, limit=50)


async def dynamic_hierarchy_table(
        info: Info,
        kmd_uuids: List[str],
        group_by: List[GroupByLevel],
        filters: Optional[HierarchyFilters] = None, limit: int | None = None, ):
    db = info.context['db']

    key = ','.join(kmd_uuids) + (filters.to_str() if filters is not None else '')

    if items := await get_inf(key):
        sorted_levels = sorted(group_by, key=lambda x: x.order)
        return build_hierarchy(items, sorted_levels)

    else:
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

        if limit is not None:
            query = query.limit(limit)

        if filters:
            query = apply_filters(query, filters)

        result = await db.execute(query)
        rows = result.all()
        items = sorted([
            {
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
            } for row in rows], key=lambda x: int(x['num_detail'].split('.')[1]))

        await load_inf(key, items)

        sorted_levels = sorted(group_by, key=lambda x: x.order)
        return build_hierarchy(items, sorted_levels)


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
    return query


def build_hierarchy(items: List[dict], levels: List[GroupByLevel]) -> List[GroupNode]:
    if not levels:
        return []

    current_level = levels[0]
    remaining_levels = levels[1:]

    groups = defaultdict(list)
    for item in items:
        value = item.get(current_level.field)
        if value is None:
            key = 'Не указано'
        elif isinstance(value, float):
            key = str(value)
        else:
            key = str(value)
        groups[key].append(item)

    nodes = []
    for value, group_items in sorted(groups.items()):
        if remaining_levels:
            children = build_hierarchy(group_items, remaining_levels)
            details = []
        else:

            children = []

            unique_marks_map = {}
            for item in group_items:
                mark_key = (item.get('mark_name', ''), item.get('mark_title', ''))
                if mark_key not in unique_marks_map:
                    unique_marks_map[mark_key] = item

            details = [create_detail_type(item) for item in unique_marks_map.values()]

        # Агрегация данных (без изменений)
        total_quantity = sum(i.get('quantity', 0) for i in group_items)
        total_weight = sum(i.get('total_weight_for_position', 0) for i in group_items)
        total_count = len(set(
            (i.get('num_detail', ''), i.get('mark_title', ''), i.get('length', 0))
            for i in group_items
        ))

        unique_marks = {}
        for item in group_items:
            mark_key = (item.get('mark_title', ''), item.get('mark_name', ''))
            if mark_key not in unique_marks:
                unique_marks[mark_key] = (item.get('total_weight_for_mark', 0), item.get('mark_quantity', 0))
        total_count_marks = sum(i[1] for i in unique_marks.values())
        total_mark_weight = sum(i[0] for i in unique_marks.values())

        try:
            value = int(value)
        except ValueError:
            pass

        node = GroupNode(
            level=current_level.field,
            value=value,
            children=children,
            details=details,
            total_quantity=total_quantity,
            total_weight=round(total_weight, 3),
            total_count=total_count,
            total_mark_weight=round(total_mark_weight, 3),
            total_count_marks=total_count_marks
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

