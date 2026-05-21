from sqlalchemy import ForeignKey, UUID, UniqueConstraint, DECIMAL, Numeric
from sqlalchemy.dialects.postgresql import ENUM as sqlEnum
from enum import Enum

from src.models import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship


class MarkStatus(str, Enum):
    NEW = "Новый"
    IN_PROGRESS = "В работе"
    COMPLETED = "Готов"          # все детали сделаны, можно собирать
    ASSEMBLED = "Собран"         # марка собрана (часть или все)
    SHIPPED = "Отгружен"         # марка отгружена


class Marks(Base):
    __tablename__ = 'marks'

    __table_args__ = (
        UniqueConstraint('kmd_uuid', 'title', name='unique_kmd_mark'),
    )

    id: Mapped[int] = mapped_column(
        autoincrement=True,
        primary_key=True,
        unique=True,
        comment='Айди марки'
    )

    title: Mapped[str] = mapped_column(
        nullable=False,
        comment='Название марки Б2-30'
    )

    name: Mapped[str] = mapped_column(
        nullable=False,
        comment='наименование марки Балка'
    )

    quantity: Mapped[int] = mapped_column(
        nullable=False,
        comment='Количество марок на заказ'
    )

    weight: Mapped[DECIMAL] = mapped_column(
        Numeric(15, 3),
        nullable=False,
        comment='Вес одной марки'
    )

    cooperation: Mapped[str] = mapped_column(
        nullable=True,
        comment='Кооперация'
    )

    mounting_part: Mapped[str] = mapped_column(
        nullable=True,
        comment='Признак монтажной детали'
    )

    status: Mapped[str] = mapped_column(
        sqlEnum(MarkStatus, name='markstatus', create_type=False),
        nullable=False,
        default=MarkStatus.NEW,
        server_default='NEW',
        comment='Статус марки',
    )

    # Сколько марок уже собрано
    assembled_quantity: Mapped[int] = mapped_column(
        nullable=False,
        server_default='0',
        comment='Количество собранных марок'
    )

    # Сколько марок отгружено
    shipped_quantity: Mapped[int] = mapped_column(
        nullable=False,
        server_default='0',
        comment='Количество отгруженных марок'
    )

    kmd_uuid: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('kmd.uuid'))

    kmd: Mapped['KMD'] = relationship(
        back_populates='marks',
        lazy="select"
    )

    rel_markadel_entries: Mapped[list['RelMarkaDel']] = relationship(
        back_populates='mark',
        lazy="select",
    )

    details: Mapped[list['Details']] = relationship(
        secondary='rel_markadel',
        viewonly=True,
        lazy="select"
    )

    assembly_entries: Mapped[list['RelUserMark']] = relationship(
        back_populates='mark',
        lazy="select",
    )

    shipment_entries: Mapped[list['MarkShipment']] = relationship(
        back_populates='mark',
        lazy="select",
    )