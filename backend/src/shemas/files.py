from pydantic import BaseModel, UUID4
from src.models import files

class FileBase(BaseModel):
    file_name: str
    file_size: int

class FileCreate(FileBase):
    order_uuid: UUID4
    hash_sum: str

class FileUpdate(FileBase):
    pass

class Comment(BaseModel):
    mark: str
    detail: list[str]
    num_details: str

class FileRead(FileBase):
    uuid: UUID4
    status: files.FileStatus
    comment: list[Comment] | None = None


