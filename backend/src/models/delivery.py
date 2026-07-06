from datetime import date
from decimal import Decimal

from sqlalchemy import UUID, ForeignKey, Numeric, String, UniqueConstraint, CheckConstraint, event
from sqlalchemy.orm import Mapped, mapped_column, relationship, Session

from src.models import Base


class DeliveryTruck(Base):
    __tablename__ = 'delivery_truck'

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment='Название/номер поставки')
    delivery_date: Mapped[date] = mapped_column(nullable=False, comment='Дата прибытия')
    note: Mapped[str | None] = mapped_column(String(500), nullable=True, comment='Примечание')

    items: Mapped[list['DeliveryItem']] = relationship(
        back_populates='truck', lazy='select', cascade='all, delete-orphan'
    )


class DeliveryItem(Base):
    __tablename__ = 'delivery_item'

    __table_args__ = (
        CheckConstraint('allocated_weight >= 0', name='ck_allocated_weight_non_negative'),
        CheckConstraint('allocated_weight <= total_weight', name='ck_allocated_not_exceed_total'),
        CheckConstraint('unit_weight > 0', name='ck_unit_weight_positive'),
        CheckConstraint('total_weight > 0', name='ck_total_weight_positive'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey('delivery_truck.id'), nullable=False)

    profile_type: Mapped[str] = mapped_column(nullable=False)
    profile_size: Mapped[str] = mapped_column(nullable=False)
    steel_grade: Mapped[str] = mapped_column(nullable=False)

    # Вес — главная единица учёта
    total_weight: Mapped[Decimal] = mapped_column(Numeric(15, 3), nullable=False, comment='Кг, общий вес позиции')
    unit_weight: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, comment='Кг на штуку (корректируется пользователем)')

    # Количество — справочно "по документам", не участвует в расчётах остатков
    total_quantity: Mapped[Decimal] = mapped_column(Numeric(15, 3), nullable=False, comment='Штук по документам (справочно)')

    # Денормализованный агрегат: сумма всех DeliveryAllocation.allocated_weight
    # Обновляется только через recalculate_allocated_weight() — не трогать напрямую
    allocated_weight: Mapped[Decimal] = mapped_column(
        Numeric(15, 3), nullable=False, server_default='0',
        comment='Кг, уже распределено в КМД. Синхронизируется через recalculate_allocated_weight()'
    )

    @property
    def remaining_weight(self) -> Decimal:
        """Остаток в кг. Всегда >= 0 благодаря CHECK constraint."""
        return (self.total_weight - self.allocated_weight).quantize(Decimal('0.001'))

    @property
    def remaining_quantity(self) -> Decimal:
        """Остаток в штуках = остаток веса / вес одной штуки."""
        if self.unit_weight and self.unit_weight > 0:
            return (self.remaining_weight / self.unit_weight).quantize(Decimal('0.001'))
        return Decimal('0')

    def recalculate_allocated_weight(self) -> None:
        """
        Пересчитывает allocated_weight как сумму всех связанных DeliveryAllocation.
        Вызывать после любого изменения аллокаций этой позиции.

        Пример использования в роуте:
            item.allocations.append(new_alloc)
            await session.flush()
            item.recalculate_allocated_weight()
        """
        self.allocated_weight = sum(
            (a.allocated_weight for a in self.allocations),
            Decimal('0')
        )

    # Связи
    truck: Mapped['DeliveryTruck'] = relationship(back_populates='items')
    allocations: Mapped[list['DeliveryAllocation']] = relationship(
        back_populates='delivery_item',
        lazy='select',
        cascade='all, delete-orphan',
    )


class DeliveryAllocation(Base):
    """
    Распределение конкретной позиции поставки в КМД.
    Одна позиция — несколько КМД. UniqueConstraint гарантирует
    что на пару (item, kmd) всегда одна запись — обновляем её, не дублируем.

    ВАЖНО: после изменения/удаления аллокации всегда вызывать
    delivery_item.recalculate_allocated_weight() чтобы не разъехался кеш.
    """
    __tablename__ = 'delivery_allocation'

    __table_args__ = (
        UniqueConstraint('delivery_item_id', 'kmd_uuid', name='unique_item_kmd'),
        CheckConstraint('allocated_weight > 0', name='ck_allocation_weight_positive'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    delivery_item_id: Mapped[int] = mapped_column(ForeignKey('delivery_item.id'), nullable=False)
    kmd_uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('kmd.uuid'), nullable=False,
        comment='КМД в который распределяется металл'
    )
    allocated_weight: Mapped[Decimal] = mapped_column(
        Numeric(15, 3), nullable=False, comment='Кг из этой позиции в этот КМД'
    )

    delivery_item: Mapped['DeliveryItem'] = relationship(back_populates='allocations', lazy='select')
    kmd: Mapped['KMD'] = relationship(lazy='select')