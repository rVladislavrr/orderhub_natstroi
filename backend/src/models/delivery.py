"""
DeliveryTruck      — машина/поставка
DeliveryItem       — позиция металла в машине (профиль + сталь + вес)
DeliveryAllocation — распределение позиции в конкретный КМД

Остаток (remaining_weight = total_weight - allocated_weight) — это складской запас.
Любой заказ может забрать металл со склада через POST /delivery/stock/allocate.
"""

from datetime import date

from sqlalchemy import UUID, ForeignKey, Numeric, String, UniqueConstraint, DECIMAL
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base


class DeliveryTruck(Base):
    __tablename__ = 'delivery_truck'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment='Название/номер поставки')
    delivery_date: Mapped[date] = mapped_column(nullable=False, comment='Дата прибытия')
    note: Mapped[str] = mapped_column(String(500), nullable=True, comment='Примечание')

    items: Mapped[list['DeliveryItem']] = relationship(
        back_populates='truck', lazy='select', cascade='all, delete-orphan'
    )


class DeliveryItem(Base):
    __tablename__ = 'delivery_item'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey('delivery_truck.id'), nullable=False)

    profile_type: Mapped[str] = mapped_column(nullable=False, comment='Тип: Лист, Труба...')
    profile_size: Mapped[str] = mapped_column(nullable=False, comment='Типоразмер: 10, 25Ш1...')
    steel_grade: Mapped[str] = mapped_column(nullable=False, comment='Марка стали')

    total_weight: Mapped[DECIMAL] = mapped_column(
        Numeric(15, 3), nullable=False, comment='Общий вес в поставке, кг'
    )
    allocated_weight: Mapped[DECIMAL] = mapped_column(
        Numeric(15, 3), nullable=False, server_default='0',
        comment='Распределено по КМД, кг'
    )

    # remaining_weight = total_weight - allocated_weight — это и есть склад
    # не храним отдельно, считаем через property

    truck: Mapped['DeliveryTruck'] = relationship(back_populates='items', lazy='select')
    allocations: Mapped[list['DeliveryAllocation']] = relationship(
        back_populates='delivery_item', lazy='select', cascade='all, delete-orphan'
    )

    @property
    def remaining_weight(self) -> float:
        return round(float(self.total_weight) - float(self.allocated_weight), 3)


class DeliveryAllocation(Base):
    """
    Распределение конкретной позиции поставки в КМД.
    Одна позиция может быть распределена в несколько КМД.
    UniqueConstraint — чтобы не было двух записей на одну пару item+kmd,
    вместо этого обновляем существующую запись.
    """
    __tablename__ = 'delivery_allocation'

    __table_args__ = (
        UniqueConstraint('delivery_item_id', 'kmd_uuid', name='unique_item_kmd'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    delivery_item_id: Mapped[int] = mapped_column(ForeignKey('delivery_item.id'), nullable=False)
    kmd_uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('kmd.uuid'), nullable=False,
        comment='КМД в который распределяется металл'
    )
    allocated_weight: Mapped[DECIMAL] = mapped_column(
        Numeric(15, 3), nullable=False, comment='Кг из этой позиции в этот КМД'
    )

    delivery_item: Mapped['DeliveryItem'] = relationship(back_populates='allocations', lazy='select')
    kmd: Mapped['KMD'] = relationship(lazy='select')