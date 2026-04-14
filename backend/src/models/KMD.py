import uuid
from sqlalchemy import UUID, ForeignKey, select, func, Numeric, DECIMAL
from sqlalchemy.orm import Mapped, mapped_column, relationship, column_property

from src.models import Base, Marks


class KMD(Base):
    #  Выглядит как подзаказ в основном заказе
    __tablename__ = 'kmd'

    uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        comment='kdm UUID'
    )

    num_kmd: Mapped[str] = mapped_column(
        index=True,
        nullable=False,
        comment="Номер КМД",
        unique=True,
    )

    order_uuid: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('orders.uuid'))

    count_marks_uq: Mapped[int] = mapped_column(nullable=False, server_default='0')
    count_marks: Mapped[int] = mapped_column(nullable=False, server_default='0')
    marks_weight: Mapped[DECIMAL] = mapped_column( Numeric(20, 3), nullable=False, server_default='0')

    order: Mapped['Orders'] = relationship(
        back_populates='kmd_list',
        lazy="select"
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


