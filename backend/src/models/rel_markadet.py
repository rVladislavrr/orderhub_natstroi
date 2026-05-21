from enum import Enum

from sqlalchemy import ForeignKey, UUID, UniqueConstraint

from src.models import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ENUM as sqlEnum

class DetailsStatus(str, Enum):
    NEW = "Новый"
    IN_PROGRESS = "В работе"
    COMPLETED = "Завершен"
    CANCELLED = "Удален"


class RelMarkaDel(Base):
    __tablename__ = 'rel_markadel'

    __table_args__ = (
        UniqueConstraint('marks_id', 'details_id', name='unique_mark_detail'),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        unique=True,
        comment='ID связи',
        autoincrement=True
    )

    marks_id: Mapped[int] = mapped_column(
        ForeignKey('marks.id'),
        nullable=False,
    )

    details_id: Mapped[int] = mapped_column(
        ForeignKey('details.id'),
        nullable=False,
    )

    details_quantity: Mapped[int] = mapped_column(
        nullable=False,
        comment='Суммарное количество деталей на все одинаковые марки'
    )

    remaining_quantity: Mapped[int] = mapped_column(
        nullable=False,
        comment='Оставшееся количество деталей'
    )

    que_num: Mapped[str] = mapped_column(
        nullable=True,
        comment='Номер очереди'
    )

    status: Mapped[str] = mapped_column(
        sqlEnum(DetailsStatus, name='detailsstatus', create_type=False),
        nullable=False,
        default=DetailsStatus.NEW,
        comment='Статус детали',
    )

    operation: Mapped[str] = mapped_column(
        nullable=True,
        comment='Операции наверное могут быт пустыми'
    )

    kmd_uuid: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('kmd.uuid'))

    kmd: Mapped['KMD'] = relationship(
        back_populates='rel_markadel_entries',
        lazy="select"
    )

    mark: Mapped['Marks'] = relationship(
        back_populates='rel_markadel_entries',
        lazy="select"
    )

    detail: Mapped['Details'] = relationship(
        back_populates='rel_markadel_entries',
        lazy="select"
    )

    user_work_entries: Mapped[list['RelUserDel']] = relationship(
        back_populates='rel_markadel',
        lazy="select",
    )