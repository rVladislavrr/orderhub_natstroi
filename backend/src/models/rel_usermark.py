from datetime import date

from sqlalchemy import ForeignKey, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base


class RelUserMark(Base):
    """
    Кто, когда и сколько марок собрал.
    Аналог RelUserDel, но для марок.
    """
    __tablename__ = 'rel_user_mark'

    id: Mapped[int] = mapped_column(
        primary_key=True,
        unique=True,
        autoincrement=True,
        comment='ID записи сборки'
    )

    user_uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('users.uuid'),
        nullable=False,
    )

    mark_id: Mapped[int] = mapped_column(
        ForeignKey('marks.id'),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(
        nullable=False,
        comment='Количество собранных марок'
    )

    assembly_date: Mapped[date] = mapped_column(
        nullable=False,
        comment='Дата сборки'
    )

    user: Mapped['Users'] = relationship(lazy="select")
    mark: Mapped['Marks'] = relationship(back_populates='assembly_entries', lazy="select")