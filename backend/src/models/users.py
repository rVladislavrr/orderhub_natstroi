from sqlalchemy import UUID, String, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column
import uuid

from src.models import Base


class Users(Base):
    __tablename__ = 'users'

    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_username', 'username'),
        Index('idx_users_is_active', 'is_active'),
        Index('idx_users_create_at', 'create_at'),
    )

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

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        comment='Unique email address'
    )

    hash_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment='Hash password'
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        server_default='true',
        index=True,
        comment=' Active user'
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default='false',
        comment='Verified user or confirmed email'
    )

    # last_login_at: Mapped[datetime] = mapped_column(
    #     DateTime(timezone=True),
    #     nullable=True,
    #     comment='Дата последнего входа'
    # )