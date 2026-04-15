from pydantic import BaseModel

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


class MarksDetailsRead(MarksRead):
    details: list[DetailsRead]
