from sqlalchemy import ForeignKey, UUID, UniqueConstraint

from src.models import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Numeric, DECIMAL



class Details(Base):
    __tablename__ = 'details'

    __table_args__ = (
        UniqueConstraint('kmd_uuid', 'num_detail', name='unique_kmd_detail'),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        unique=True,
        comment='ID детали (никак не связан с номером)',
        autoincrement=True
    )

    num_detail: Mapped[str] = mapped_column(
        nullable=False,
        index=True,
        comment='Номер детали одинаковый на заказ, разный между заказами',
    )

    type: Mapped[str] = mapped_column(
        nullable=False,
        index=True,
        comment='Прокат, пример Лист Труба',
    )

    size: Mapped[str] = mapped_column(
        nullable=False,
        comment='Типоразмер проката'
    )

    width: Mapped[float] = mapped_column(
        nullable=True,
        comment='Ширина иногда отсутствует'
    )

    length: Mapped[float] = mapped_column(
        nullable=False,
        comment='Длинна всегда указана'
    )

    weight: Mapped[DECIMAL] = mapped_column(
        Numeric(15, 3),
        nullable=False,
    )

    steel_grade: Mapped[str] = mapped_column(
        nullable=False,
        comment='Марка стали'
    )

    operation: Mapped[str] = mapped_column(
        nullable=True,
        comment='Операции наверное могут быт пустыми'
    )

    kmd_uuid: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('kmd.uuid'))

    kmd: Mapped['KMD'] = relationship(
        back_populates='details',
        lazy="select"
    )

    rel_markadel_entries: Mapped[list['RelMarkaDel']] = relationship(
        back_populates='detail',
        lazy="select",
    )
