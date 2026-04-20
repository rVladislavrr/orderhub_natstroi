from sqlalchemy import UUID, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from src.models import Base


class RelUserDel(Base):
    __tablename__ = 'rel_userdel'

    id: Mapped[int] = mapped_column(
        primary_key=True,
        unique=True,
        comment='ID связи',
        autoincrement=True
    )

    user_uuid: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.uuid'))
    rel_markadel_id: Mapped[int] = mapped_column(ForeignKey('rel_markadel.id'))
    quantity: Mapped[int] = mapped_column(nullable=False,
                                          comment='Количество сделанных деталей')

    completion_date: Mapped[date] = mapped_column(nullable=False, comment='Дата выполнения')

    user: Mapped['Users'] = relationship(
        back_populates='work_entries',
        lazy="select"
    )

    rel_markadel: Mapped['RelMarkaDel'] = relationship(
        back_populates='user_work_entries',
        lazy="select"
    )