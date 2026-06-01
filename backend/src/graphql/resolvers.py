# import logging
# import time
#
# import strawberry
# from typing import List, Optional
# from strawberry.types import Info
# from sqlalchemy import select, and_
# from collections import defaultdict
# from src.models import Details, Marks, RelMarkaDel
# from src.graphql.types import GroupNode, DetailType, GroupByLevel, HierarchyFilters, ResponseGraph, Statistics
# from src.service.redis_conn import redis_client, load_inf, get_inf
#
# log = logging.getLogger('Graphql')
#
#
# @strawberry.type
# class Query:
#
#     @strawberry.field
#     async def dynamic_hierarchy(
#             self,
#             info: Info,
#             kmd_uuids: List[str],
#             group_by: List[GroupByLevel],
#             filters: Optional[HierarchyFilters] = None
#     ) -> ResponseGraph:
#         log.info('Запрос на получение')
#         items = await get_items(info, kmd_uuids, filters)
#         nodes = await dynamic_hierarchy_table(items, group_by)
#         stat = compute_statistics(items, group_by)
#         log.info('Получены объекты')
#         return ResponseGraph(nodes=nodes, statistics=stat)
#
#
# async def get_items(
#         info: Info,
#         kmd_uuids: List[str],
#         filters: Optional[HierarchyFilters] = None,
# ):
#     db = info.context['db']
#
#     cache_key = f"hierarchy:{','.join(sorted(kmd_uuids))}:{filters.to_str() if filters else ''}"
#     log.info('Получение данных из хранилища')
#
#     s = time.time()
#     if items := await get_inf(cache_key):
#         log.info(f'Есть в кеше, получены время:{time.time() - s}')
#         return items
#
#     rel_conditions = [RelMarkaDel.kmd_uuid.in_(kmd_uuids)]
#
#     if filters and filters.que_num:
#         rel_conditions.append(RelMarkaDel.que_num.in_(filters.que_num))
#     if filters and filters.operation:
#         rel_conditions.append(RelMarkaDel.operation.in_(filters.operation))
#
#     filtered_rel_cte = (
#         select(RelMarkaDel)
#         .where(and_(*rel_conditions))
#         .cte("filtered_rel")
#     )
#
#     query = (
#         select(
#             Details.id,
#             Details.num_detail,
#             Details.type,
#             Details.size,
#             Details.width,
#             Details.length,
#             Details.weight,
#             Details.steel_grade,
#             filtered_rel_cte.c.operation,
#             Marks.mounting_part,
#             Marks.cooperation,
#             Marks.id.label('mark_id'),
#             Marks.title.label('mark_title'),
#             Marks.name.label('mark_name'),
#             Marks.quantity.label('mark_quantity'),
#             Marks.weight.label('mark_weight'),
#             filtered_rel_cte.c.details_quantity.label('quantity'),
#             filtered_rel_cte.c.que_num,
#         )
#         .select_from(filtered_rel_cte)
#         .join(Details, Details.id == filtered_rel_cte.c.details_id)
#         .join(Marks, Marks.id == filtered_rel_cte.c.marks_id)
#     )
#
#     if filters:
#         query = apply_filters(query, filters)
#
#     result = await db.execute(query)
#     rows = result.all()
#
#     items = []
#     for row in rows:
#         items.append({
#             'id': row.id,
#             'num_detail': row.num_detail,
#             'type': row.type,
#             'size': row.size,
#             'que_num': row.que_num,
#             'width': float(row.width) if row.width else None,
#             'length': float(row.length),
#             'weight': float(row.weight),
#             'steel_grade': row.steel_grade,
#             'operation': row.operation,
#             'cooperation': row.cooperation,
#             'mark_title': row.mark_title,
#             'mark_name': row.mark_name,
#             'mark_quantity': row.mark_quantity,
#             'mark_weight': float(row.mark_weight) if row.mark_weight else 0,
#             'total_weight_for_mark': row.mark_quantity * float(row.mark_weight),
#             'quantity': row.quantity,
#             'total_weight_for_position': row.quantity * float(row.weight),
#             'mounting_part': row.mounting_part,
#         })
#
#     # Сортируем один раз
#     items.sort(key=lambda x: int(x['num_detail'].split('.')[1]))
#
#     # Сохраняем в кэш
#     await load_inf(cache_key, items)
#
#     return items
#
#
# async def dynamic_hierarchy_table(
#         items,
#         group_by: List[GroupByLevel],
# ) -> List[GroupNode]:
#     sorted_levels = sorted(group_by, key=lambda x: x.order)
#     return build_hierarchy_fast(items, sorted_levels)
#
#
# def apply_filters(query, filters: HierarchyFilters):
#     if filters.mark_name:
#         query = query.where(Marks.name.in_(filters.mark_name))
#     if filters.steel_grade:
#         query = query.where(Details.steel_grade.in_(filters.steel_grade))
#     if filters.type:
#         query = query.where(Details.type.in_(filters.type))
#     if filters.size:
#         query = query.where(Details.size.in_(filters.size))
#     if filters.num_detail:
#         query = query.where(Details.num_detail.in_(filters.num_detail))
#     if filters.length:
#         query = query.where(Details.length.in_(filters.length))
#     if filters.cooperation:
#         query = query.where(Marks.cooperation.in_(filters.cooperation))
#     if filters.mounting_part:
#         mounting_part_values = []
#         has_null = False
#
#         for i in filters.mounting_part:
#             if i == 'Нет':
#                 has_null = True
#             else:
#                 mounting_part_values.append(i)
#         conditions = []
#         if mounting_part_values:
#             conditions.append(Marks.mounting_part.in_(mounting_part_values))
#         if has_null:
#             conditions.append(Marks.mounting_part.is_(None))
#
#         if conditions:
#             query = query.where(and_(*conditions) if len(conditions) > 1 else conditions[0])
#     return query
#
#
# def build_hierarchy_fast(items: List[dict], levels: List[GroupByLevel]) -> List[GroupNode]:
#     if not levels:
#         return []
#
#     groups = defaultdict(list)
#
#     for item in items:
#         key_parts = []
#         for level in levels:
#             value = item.get(level.field)
#             if value is None:
#                 value = 'Нет'
#             elif isinstance(value, float):
#                 value = str(value)
#             else:
#                 value = str(value)
#             key_parts.append(value)
#
#         groups[tuple(key_parts)].append(item)
#
#     return build_level(groups, levels, 0)
#
#
# def build_level(groups: dict, levels: List[GroupByLevel], depth: int) -> List[GroupNode]:
#     if depth >= len(levels):
#         return []
#
#     current_level = levels[depth]
#     is_last = (depth == len(levels) - 1)
#
#     grouped_by_value = defaultdict(list)
#
#     for key_tuple, group_items in groups.items():
#         value = key_tuple[depth]
#         grouped_by_value[value].extend(group_items)
#
#     nodes = []
#     for value, group_items in sorted(grouped_by_value.items()):
#         total_quantity = 0
#         total_weight = 0.0
#         total_mark_weight = 0.0
#         total_quantity_marks = 0
#         unique_positions = set()
#         unique_marks = set()
#
#         for item in group_items:
#             total_quantity += item.get('quantity', 0)
#             total_weight += item.get('total_weight_for_position', 0)
#             mark_key = (item.get('mark_title', ''))
#
#             if mark_key not in unique_marks:
#                 unique_marks.add(mark_key)
#                 total_mark_weight += item.get('total_weight_for_mark', 0)
#                 total_quantity_marks += item.get('mark_quantity', 0)
#
#             position_key = (item.get('num_detail', ''), item.get('length', 0))
#             unique_positions.add(position_key)
#
#         if is_last:
#             children = []
#         else:
#             subgroup = {}
#             for key_tuple, group_items in groups.items():
#                 if key_tuple[depth] == value:
#                     subgroup[key_tuple] = group_items
#
#             children = build_level(subgroup, levels, depth + 1)
#
#         try:
#             value = int(value)
#         except (ValueError, TypeError):
#             pass
#
#         node = GroupNode(
#             level=current_level.field,
#             value=value,
#             children=children,
#             total_quantity=total_quantity,
#             total_weight=round(total_weight, 3),
#             total_count=len(unique_positions),
#             total_mark_weight=round(total_mark_weight, 3),
#             total_quantity_marks=total_quantity_marks
#         )
#         nodes.append(node)
#
#     return nodes
#
#
# def compute_statistics(items: List[dict], group_by: List[GroupByLevel]) -> Statistics:
#     by_detail = any(g.field == 'num_detail' for g in group_by)
#
#     total_weight = 0.0
#     total_quantity = 0
#     seen: set = set()
#
#     for item in items:
#         if by_detail:
#
#             total_weight += item.get('total_weight_for_position', 0)
#             total_quantity += item.get('quantity', 0)
#         else:
#             key = item.get('mark_title', '')
#             if key not in seen:
#                 seen.add(key)
#                 total_weight += item.get('total_weight_for_mark', 0)
#                 total_quantity += item.get('mark_quantity', 0)
#
#     return Statistics(
#         total_weight=round(total_weight, 3),
#         total_quantity=total_quantity,
#     )
#
#
# def create_detail_type(item: dict) -> DetailType:
#     return DetailType(
#         id=item.get('id', 0),
#         num_detail=item.get('num_detail', ''),
#         type=item.get('type', ''),
#         size=item.get('size', ''),
#         cooperation=item.get('cooperation', ''),
#         width=item.get('width'),
#         length=item.get('length', 0),
#         weight=item.get('weight', 0),
#         steel_grade=item.get('steel_grade', ''),
#         operation=item.get('operation'),
#         mark_title=item.get('mark_title', ''),
#         mark_name=item.get('mark_name', ''),
#         mark_quantity=item.get('mark_quantity', 0),
#         mark_weight=item.get('mark_weight', 0),
#         quantity=item.get('quantity', 0),
#         total_weight_for_position=round(item.get('total_weight_for_position', 0), 3),
#         que_num=item.get('que_num', ''),
#         total_weight_for_mark=round(item.get('total_weight_for_mark', 0)),
#         mounting_part=item.get('mounting_part', ''),
#     )
# # import logging
# # import time
# #
# # import strawberry
# # from typing import List, Optional
# # from strawberry.types import Info
# # from sqlalchemy import select, and_
# # from src.models import Details, Marks, RelMarkaDel
# # from src.graphql.types import GroupNode, DetailType, GroupByLevel, HierarchyFilters, ResponseGraph, Statistics
# # from src.service.redis_conn import load_inf, get_inf
# #
# # log = logging.getLogger('Graphql')
# #
# #
# # # ---------------------------------------------------------------------------
# # # GraphQL resolver
# # # ---------------------------------------------------------------------------
# #
# # @strawberry.type
# # class Query:
# #
# #     @strawberry.field
# #     async def dynamic_hierarchy(
# #             self,
# #             info: Info,
# #             kmd_uuids: List[str],
# #             group_by: List[GroupByLevel],
# #             filters: Optional[HierarchyFilters] = None
# #     ) -> ResponseGraph:
# #         log.info('Запрос dynamic_hierarchy')
# #
# #         sorted_levels = sorted(group_by, key=lambda x: x.order)
# #         items = await get_items(info, kmd_uuids, filters)
# #         nodes = build_hierarchy(items, sorted_levels)
# #         stat = compute_statistics(items, group_by)
# #
# #         log.info('Запрос выполнен')
# #         return ResponseGraph(nodes=nodes, statistics=stat)
# #
# #
# # # ---------------------------------------------------------------------------
# # # Кэш + БД
# # # ---------------------------------------------------------------------------
# #
# # async def get_items(
# #         info: Info,
# #         kmd_uuids: List[str],
# #         filters: Optional[HierarchyFilters],
# # ) -> List[dict]:
# #     """Возвращает плоский список строк — из кэша или из БД."""
# #     cache_key = f"hierarchy:{','.join(sorted(kmd_uuids))}:{filters.to_str() if filters else ''}"
# #
# #     s = time.time()
# #     cached = await get_inf(cache_key)
# #     if cached:
# #         log.info(f'Из кэша за {time.time() - s:.3f}с, строк: {len(cached)}')
# #         return cached
# #
# #     db = info.context['db']
# #     items = await fetch_from_db(db, kmd_uuids, filters)
# #     await load_inf(cache_key, items)
# #     log.info(f'Из БД за {time.time() - s:.3f}с, строк: {len(items)}')
# #     return items
# #
# #
# # async def fetch_from_db(
# #         db,
# #         kmd_uuids: List[str],
# #         filters: Optional[HierarchyFilters],
# # ) -> List[dict]:
# #     """SQL-запрос, возвращает список словарей."""
# #     rel_conditions = [RelMarkaDel.kmd_uuid.in_(kmd_uuids)]
# #     if filters and filters.que_num:
# #         rel_conditions.append(RelMarkaDel.que_num.in_(filters.que_num))
# #
# #     filtered_rel_cte = (
# #         select(RelMarkaDel)
# #         .where(and_(*rel_conditions))
# #         .cte("filtered_rel")
# #     )
# #
# #     query = (
# #         select(
# #             Details.id,
# #             Details.num_detail,
# #             Details.type,
# #             Details.size,
# #             Details.width,
# #             Details.length,
# #             Details.weight,
# #             Details.steel_grade,
# #             Details.operation,
# #             Marks.mounting_part,
# #             Marks.id.label('mark_id'),
# #             Marks.title.label('mark_title'),
# #             Marks.name.label('mark_name'),
# #             Marks.quantity.label('mark_quantity'),
# #             Marks.weight.label('mark_weight'),
# #             filtered_rel_cte.c.details_quantity.label('quantity'),
# #             filtered_rel_cte.c.que_num,
# #         )
# #         .select_from(filtered_rel_cte)
# #         .join(Details, Details.id == filtered_rel_cte.c.details_id)
# #         .join(Marks, Marks.id == filtered_rel_cte.c.marks_id)
# #     )
# #
# #     if filters:
# #         query = apply_filters(query, filters)
# #
# #     result = await db.execute(query)
# #     rows = result.all()
# #
# #     items = []
# #     for row in rows:
# #         detail_weight = float(row.weight)
# #         mark_weight = float(row.mark_weight) if row.mark_weight else 0.0
# #         quantity = row.quantity
# #
# #         items.append({
# #             'id': row.id,
# #             'num_detail': row.num_detail,
# #             'type': row.type,
# #             'size': row.size,
# #             'que_num': row.que_num,
# #             'width': float(row.width) if row.width else None,
# #             'length': float(row.length),
# #             'weight': detail_weight,
# #             'steel_grade': row.steel_grade,
# #             'operation': row.operation,
# #             'mark_title': row.mark_title,
# #             'mark_name': row.mark_name,
# #             'mark_quantity': row.mark_quantity,
# #             'mark_weight': mark_weight,
# #             'total_weight_for_mark': row.mark_quantity * mark_weight,
# #             'quantity': quantity,
# #             'total_weight_for_position': quantity * detail_weight,
# #             'mounting_part': row.mounting_part,
# #         })
# #
# #     items.sort(key=lambda x: int(x['num_detail'].split('.')[1]))
# #     return items
# #
# #
# # def apply_filters(query, filters: HierarchyFilters):
# #     if filters.mark_name:
# #         query = query.where(Marks.name.in_(filters.mark_name))
# #     if filters.steel_grade:
# #         query = query.where(Details.steel_grade.in_(filters.steel_grade))
# #     if filters.type:
# #         query = query.where(Details.type.in_(filters.type))
# #     if filters.size:
# #         query = query.where(Details.size.in_(filters.size))
# #     if filters.num_detail:
# #         query = query.where(Details.num_detail.in_(filters.num_detail))
# #     if filters.length:
# #         query = query.where(Details.length.in_(filters.length))
# #     if filters.mounting_part:
# #         mounting_part_values = []
# #         has_null = False
# #         for i in filters.mounting_part:
# #             if i == 'Нет':
# #                 has_null = True
# #             else:
# #                 mounting_part_values.append(i)
# #
# #         conditions = []
# #         if mounting_part_values:
# #             conditions.append(Marks.mounting_part.in_(mounting_part_values))
# #         if has_null:
# #             conditions.append(Marks.mounting_part.is_(None))
# #         if conditions:
# #             query = query.where(and_(*conditions) if len(conditions) > 1 else conditions[0])
# #
# #     return query
# #
# #
# # # ---------------------------------------------------------------------------
# # # Статистика
# # # ---------------------------------------------------------------------------
# #
# # def compute_statistics(items: List[dict], group_by: List[GroupByLevel]) -> Statistics:
# #     """
# #     Считает статистику из плоского списка — независимо от группировки.
# #     Если в group_by есть num_detail — считаем по позициям (деталям),
# #     иначе — по маркам (дедупликация по mark_title).
# #     """
# #     by_detail = any(g.field == 'num_detail' for g in group_by)
# #
# #     total_weight = 0.0
# #     total_quantity = 0
# #     seen: set = set()
# #
# #     for item in items:
# #         if by_detail:
# #             key = (item.get('num_detail', ''), item.get('length', 0), item.get('que_num', ''))
# #             if key not in seen:
# #                 seen.add(key)
# #                 total_weight += item.get('total_weight_for_position', 0)
# #                 total_quantity += item.get('quantity', 0)
# #         else:
# #             key = item.get('mark_title', '')
# #             if key not in seen:
# #                 seen.add(key)
# #                 total_weight += item.get('total_weight_for_mark', 0)
# #                 total_quantity += item.get('mark_quantity', 0)
# #
# #     return Statistics(
# #         total_weight=round(total_weight, 3),
# #         total_quantity=total_quantity,
# #     )
# #
# #
# # # ---------------------------------------------------------------------------
# # # Построение иерархии
# # #
# # # Структура узла дерева:
# # #   {
# # #     'items':    [item, ...],           # items листового уровня этого узла
# # #     'children': {                      # дочерние узлы следующего уровня
# # #         'значение': { 'items': [...], 'children': {...} },
# # #         ...
# # #     }
# # #   }
# # #
# # # 'items' и 'children' — строго разные ключи, путаницы нет.
# # # ---------------------------------------------------------------------------
# #
# # def _make_node() -> dict:
# #     return {'items': [], 'children': {}}
# #
# #
# # def build_hierarchy(items: List[dict], levels: List[GroupByLevel]) -> List[GroupNode]:
# #     if not levels:
# #         return []
# #
# #     s = time.time()
# #     root = _make_node()
# #
# #     # Один проход O(n) — раскладываем items по дереву
# #     for item in items:
# #         node = root
# #         for level in levels:
# #             val = item.get(level.field)
# #             if val is None:
# #                 val = 'Нет'
# #             elif isinstance(val, float):
# #                 val = str(val)
# #             else:
# #                 val = str(val)
# #
# #             if val not in node['children']:
# #                 node['children'][val] = _make_node()
# #             node = node['children'][val]
# #
# #         # item попадает в листовой узел текущего пути
# #         node['items'].append(item)
# #
# #     nodes = _build_nodes(root['children'], levels, depth=0)
# #     log.info(f'Иерархия построена за {time.time() - s:.3f}с')
# #     return nodes
# #
# #
# # def _collect_items(node: dict) -> List[dict]:
# #     """Рекурсивно собирает все items из узла и всех его потомков."""
# #     result = list(node['items'])
# #     for child_node in node['children'].values():
# #         result.extend(_collect_items(child_node))
# #     return result
# #
# #
# # def _build_nodes(children: dict, levels: List[GroupByLevel], depth: int) -> List[GroupNode]:
# #     """
# #     children — node['children'] текущего уровня: {value_str: node_dict}
# #     depth    — индекс текущего уровня в levels
# #     """
# #     if depth >= len(levels):
# #         return []
# #
# #     current_level = levels[depth]
# #     is_last = (depth == len(levels) - 1)
# #     nodes = []
# #
# #     for value_str in sorted(children.keys()):
# #         node = children[value_str]
# #
# #         # Все items этого поддерева для подсчёта агрегатов
# #         all_items = _collect_items(node)
# #
# #         total_quantity = 0
# #         total_weight = 0.0
# #         total_mark_weight = 0.0
# #         total_quantity_marks = 0
# #         unique_positions: set = set()
# #         unique_details: set = set()
# #         unique_marks: set = set()
# #
# #         group_fields = {lvl.field for lvl in levels}
# #         use_marks = 'mark_title' in group_fields or 'mark_name' in group_fields
# #
# #         for item in all_items:
# #             pos_key = (item.get('num_detail', ''), item.get('length', 0))
# #             unique_positions.add(pos_key)
# #
# #             # Одна деталь входит в несколько марок (many-to-many через rel_markadel).
# #             # В результате JOIN деталь появляется N раз — по числу марок.
# #             # details_quantity и total_weight_for_position одинаковы во всех этих строках.
# #             # Дедупликация по details.id гарантированно убирает дубли.
# #             detail_id = item.get('id')
# #             is_new_detail = detail_id not in unique_details
# #             if is_new_detail:
# #                 unique_details.add(detail_id)
# #                 total_quantity += item.get('quantity', 0)
# #                 total_weight += item.get('total_weight_for_position', 0)
# #                 if not use_marks:
# #                     # Без марок в group_by — вес считаем через детали
# #                     total_mark_weight += item.get('total_weight_for_position', 0)
# #
# #             if use_marks:
# #                 # С марками в group_by — вес считаем через марки.
# #                 # total_weight_for_mark = mark.quantity * mark.weight — полный вес марки.
# #                 # Дедупликация по mark_title: марка одна, вес берём один раз.
# #                 mark_key = item.get('mark_title', '')
# #                 if mark_key not in unique_marks:
# #                     unique_marks.add(mark_key)
# #                     total_mark_weight += item.get('total_weight_for_mark', 0)
# #                     total_quantity_marks += item.get('mark_quantity', 0)
# #             else:
# #                 total_quantity_marks += item.get('mark_quantity', 0)
# #
# #         # Рекурсивно строим дочерние ноды из node['children'] следующего уровня
# #         child_nodes = [] if is_last else _build_nodes(node['children'], levels, depth + 1)
# #
# #         # Пробуем привести значение к int (для числовых полей вроде length, quantity)
# #         try:
# #             typed_value = int(value_str)
# #         except (ValueError, TypeError):
# #             typed_value = value_str
# #
# #         nodes.append(GroupNode(
# #             level=current_level.field,
# #             value=typed_value,
# #             children=child_nodes,
# #             total_quantity=total_quantity,
# #             total_weight=round(total_weight, 3),
# #             total_count=len(unique_positions),
# #             total_mark_weight=round(total_mark_weight, 3),
# #             total_quantity_marks=total_quantity_marks,
# #         ))
# #
# #     return nodes
# #
# #
# # # ---------------------------------------------------------------------------
# # # Утилита
# # # ---------------------------------------------------------------------------
# #
# # def create_detail_type(item: dict) -> DetailType:
# #     return DetailType(
# #         id=item.get('id', 0),
# #         num_detail=item.get('num_detail', ''),
# #         type=item.get('type', ''),
# #         size=item.get('size', ''),
# #         width=item.get('width'),
# #         length=item.get('length', 0),
# #         weight=item.get('weight', 0),
# #         steel_grade=item.get('steel_grade', ''),
# #         operation=item.get('operation'),
# #         mark_title=item.get('mark_title', ''),
# #         mark_name=item.get('mark_name', ''),
# #         mark_quantity=item.get('mark_quantity', 0),
# #         mark_weight=item.get('mark_weight', 0),
# #         quantity=item.get('quantity', 0),
# #         total_weight_for_position=round(item.get('total_weight_for_position', 0), 3),
# #         que_num=item.get('que_num', ''),
# #         total_weight_for_mark=round(item.get('total_weight_for_mark', 0), 3),
# #         mounting_part=item.get('mounting_part', ''),
# #     )
import logging
import time
from collections import defaultdict

import strawberry
from typing import List, Optional, Union
from strawberry.types import Info
from sqlalchemy import select, and_

from src.models import Details, Marks, RelMarkaDel
from src.graphql.types import (
    GroupNode, DetailType, GroupByLevel, HierarchyFilters,
    ResponseGraph, Statistics,
)
from src.service.redis_conn import load_inf, get_inf

log = logging.getLogger('Graphql')

@strawberry.type
class Query:

    @strawberry.field
    async def dynamic_hierarchy(
            self,
            info: Info,
            kmd_uuids: List[str],
            group_by: List[GroupByLevel],
            filters: Optional[HierarchyFilters] = None,
    ) -> ResponseGraph:
        log.info('Запрос dynamic_hierarchy')

        items = await get_items(info, kmd_uuids, filters)
        sorted_levels = sorted(group_by, key=lambda x: x.order)
        nodes = build_hierarchy(items, sorted_levels)
        stat = compute_statistics(items)

        log.info(f'Запрос выполнен, строк: {len(items)}, узлов верхнего уровня: {len(nodes)}')
        return ResponseGraph(nodes=nodes, statistics=stat)


async def get_items(
        info: Info,
        kmd_uuids: List[str],
        filters: Optional[HierarchyFilters],
) -> List[dict]:
    """Возвращает плоский список строк — из кэша или из БД."""
    cache_key = (
        f"hierarchy:{','.join(sorted(kmd_uuids))}"
        f":{filters.to_str() if filters else ''}"
    )

    s = time.time()
    cached = await get_inf(cache_key)
    if cached:
        log.info(f'Из кэша за {time.time() - s:.3f}с, строк: {len(cached)}')
        return cached

    db = info.context['db']
    items = await fetch_from_db(db, kmd_uuids, filters)
    await load_inf(cache_key, items)
    log.info(f'Из БД за {time.time() - s:.3f}с, строк: {len(items)}')
    return items


async def fetch_from_db(
        db,
        kmd_uuids: List[str],
        filters: Optional[HierarchyFilters],
) -> List[dict]:
    """SQL-запрос → список плоских словарей (одна строка = одна связь деталь-марка)."""
    rel_conditions = [RelMarkaDel.kmd_uuid.in_(kmd_uuids)]
    if filters and filters.que_num:
        rel_conditions.append(RelMarkaDel.que_num.in_(filters.que_num))
    if filters and filters.operation:
        rel_conditions.append(RelMarkaDel.operation.in_(filters.operation))

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
            filtered_rel_cte.c.operation,
            filtered_rel_cte.c.details_quantity.label('quantity'),
            filtered_rel_cte.c.que_num,
            Marks.id.label('mark_id'),
            Marks.title.label('mark_title'),
            Marks.name.label('mark_name'),
            Marks.quantity.label('mark_quantity'),
            Marks.weight.label('mark_weight'),
            Marks.mounting_part,
            Marks.cooperation,
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
        detail_weight = float(row.weight)
        mark_weight = float(row.mark_weight) if row.mark_weight else 0.0
        quantity = row.quantity  # details_quantity — кол-во деталей на все марки
        mark_quantity = row.mark_quantity  # кол-во марок на заказ

        items.append({
            # --- деталь ---
            'id': row.id,                          # pk детали (для дедупликации)
            'num_detail': row.num_detail,
            'type': row.type,
            'size': row.size,
            'width': float(row.width) if row.width else None,
            'length': float(row.length),
            'weight': detail_weight,               # вес одной детали
            'steel_grade': row.steel_grade,
            'que_num': row.que_num,
            'operation': row.operation,
            'quantity': quantity,                  # кол-во деталей (на все марки)
            # суммарный вес деталей этой позиции = weight * quantity
            'total_weight_details': round(detail_weight * quantity, 3),

            # --- марка ---
            'mark_id': row.mark_id,                # pk марки (для дедупликации)
            'mark_title': row.mark_title,
            'mark_name': row.mark_name,
            'mark_quantity': mark_quantity,        # кол-во марок на заказ
            'mark_weight': mark_weight,            # вес одной марки
            # суммарный вес марок = mark_weight * mark_quantity
            'total_weight_marks': round(mark_weight * mark_quantity, 3),

            # --- доп. ---
            'cooperation': row.cooperation,
            'mounting_part': row.mounting_part,
        })

    # Сортируем по числовой части номера детали (формат "X.N")
    items.sort(key=lambda x: _detail_sort_key(x['num_detail']))
    return items


def _detail_sort_key(num_detail: str) -> int:
    try:
        return int(num_detail.split('.')[1])
    except (IndexError, ValueError):
        return 0


# ---------------------------------------------------------------------------
# Фильтры
# ---------------------------------------------------------------------------

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
    if filters.cooperation:
        query = query.where(Marks.cooperation.in_(filters.cooperation))
    if filters.mounting_part:
        mounting_part_values = [v for v in filters.mounting_part if v != 'Нет']
        has_null = 'Нет' in filters.mounting_part
        conditions = []
        if mounting_part_values:
            conditions.append(Marks.mounting_part.in_(mounting_part_values))
        if has_null:
            conditions.append(Marks.mounting_part.is_(None))
        if conditions:
            query = query.where(
                and_(*conditions) if len(conditions) > 1 else conditions[0]
            )
    return query


# ---------------------------------------------------------------------------
# Построение иерархии
#
# Каждый узел дерева:
#   {
#       'items':    [item, ...],           # строки, попавшие именно в этот лист
#       'children': { value_str: node }    # дочерние узлы следующего уровня
#   }
#
# Деталь может входить в несколько марок → JOIN даёт дубли.
# Дедупликация:
#   - по detail.id  → чтобы не задваивать вес/кол-во деталей
#   - по mark_id    → чтобы не задваивать вес/кол-во марок
# ---------------------------------------------------------------------------

def _make_node() -> dict:
    return {'items': [], 'children': {}}


def build_hierarchy(items: List[dict], levels: List[GroupByLevel]) -> List[GroupNode]:
    if not levels:
        return []

    root = _make_node()

    for item in items:
        node = root
        for level in levels:
            val = item.get(level.field)
            val = _normalize_key(val)
            if val not in node['children']:
                node['children'][val] = _make_node()
            node = node['children'][val]
        node['items'].append(item)

    return _build_nodes(root['children'], levels, depth=0)


def _normalize_key(val) -> str:
    if val is None:
        return 'Нет'
    if isinstance(val, float):
        # убираем лишние нули: 12.0 → "12", 12.5 → "12.5"
        return str(int(val)) if val == int(val) else str(val)
    return str(val)


def _collect_items(node: dict) -> List[dict]:
    """Рекурсивно собирает все строки из узла и всех его потомков."""
    result = list(node['items'])
    for child in node['children'].values():
        result.extend(_collect_items(child))
    return result


def _aggregate(all_items: List[dict]) -> dict:
    """
    Считает агрегаты для набора строк, избегая дублей:
      - детали дедуплицируются по detail.id
      - марки дедуплицируются по mark_id

    Возвращает словарь с полями:
        detail_count          — уникальных позиций деталей (num_detail + length)
        detail_quantity       — суммарное кол-во деталей
        total_weight_details  — суммарный вес деталей (weight * quantity)
        mark_count            — уникальных марок
        mark_quantity         — суммарное кол-во марок
        total_weight_marks    — суммарный вес марок (mark_weight * mark_quantity)
    """
    seen_details: set = set()
    seen_marks: set = set()
    seen_positions: set = set()

    detail_quantity = 0
    total_weight_details = 0.0
    mark_quantity = 0
    total_weight_marks = 0.0

    for item in all_items:
        # --- детали (дедупликация по id детали) ---
        # detail_id = item['id']
        # if detail_id not in seen_details:
        #     seen_details.add(detail_id)
        detail_quantity += item['quantity']
        total_weight_details += item['total_weight_details']

        # # --- позиции (уникальная пара num_detail + length) ---
        # pos_key = (item['num_detail'], item['length'])
        # seen_positions.add(pos_key)

        # # --- марки (дедупликация по mark_id) ---
        # mark_id = item['mark_id']
        # if mark_id not in seen_marks:
        #     seen_marks.add(mark_id)
        mark_quantity += item['mark_quantity']
        total_weight_marks += item['total_weight_marks']

    return {
        # 'detail_count': len(seen_positions),
        'detail_quantity': detail_quantity,
        'total_weight_details': round(total_weight_details, 3),
        # 'mark_count': len(seen_marks),
        'mark_quantity': mark_quantity,
        'total_weight_marks': round(total_weight_marks, 3),
    }


def _build_nodes(children: dict, levels: List[GroupByLevel], depth: int) -> List[GroupNode]:
    if depth >= len(levels):
        return []

    current_level = levels[depth]
    is_last = (depth == len(levels) - 1)
    nodes = []

    for value_str in sorted(children.keys()):
        node = children[value_str]
        all_items = _collect_items(node)
        agg = _aggregate(all_items)

        child_nodes = [] if is_last else _build_nodes(node['children'], levels, depth + 1)

        # Пробуем привести значение к числу (для length, quantity и т.п.)
        try:
            typed_value: Union[int, str] = int(value_str)
        except (ValueError, TypeError):
            try:
                typed_value = float(value_str)
            except (ValueError, TypeError):
                typed_value = value_str

        nodes.append(GroupNode(
            level=current_level.field,
            value=typed_value,
            children=child_nodes,
            # детали
            # detail_count=agg['detail_count'],
            detail_quantity=agg['detail_quantity'],
            total_weight_details=agg['total_weight_details'],
            # марки
            # mark_count=agg['mark_count'],
            mark_quantity=agg['mark_quantity'],
            total_weight_marks=agg['total_weight_marks'],
        ))

    return nodes


def compute_statistics(items: List[dict]) -> Statistics:
    agg = _aggregate(items)
    return Statistics(
        # детали
        # detail_count=agg['detail_count'],
        detail_quantity=agg['detail_quantity'],
        total_weight_details=agg['total_weight_details'],
        # марки
        # mark_count=agg['mark_count'],
        mark_quantity=agg['mark_quantity'],
        total_weight_marks=agg['total_weight_marks'],
    )

def create_detail_type(item: dict) -> DetailType:
    return DetailType(
        id=item['id'],
        num_detail=item['num_detail'],
        type=item['type'],
        size=item['size'],
        width=item.get('width'),
        length=item['length'],
        weight=item['weight'],
        steel_grade=item['steel_grade'],
        operation=item.get('operation'),
        que_num=item.get('que_num', ''),
        quantity=item['quantity'],
        total_weight_details=item['total_weight_details'],
        mark_title=item['mark_title'],
        mark_name=item['mark_name'],
        mark_quantity=item['mark_quantity'],
        mark_weight=item['mark_weight'],
        total_weight_marks=item['total_weight_marks'],
        cooperation=item.get('cooperation'),
        mounting_part=item.get('mounting_part'),
    )