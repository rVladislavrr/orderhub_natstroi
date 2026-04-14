import uuid
from enum import Enum

from src.models import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import UUID, BIGINT, ForeignKey
from sqlalchemy.dialects.postgresql import ENUM as sqlEnum, JSONB


class FileStatus(str, Enum):
    NEW = "Только добавлен"
    IN_PROGRESS = "Обрабатывается"
    COMPLETED = "Обработан"
    ERROR = "Ошибочный"


class Files(Base):
    __tablename__ = 'files'

    uuid: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        comment='Public file UUID'
    )

    file_name: Mapped[str] = mapped_column(
        nullable=False,
    )

    file_size: Mapped[int] = mapped_column(BIGINT, nullable=False)

    status: Mapped[str] = mapped_column(
        sqlEnum(FileStatus, name='filestatus', create_type=False),
        nullable=False,
        default=FileStatus.NEW,
        comment='Статус файла',
    )

    order_uuid: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('orders.uuid'))

    hash_sum: Mapped[str] = mapped_column(nullable=False, unique=True, index=True)

    comment: Mapped[JSONB] = mapped_column(JSONB, nullable=True, )

    order: Mapped['Orders'] = relationship(back_populates='files', lazy="select")