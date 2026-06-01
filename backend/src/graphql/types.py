# import strawberry
# from typing import List, Optional
#
#
# @strawberry.type
# class DetailType:
#     # Все поля из таблицы Details
#     id: int
#     num_detail: str
#     type: str
#     size: str
#     width: Optional[float]
#     length: float
#     weight: float
#     steel_grade: str
#     operation: Optional[str]
#
#     # Поля из Marks
#     mark_title: str
#     mark_name: str
#     mark_quantity: int
#     mark_weight: float
#     mounting_part: str
#     cooperation: str
#
#     # Поля из RelMarkaDel
#     quantity: int
#     que_num: str
#
#     # Агрегированные поля
#     total_weight_for_position: float
#     total_weight_for_mark: float
#
#
# @strawberry.type
# class GroupNode:
#     level: str  # Название поля по которому группируем
#     value: str  # Значение в этой группе
#     children: List['GroupNode']
#     total_quantity: int
#     total_weight: float
#     total_count: int  # Количество уникальных позиций
#     total_mark_weight: float
#     total_quantity_marks: int
#
# @strawberry.type
# class Statistics:
#     total_weight: float
#     total_quantity: int
#
# @strawberry.type
# class ResponseGraph:
#     nodes: List[GroupNode]
#     statistics: Statistics
#
# @strawberry.input
# class GroupByLevel:
#     field: str  # Любое поле: "type", "steel_grade", "size", "num_detail", "mark_title",
#     # "length", "width", "weight", "quantity" и т.д.
#     order: int
#
#
# @strawberry.input
# class HierarchyFilters:
#     # Фильтры по любым полям
#     steel_grade: Optional[List[str]] = None
#     type: Optional[List[str]] = None
#     size: Optional[List[str]] = None
#     num_detail: Optional[List[str]] = None
#     mark_name: Optional[List[str]] = None
#     que_num: Optional[List[str]] = None
#     length: Optional[List[int]] = None
#     mounting_part: Optional[List[str]] = None
#     operation: Optional[List[str]] = None
#     cooperation: Optional[List[str]] = None
#
#
#     def to_str(self) -> str:
#         result = []
#         for attr_name in self.__annotations__:
#             value = getattr(self, attr_name)
#             if value and isinstance(value, list):
#                 value = list(map(str, value))
#                 result.append(f"{attr_name}={','.join(value)}")
#             if value and isinstance(value, str):
#                 result.append(f"{attr_name}={value}")
#             if value and isinstance(value, int):
#                 result.append(f"{attr_name}={str(value)}")
#         return ";".join(result)
#
#
#
# GroupNode.__annotations__['children'] = List[GroupNode]
import strawberry
from typing import List, Optional, Union


# ---------------------------------------------------------------------------
# Input types
# ---------------------------------------------------------------------------

@strawberry.input
class GroupByLevel:
    field: str   # любое поле: "type", "steel_grade", "size", "num_detail",
                 # "mark_title", "mark_name", "length", "width", "weight",
                 # "quantity", "operation", "que_num", "cooperation",
                 # "mounting_part" и т.д.
    order: int   # порядок вложенности (1 = внешний уровень, 2 = вложенный, ...)


@strawberry.input
class HierarchyFilters:
    que_num: Optional[List[str]] = None
    operation: Optional[List[str]] = None
    mark_name: Optional[List[str]] = None
    steel_grade: Optional[List[str]] = None
    type: Optional[List[str]] = None
    size: Optional[List[str]] = None
    num_detail: Optional[List[str]] = None
    length: Optional[List[float]] = None
    cooperation: Optional[List[str]] = None
    mounting_part: Optional[List[str]] = None   # передавайте "Нет" для NULL

    def to_str(self) -> str:
        parts = []
        for field in (
            'que_num', 'operation', 'mark_name', 'steel_grade', 'type',
            'size', 'num_detail', 'length', 'cooperation', 'mounting_part',
        ):
            val = getattr(self, field)
            if val:
                parts.append(f"{field}={','.join(str(v) for v in sorted(val))}")
        return '|'.join(parts)

@strawberry.type
class DetailType:
    id: int
    num_detail: str
    type: str
    size: str
    width: Optional[float]
    length: float
    weight: float                   # вес одной детали
    steel_grade: str
    operation: Optional[str]
    que_num: str
    quantity: int                   # кол-во деталей на заказ
    total_weight_details: float     # weight * quantity

    mark_title: str
    mark_name: str
    mark_quantity: int              # кол-во марок на заказ
    mark_weight: float              # вес одной марки
    total_weight_marks: float       # mark_weight * mark_quantity

    cooperation: Optional[str]
    mounting_part: Optional[str]


@strawberry.type
class GroupNode:
    level: str                      # название поля, по которому сгруппировано
    value: strawberry.scalar(       # значение группы (строка или число)
        Union[str, int, float],
        name="GroupValue",
        serialize=lambda v: v,
        parse_value=lambda v: v,
    )

    children: List["GroupNode"]     # вложенные группы следующего уровня

    # --- агрегаты по деталям ---
    # detail_count: int               # уникальных позиций (num_detail + length)
    detail_quantity: int            # суммарное кол-во деталей
    total_weight_details: float     # суммарный вес деталей

    # --- агрегаты по маркам ---
    # mark_count: int                 # уникальных марок
    mark_quantity: int              # суммарное кол-во марок
    total_weight_marks: float       # суммарный вес марок


@strawberry.type
class Statistics:
    # # детали
    # detail_count: int
    detail_quantity: int
    total_weight_details: float
    # # марки
    # mark_count: int
    mark_quantity: int
    total_weight_marks: float


@strawberry.type
class ResponseGraph:
    nodes: List[GroupNode]
    statistics: Statistics
