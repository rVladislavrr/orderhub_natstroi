from pydantic import BaseModel, UUID4


class KMDBase(BaseModel):
    num_kmd: str
    count_marks_uq: int
    count_marks: int
    marks_weight: float
    shipped_marks_weight: float
    shipped_marks_count: int

class KMDRead(KMDBase):
    uuid: UUID4