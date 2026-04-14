from pydantic import BaseModel, Field, field_validator
from enum import Enum
from typing import List, Dict


class LevelEnum(int, Enum):
    NONE = 0
    READ = 1
    WRITE = 2


class CategoryEnum(str, Enum):
    STORAGE = "storage"
    ORDER = "order"
    PRODUCT = "product"
    ROLE = "role"


class Permission(BaseModel):
    levels: str = Field(default='0000', max_length=10)

    model_config = {
        "frozen": False,
        "extra": "forbid"
    }

    @field_validator('levels')
    def validate_levels(cls, v):
        if not all(c.isdigit() and 0 <= int(c) <= 2 for c in v):
            raise ValueError(f'Каждый символ должен быть 0, 1 или 2, получено: {v}')
        return v

    @classmethod
    def from_dict(cls, permissions_dict: Dict[str, int]) -> 'Permission':
        levels_list = []
        for category in CategoryEnum:
            level = permissions_dict.get(category.value, 0)
            if level not in [0, 1, 2]:
                raise ValueError(f'Уровень для {category.value} должен быть 0, 1 или 2, получено: {level}')
            levels_list.append(str(level))
        return cls(levels=''.join(levels_list))

    def update_from_dict(self, permissions_dict: Dict[str, int]) -> None:
        for category_name, level in permissions_dict.items():
            for category in CategoryEnum:
                if category.value == category_name:
                    if level not in [0, 1, 2]:
                        raise ValueError(f'Уровень для {category_name} должен быть 0, 1 или 2')
                    self.set_level(category, LevelEnum(level))
                    break
            else:
                raise ValueError(f'Неизвестная категория: {category_name}')

    @classmethod
    def from_dict_flexible(cls, permissions_dict: Dict[str, int]) -> 'Permission':
        max_index = 0
        temp_dict = {}

        for category_name, level in permissions_dict.items():
            for i, category in enumerate(CategoryEnum):
                if category.value == category_name:
                    temp_dict[i] = str(level)
                    max_index = max(max_index, i)
                    break

        levels_list = ['0'] * (max_index + 1)
        for idx, level_str in temp_dict.items():
            levels_list[idx] = level_str

        return cls(levels=''.join(levels_list))

    def get_level(self, category: CategoryEnum) -> int:
        index = list(CategoryEnum).index(category)
        if index < len(self.levels):
            return int(self.levels[index])
        return 0

    def set_level(self, category: CategoryEnum, level: LevelEnum) -> None:
        levels_list = list(self.levels)
        index = list(CategoryEnum).index(category)
        if index >= len(levels_list):
            levels_list.extend(['0'] * (index - len(levels_list) + 1))
        levels_list[index] = str(level.value)
        self.levels = ''.join(levels_list)

    def can_read(self, category: CategoryEnum) -> bool:
        return self.get_level(category) >= LevelEnum.READ.value

    def can_write(self, category: CategoryEnum) -> bool:
        return self.get_level(category) >= LevelEnum.WRITE.value

    @property
    def as_dict(self) -> Dict[str, int]:
        result = {}
        for i, cat in enumerate(CategoryEnum):
            if i < len(self.levels):
                result[cat.value] = int(self.levels[i])
            else:
                result[cat.value] = 0
        return result


if __name__ == '__main__':
    # 3. Обновление существующего объекта
    perm3 = Permission(levels="0000")
    perm3.update_from_dict({'product': 1, 'storage': 2,})
    print(perm3.levels)  # "2010"
    print(perm3.as_dict)  # {'storage': 2, 'order': 0, 'product': 1, 'role': 0}

    # 4. Гибкий конструктор (порядок не важен)
    perm4 = Permission.from_dict_flexible({'role': 2, 'storage': 1})
    print(perm4.levels)  # "1002" (storage на 1й позиции, role на 3й)

    # 5. Преобразование туда-обратно
    original_dict = {'storage': 2, 'order': 1, 'product': 2, 'role': 0}
    perm5 = Permission.from_dict(original_dict)
    restored_dict = perm5.as_dict
    assert original_dict == restored_dict  # True
    print(f"Туда-обратно: {original_dict} -> {perm5.levels} -> {restored_dict}")
