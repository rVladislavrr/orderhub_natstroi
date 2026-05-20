import uuid
from enum import Enum

from src.models import Base
# from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import UUID
from sqlalchemy.dialects.postgresql import ENUM as sqlEnum
from datetime import date

class OrderStatus(str, Enum):
    NEW = "Новый"
    IN_PROGRESS = "В работе"
    COMPLETED = "Завершен"
    CANCELLED = "Отменен"

class Orders(Base):
    __tablename__ = 'orders'

    uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        comment='Public order UUID'
    )
    name: Mapped[str] = mapped_column(
        nullable=False,
    )

    internal_num_orders: Mapped[int] = mapped_column(
        nullable=False,
        comment='Внутренний номер заказа',
        unique=True,
    )

    num_orders: Mapped[str] = mapped_column(
        nullable=False,
        comment='Номер заказа',
        unique=True,
    )

    num_project: Mapped[str] = mapped_column(
        nullable=False,
        comment='Номер проекта'
    )

    internal_create_date: Mapped[date] = mapped_column(
        nullable=False,
        comment='Дата создания самого заказа не в приложении'
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
    )

    status: Mapped[str] = mapped_column(
        sqlEnum(OrderStatus, name='orderstatus', create_type=False),
        nullable=False,
        default=OrderStatus.NEW,
        comment='Статус заказа',
    )

    files: Mapped[list['Files']] = relationship(back_populates='order', lazy="select")

    kmd_list: Mapped[list['KMD']] = relationship(
        back_populates='order',
        lazy="select",
    )