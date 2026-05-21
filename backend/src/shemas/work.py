from datetime import date

from pydantic import BaseModel, UUID4, Field


class WorkCreateRequest(BaseModel):
    user_uuid: UUID4 = Field(..., description="UUID пользователя")
    rel_markadel_id: int = Field(..., description="ID связи марка-деталь")
    quantity: int = Field(..., ge=1, description="Количество выполненных деталей")
    completion_date: date = Field(default_factory=date.today, description="Дата выполнения")


class WorkCreateResponse(BaseModel):
    work_id: int
    rel_markadel_id: int
    user_uuid: UUID4
    quantity: int
    completion_date: date
    remaining_quantity: int
    detail_status: str
    message: str
    mark_status: str


class WorkUserInfo(BaseModel):
    uuid: UUID4
    name: str
    lastname: str


class WorkRelInfo(BaseModel):
    id: int
    mark_title: str  # Б2-30
    mark_name: str  # Балка
    detail_num: str  # номер детали
    detail_type: str  # Лист / Труба / ...
    detail_size: str  # типоразмер
    kmd_num: str  # номер КМД
    internal_num_orders: int  # номер заказа
    order_name: str  # название заказа


class WorkLogItem(BaseModel):
    id: int
    user: WorkUserInfo
    relation: WorkRelInfo
    quantity: int
    completion_date: date

