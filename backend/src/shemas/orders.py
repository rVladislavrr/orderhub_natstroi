from datetime import date, datetime

from pydantic import BaseModel, UUID4

from src.models.orders import OrderStatus
from src.shemas.files import FileRead


class OrdersCreate(BaseModel):
    name: str
    internal_num_orders: int  # 646
    num_orders: str  # 361070
    num_project: str  # 2260-60(1)-23-kmd
    internal_create_date: date


class OrdersRead(OrdersCreate):
    uuid: UUID4
    is_active: bool
    status: OrderStatus = OrderStatus.NEW
    create_at: datetime

    class Config:
        json_encoders = {
            date: lambda dt: dt.strftime('%d.%m.%Y'),
            OrderStatus: lambda status: status.value
        }

class OrdersUpdate(BaseModel):
    name: str | None = None
    internal_num_orders: int | None = None # 646
    num_orders: str | None = None # 361070
    num_project: str | None = None # 2260-60(1)-23-kmd
    internal_create_date: date| None = None
    pass

class OrdersReadFile(OrdersRead):
    files: list[FileRead] | None = None

class KMDOrders(BaseModel):
    uuid: UUID4
    num_kmd: str

class OrdersReadFileMarks(OrdersReadFile):
    total_marks_count: float
    total_marks_count_uq: float
    total_marks_weight: float
    list_kmd: list[KMDOrders]
