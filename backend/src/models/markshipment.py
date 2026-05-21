from datetime import date

from sqlalchemy import ForeignKey, UUID, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base


class MarkShipment(Base):
    """
    Отгрузка марок. Можно отгружать только собранные марки.
    """
    __tablename__ = 'mark_shipment'

    id: Mapped[int] = mapped_column(
        primary_key=True,
        unique=True,
        autoincrement=True,
        comment='ID отгрузки'
    )

    mark_id: Mapped[int] = mapped_column(
        ForeignKey('marks.id'),
        nullable=False,
    )

    user_uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('users.uuid'),
        nullable=False,
        comment='Кто оформил отгрузку'
    )

    quantity: Mapped[int] = mapped_column(
        nullable=False,
        comment='Количество отгруженных марок'
    )

    shipment_date: Mapped[date] = mapped_column(
        nullable=False,
        comment='Дата отгрузки'
    )

    note: Mapped[str] = mapped_column(
        String(500),
        nullable=True,
        comment='Примечание к отгрузке'
    )

    user: Mapped['Users'] = relationship(lazy="select")
    mark: Mapped['Marks'] = relationship(back_populates='shipment_entries', lazy="select")