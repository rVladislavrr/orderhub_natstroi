import uuid
from enum import Enum

from sqlalchemy import UUID, ForeignKey, Numeric, DECIMAL
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ENUM as sqlEnum

from src.models import Base


class KMDStatus(str, Enum):
    NEW = "Новый"
    IN_PROGRESS = "В работе"
    COMPLETED = "Завершен"
    CANCELLED = "Отменен"


class KMD(Base):
    __tablename__ = 'kmd'

    uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        comment='KMD UUID'
    )

    status: Mapped[str] = mapped_column(
        sqlEnum(KMDStatus, name='kmdstatus', create_type=False),
        nullable=False,
        default=KMDStatus.NEW,
        server_default='NEW',
        comment='Статус КМД',
    )

    num_kmd: Mapped[str] = mapped_column(
        index=True,
        nullable=False,
        unique=True,
        comment="Номер КМД",
    )

    order_uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('orders.uuid'),
    )

    # --- Плановые агрегаты (обновляются при загрузке файла) ---
    count_marks_uq: Mapped[int] = mapped_column(
        nullable=False,
        server_default='0',
        comment='Количество уникальных марок'
    )
    count_marks: Mapped[int] = mapped_column(
        nullable=False,
        server_default='0',
        comment='Общее количество марок (с учётом quantity)'
    )
    marks_weight: Mapped[DECIMAL] = mapped_column(
        Numeric(20, 3),
        nullable=False,
        server_default='0',
        comment='Общий вес всех марок, кг'
    )

    # --- Фактические агрегаты (обновляются при отгрузке) ---
    shipped_marks_count: Mapped[int] = mapped_column(
        nullable=False,
        server_default='0',
        comment='Количество отгруженных марок'
    )
    shipped_marks_weight: Mapped[DECIMAL] = mapped_column(
        Numeric(20, 3),
        nullable=False,
        server_default='0',
        comment='Вес отгруженных марок, кг'
    )

    # --- Связи ---
    order: Mapped['Orders'] = relationship(
        back_populates='kmd_list',
        lazy="select",
    )
    details: Mapped[list['Details']] = relationship(
        back_populates='kmd',
        lazy="select",
    )
    marks: Mapped[list['Marks']] = relationship(
        back_populates='kmd',
        lazy="select",
    )
    rel_markadel_entries: Mapped[list['RelMarkaDel']] = relationship(
        back_populates='kmd',
        lazy="select",
    )