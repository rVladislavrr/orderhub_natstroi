from pydantic import BaseModel

from src.models.rel_markadet import DetailsStatus


class DetailsBase(BaseModel):
    num_detail: str
    type: str
    size: str
    width: float | None = None
    length: float
    weight: float
    steel_grade: str

class DetailsRead(DetailsBase):
    id: int

class RelMarkaBase(BaseModel):
    id: int
    details_quantity: int
    remaining_quantity: int
    status: DetailsStatus = DetailsStatus.NEW
    detail: DetailsRead
    operation: str | None = None
