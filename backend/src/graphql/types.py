import strawberry
from typing import List, Optional


@strawberry.type
class DetailType:
    # Все поля из таблицы Details
    id: int
    num_detail: str
    type: str
    size: str
    width: Optional[float]
    length: float
    weight: float
    steel_grade: str
    operation: Optional[str]

    # Поля из Marks
    mark_title: str
    mark_name: str
    mark_quantity: int
    mark_weight: float
    mounting_part: str

    # Поля из RelMarkaDel
    quantity: int
    que_num: str

    # Агрегированные поля
    total_weight_for_position: float
    total_weight_for_mark: float


@strawberry.type
class GroupNode:
    level: str  # Название поля по которому группируем
    value: str  # Значение в этой группе
    children: List['GroupNode']
    total_quantity: int
    total_weight: float
    total_count: int  # Количество уникальных позиций
    total_mark_weight: float
    total_quantity_marks: int

@strawberry.type
class Statistics:
    total_weight: float
    total_quantity: int

@strawberry.type
class ResponseGraph:
    nodes: List[GroupNode]
    statistics: Statistics

@strawberry.input
class GroupByLevel:
    field: str  # Любое поле: "type", "steel_grade", "size", "num_detail", "mark_title",
    # "length", "width", "weight", "quantity" и т.д.
    order: int


@strawberry.input
class HierarchyFilters:
    # Фильтры по любым полям
    steel_grade: Optional[List[str]] = None
    type: Optional[List[str]] = None
    size: Optional[List[str]] = None
    num_detail: Optional[List[str]] = None
    mark_name: Optional[List[str]] = None
    que_num: Optional[List[str]] = None
    length: Optional[List[int]] = None
    mounting_part: Optional[List[str]] = None


    def to_str(self) -> str:
        result = []
        for attr_name in self.__annotations__:
            value = getattr(self, attr_name)
            if value and isinstance(value, list):
                value = list(map(str, value))
                result.append(f"{attr_name}={','.join(value)}")
            if value and isinstance(value, str):
                result.append(f"{attr_name}={value}")
            if value and isinstance(value, int):
                result.append(f"{attr_name}={str(value)}")
        return ";".join(result)



GroupNode.__annotations__['children'] = List[GroupNode]
