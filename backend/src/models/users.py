from sqlalchemy import UUID, String, Boolean, Index, VARCHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from src.models import Base


class Users(Base):
    __tablename__ = 'users'

    uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        comment='Public user UUID'
    )

    username: Mapped[str] = mapped_column(
        String(50),
        nullable=True,
        unique=True,
        index=True,
        comment='Unique username'
    )

    hash_password: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
        comment='Hash password'
    )

    name: Mapped[str] = mapped_column(
        nullable=False,
    )

    lastname: Mapped[str] = mapped_column(
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        server_default='true',
        index=True,
        comment='Active user'
    )

    is_login: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
        comment='Can the user login?'
    )

    permissions: Mapped[str] = mapped_column(VARCHAR(10), default="", nullable=False)

    work_entries: Mapped[list['RelUserDel']] = relationship(
        back_populates='user',
        lazy="select",
        cascade="all, delete-orphan"
    )
