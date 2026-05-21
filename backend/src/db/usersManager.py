import hashlib
import logging

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from src.config import settings
from src.db.base import BaseManager
from src.db.connection import async_session_maker
from src.models import Users
from src.shemas.users import UsersCreate, UsersRead, UsersUpdate, UsersRequest, Permission
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
            query = select(Users).where(Users.username == user_data.username, )
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

    @staticmethod
    async def update_permissions(user_id, new_permission, session: AsyncSession, request_id: str | None = None):
        try:
            user = await session.get(Users, user_id)
            if not user:
                database_logger.debug(f'{request_id} | Пользователь  не получен')
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

            if user.username == settings.ADMIN_USERNAME:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав')


            database_logger.debug(f'{request_id} | Пользователь получен')
            new_permission = Permission.from_dict(new_permission)
            user.permissions = new_permission.permissions
            database_logger.debug(f'{request_id} | Права изменены')

            await session.commit()
            database_logger.debug(f'{request_id} | Всё сохранено')

            return UsersRead.model_validate(user, from_attributes=True).permissions.as_dict

        except HTTPException:
            raise

        except Exception as e:
            database_logger.critical(f'{request_id} | Права не сохранены', exc_info=e)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='При сохранении прав')

    @staticmethod
    async def get_user_refresh(user_id, session: AsyncSession, request_id: str | None = None):
        try:
            user = await session.get(Users, user_id)

            if not user:
                database_logger.debug(f'{request_id} | Пользователь  не получен')
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

            database_logger.debug(f'{request_id} | Пользователь получен')

            if not user.is_login:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail='В этот аккаунт нельзя войти')

            if not user.is_active:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail='Этот аккаунт не активен')

            return user

        except HTTPException:
            raise

        except Exception as e:
            database_logger.critical(f'{request_id} | Токен не обновлён ошибка', exc_info=e)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail='При получении данных для токена')

    @staticmethod
    async def create_admin():
        hash_password = create_hash(settings.ADMIN_PASSWORD)

        async with (async_session_maker() as session):
            try:
                admin_user = Users(
                    username=settings.ADMIN_USERNAME,
                    hash_password=hash_password,
                    lastname='admin',
                    name='admin',
                    is_login=True,
                    permissions='2222'
                )
                session.add(admin_user)
                await session.commit()
            except Exception:
                try:
                    await session.rollback()

                    admin = (await session.execute(select(Users).where(Users.username == settings.ADMIN_USERNAME))
                             ).scalar_one()

                    admin.permissions = '2222'
                    admin.hash_password = hash_password
                    admin.is_active = True
                    admin.is_login = True

                    await session.commit()

                except Exception as e:
                    await session.rollback()
                    database_logger.error('Ошибка при создании админа', exc_info=e)
                    raise

        return

    async def get_users(self, limit, page, session: AsyncSession, request_id: str | None = None):
        database_logger.debug(f'{request_id}| Получение пользователей')
        offset = (page - 1) * limit

        total_count_subquery = (select(func.count()).select_from(Users).where(Users.username != settings.ADMIN_USERNAME)
                                .scalar_subquery())

        query = select(
            Users,
            total_count_subquery.label('total_count')
        ).where(Users.username != settings.ADMIN_USERNAME).offset(offset).limit(limit)

        result = await session.execute(query)
        rows = result.all()

        if rows:
            database_logger.debug(f'{request_id}|Пользователи получены, перед парсингом')
            total_items = rows[0].total_count
            users = [self.read_schema.model_validate(row.Users, from_attributes=True) for row in rows]
            database_logger.debug(f'{request_id}| Пользователи валидированы под схему')
        else:
            database_logger.debug(f'{request_id}| Пользователи не получены, подзапрос на количество всех пользователи')
            total_items = await session.scalar(select(func.count()).select_from(Users)
                                               .where(Users.username != settings.ADMIN_USERNAME))
            users = []

        database_logger.debug(f'{request_id}| Пользователи выполнены')
        return users, total_items

    @staticmethod
    async def update_user(user_id, user_data: UsersUpdate,
                          session: AsyncSession,
                          request_id: str | None = None):
        try:
            user = await session.get(Users, user_id)
            if not user:
                database_logger.debug(f'{request_id} | Пользователь  не получен')
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

            if user.username == settings.ADMIN_USERNAME:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав')

            database_logger.info(f'{request_id} | Пользователь получен')

            if user_data.password is not None:
                user.hash_password = create_hash(user_data.password)

            for key, value in user_data.model_dump(exclude_unset=True).items():
                setattr(user, key, value)

            user.update_at = datetime.now()
            await session.commit()
            await session.refresh(user)
            database_logger.info(f'{request_id} | Пользователь обновлён')
            return UsersRead.model_validate(user, from_attributes=True)

        except HTTPException:
            raise

        except IntegrityError:
            await session.rollback()
            database_logger.error(f'{request_id} | Конфликт данных')
            raise HTTPException(status_code=409, detail="Данные уже существуют")

        except Exception as e:
            database_logger.error('Ошибка при обновлении пользователя', exc_info=e)
            raise



usersManager = UsersManager()
