from src.shemas import orders
from pydantic import BaseModel

from src.shemas.details import RelMarkaBase
from src.shemas.marks import MarksDetailsRead, MarksRead

class Filters(BaseModel):
    name: str | None = None
    count: int

class PaginationInfo(BaseModel):
    page: int
    limit: int
    total_items: int
    total_pages: int
    has_more: bool
    has_previous: bool
    next_page: int | None
    previous_page: int | None


class PaginatedResponseOrder(BaseModel):
    orders: list[orders.OrdersRead]
    pagination: PaginationInfo


class PaginatedResponseMarks(BaseModel):
    marks: list[MarksRead]
    pagination: PaginationInfo


class PaginatedResponseDetails(BaseModel):
    details: list[RelMarkaBase]
    pagination: PaginationInfo
