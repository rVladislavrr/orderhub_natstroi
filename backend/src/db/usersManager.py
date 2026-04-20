import hashlib
import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.base import BaseManager
from src.models import Users
from src.shemas.users import UsersCreate, UsersRead, UsersUpdate, UsersRequest
from src.utils.hash import create_hash

database_logger = logging.getLogger("UsersManager")


class UsersManager(BaseManager[UsersCreate, UsersRead, UsersUpdate, Users]):
    model = Users
    create_schema = UsersCreate
    read_schema = UsersRead
    update_schema = UsersUpdate

    async def create(self, create_data: UsersRequest, session: AsyncSession | None = None,
                     request_id: str | None = None) -> UsersRead:
        database_logger.debug(f"{request_id} | Создание юзера {create_data.name}")
        if create_data.password:
            hash_password = create_hash(create_data.password)
        else:
            create_data.is_login = False
            hash_password = None
        user = await super().create(UsersCreate(**create_data.model_dump(), hash_password=hash_password),
                                    session=session, request_id=request_id)
        database_logger.debug(f"{request_id} | Пользователь создан {user.uuid}")
        return user

    @staticmethod
    async def authorization(session: AsyncSession, user_data, request_id):
        try:
            query = select(Users).where(Users.username == user_data.username,)
            user = (await session.execute(query)).scalar()
            if user is None:
                database_logger.info(
                    "User authorization failed 'Email wrong'",
                    extra={
                        "username": user_data.username,
                        "request_id": request_id,
                    }
                )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"msg": "Email or password wrong",
                                                                                      "request_id": request_id})

            if not user.is_login:
                database_logger.info(
                    "User authorization failed 'is_login = false'",
                    extra={
                        "username": user.username,
                        "user_uuid": user.uuid,
                        "request_id": request_id,
                    }
                )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"msg": "We cant login in this ac",
                                                                                      "request_id": request_id})

            enter_hash_password = hashlib.sha256(user_data.password.encode('utf-8')).hexdigest()
            if not user or enter_hash_password != user.hash_password:
                database_logger.info(
                    "User authorization failed 'password wrong'",
                    extra={
                        "username": user.username,
                        "user_uuid": user.uuid,
                        "request_id": request_id,
                    }
                )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"msg": "Email or password wrong",
                                                                                      "request_id": request_id})


            if not user.is_active:
                database_logger.info(
                    "User authorization failed 'is_active = false'",
                    extra={
                        "username": user.username,
                        "user_uuid": user.uuid,
                        "request_id": request_id,
                    }
                )
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"msg": "Not active ac",
                                                                                      "request_id": request_id})

            database_logger.info(
                "User authorization successfully",
                extra={
                    "username": user.username,
                    "user_uuid": user.uuid,
                    "request_id": request_id,
                }
            )

            return user

        except HTTPException as httpE:
            database_logger.warning(
                "Failed to authorize user, email or password wrong",
                extra={
                    "username": user_data.username,
                    "request_id": request_id,
                }
            )

            raise httpE

        except Exception as e:
            database_logger.error(
                "Failed to auth user",
                exc_info=e,
                extra={
                    "error": str(e),
                    "request_id": request_id,
                }
            )


usersManager = UsersManager()
