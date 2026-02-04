from datetime import datetime

from pydantic import BaseModel, EmailStr, UUID4, Field


class UsersBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, )
    email: EmailStr = Field(..., min_length=3, max_length=256)

class UsersRequest(UsersBase):
    password: str = Field(..., min_length=6, max_length=50)

class UsersCreate(UsersBase):
    hashed_password: str = Field(...,  max_length=256)

class UsersUpdate(UsersBase):
    pass

class UsersRead(UsersBase):
    uuid: UUID4
    is_active: bool
    is_verified: bool
    create_at: datetime
    update_at: datetime
    delete_at: datetime | None = None

