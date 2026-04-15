from sqlalchemy import ForeignKey, UUID, UniqueConstraint, DECIMAL, Numeric

from src.models import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship


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
