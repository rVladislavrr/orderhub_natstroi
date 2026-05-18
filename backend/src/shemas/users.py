import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, Any
from uuid import UUID
from pydantic import BaseModel, UUID4, Field, field_validator, model_validator

class UserAuth(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=50)


class UsersBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=250)
    lastname: str = Field(..., min_length=3, max_length=250)
    is_login: bool = False
    is_active: bool = True


class UsersRequest(UsersBase, UserAuth):
    pass

class UsersUpdate(UsersRequest):
    password: str | None = Field(None, min_length=6, max_length=50)



class UsersCreate(UsersBase):
    username: str = Field(..., min_length=3, max_length=50)
    hash_password: str | None = Field(..., max_length=256)


class LevelEnum(int, Enum):
    NONE = 0
    READ = 1
    WRITE = 2


class CategoryEnum(str, Enum):
    STORAGE = "storage"
    ORDER = "order"
    QUEUES = "queues"
    ROLE = "role"


class Permission(BaseModel):
    permissions: str = Field(default='0000', max_length=10)

    model_config = {
        "from_attributes": True,
        "frozen": False,
        "extra": "forbid"
    }

    @field_validator('permissions')
    @classmethod
    def validate_levels(cls, v: str) -> str:
        for c in v:
            if not c.isdigit():
                raise ValueError(f'Каждый символ должен быть цифрой, получено: {c}')
            try:
                LevelEnum(int(c))
            except ValueError:
                raise ValueError(f'Каждый символ должен быть 0, 1 или 2, получено: {c}')
        return v

    @classmethod
    def from_dict(cls, permissions_dict: Dict[str, int]) -> 'Permission':
        levels_list = []
        for category in CategoryEnum:
            level_value = permissions_dict.get(category.value, 0)
            try:
                level = LevelEnum(level_value)
            except ValueError:
                raise ValueError(f'Уровень для {category.value} должен быть 0, 1 или 2, получено: {level_value}')
            levels_list.append(str(level.value))
        return cls(permissions=''.join(levels_list))

    def update_from_dict(self, permissions_dict: Dict[str, int]) -> None:
        for category_name, level_value in permissions_dict.items():
            for category in CategoryEnum:
                if category.value == category_name:
                    try:
                        level = LevelEnum(level_value)
                    except ValueError:
                        raise ValueError(f'Уровень для {category_name} должен быть 0, 1 или 2, получено: {level_value}')
                    self.set_level(category, level)
                    break
            else:
                raise ValueError(f'Неизвестная категория: {category_name}')

    def get_level(self, category: CategoryEnum) -> int:
        index = list(CategoryEnum).index(category)
        if index < len(self.permissions):  # Исправлено: levels -> permissions
            return int(self.permissions[index])
        return 0

    def set_level(self, category: CategoryEnum, level: LevelEnum) -> None:
        levels_list = list(self.permissions)
        index = list(CategoryEnum).index(category)
        if index >= len(levels_list):
            levels_list.extend(['0'] * (index - len(levels_list) + 1))
        levels_list[index] = str(level.value)
        self.permissions = ''.join(levels_list)

    def can_read(self, category: CategoryEnum) -> bool:
        return self.get_level(category) >= LevelEnum.READ.value

    def can_write(self, category: CategoryEnum) -> bool:
        return self.get_level(category) >= LevelEnum.WRITE.value

    @property
    def as_dict(self) -> Dict[str, int]:
        result = {}
        for i, cat in enumerate(CategoryEnum):
            if i < len(self.permissions):  # Исправлено: levels -> permissions
                result[cat.value] = int(self.permissions[i])
            else:
                result[cat.value] = 0
        return result

    def __str__(self) -> str:
        return self.permissions

    def __repr__(self) -> str:
        return f"Permission(permissions='{self.permissions}')"

    def __json__(self):
        return self.as_dict


class PermissionConverterMixin(BaseModel):

    @model_validator(mode='before')
    @classmethod
    def convert_permissions_string_to_object(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'permissions' in data and isinstance(data['permissions'], str):
                data['permissions'] = Permission(permissions=data['permissions'])
        elif hasattr(data, 'permissions') and isinstance(data.permissions, str):
            data.permissions = Permission(permissions=data.permissions)
        return data

    def model_dump(self, **kwargs) -> Dict[str, Any]:
        data = super().model_dump(**kwargs)

        if 'permissions' in data and hasattr(self.permissions, 'as_dict'):
            data['permissions'] = self.permissions.as_dict

        return data

class UsersReadPag(UsersBase):
    uuid: UUID4
    create_at: datetime


class UsersRead(UsersReadPag, PermissionConverterMixin):
    username: str = Field(..., min_length=3, max_length=50)
    permissions: Permission = Field(default_factory=lambda: Permission(permissions="0000"))


class Token(BaseModel):
    token_type: str = 'Bearer'
    accessToken: str


class UserInfo(PermissionConverterMixin):
    uuid: UUID4
    is_active: bool
    permissions: Permission = Field(default_factory=lambda: Permission(permissions="0000"))


class UserTokenCreate(BaseModel):
    sub: str = Field(..., alias='uuid')
    is_active: bool
    permissions: str

    @field_validator('sub', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

class Workers(BaseModel):
    name: str = Field(..., min_length=3, max_length=250)
    lastname: str = Field(..., min_length=3, max_length=250)
    uuid: UUID4

if __name__ == "__main__":
    user_data = {
        "uuid": uuid.uuid4(),
        "is_active": True,
        "permissions": "0120"
    }

    user = UserInfo.model_validate(user_data)
    print(f"После валидации: {user.permissions}")
    print(f"Права словарем: {user.permissions.as_dict}")
    print(f"Может читать storage: {user.permissions.can_read(CategoryEnum.STORAGE)}")
    print(f"Может писать order: {user.permissions.can_write(CategoryEnum.ORDER)}")

    response = user.model_dump()
    print(f"Ответ API: {response}")

    user.permissions.update_from_dict({"storage": 2, "order": 1})
    print(f"Обновленные права: {user.permissions.as_dict}")
