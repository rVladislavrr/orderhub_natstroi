from datetime import date

from pydantic import BaseModel, UUID4, Field

from src.shemas.details import DetailsRead


class MarksBase(BaseModel):
    id: int
    title: str
    name: str
    quantity: int
    weight: float
    cooperation: str | None = None
    mounting_part: str | None = None


class MarksRead(MarksBase):
    id: int
    status: str
    # Сколько марок уже собрано
    assembled_quantity: int
    # Сколько марок отгружено
    shipped_quantity: int


class MarksDetailsRead(MarksRead):
    details: list[DetailsRead]


class AssembleRequest(BaseModel):
    user_uuid: UUID4 = Field(..., description="UUID пользователя")
    quantity: int = Field(..., ge=1, description="Количество собранных марок")
    assembly_date: date = Field(default_factory=date.today)


class AssembleResponse(BaseModel):
    assembly_id: int
    mark_id: int
    mark_title: str
    user_uuid: UUID4
    quantity: int
    assembly_date: date
    assembled_quantity: int  # всего собрано на данный момент
    total_quantity: int  # сколько марок всего нужно
    mark_status: str
    message: str


class ShipRequest(BaseModel):
    user_uuid: UUID4 = Field(..., description="UUID пользователя, оформившего отгрузку")
    quantity: int = Field(..., ge=1, description="Количество отгружаемых марок")
    shipment_date: date = Field(default_factory=date.today)
    note: str | None = Field(None, max_length=500, description="Примечание")


class ShipResponse(BaseModel):
    shipment_id: int
    mark_id: int
    mark_title: str
    user_uuid: UUID4
    quantity: int
    shipment_date: date
    shipped_quantity: int  # всего отгружено на данный момент
    assembled_quantity: int  # всего собрано
    total_quantity: int
    mark_status: str
    message: str


class AssemblyHistoryItem(BaseModel):
    id: int
    type: str  # "assembly" или "shipment"
    user_name: str
    user_lastname: str
    quantity: int
    event_date: date


class MarkHistoryResponse(BaseModel):
    mark_id: int
    mark_title: str
    mark_name: str
    total_quantity: int
    assembled_quantity: int
    shipped_quantity: int
    status: str
    history: list[AssemblyHistoryItem]
