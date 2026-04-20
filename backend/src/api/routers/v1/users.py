import logging
from typing import Dict

from fastapi import APIRouter, Request, Depends, Body, HTTPException, status
from pydantic import UUID4
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.connection import get_async_session
from src.db.usersManager import usersManager
from src.shemas.users import UsersRequest, CategoryEnum, LevelEnum, Permission

router = APIRouter(tags=["users"])

log = logging.getLogger('Юзерроутер')


@router.post('/add_user')
async def add_user(request: Request, user: UsersRequest, session=Depends(get_async_session)):
    request_id = request.state.request_id
    log.info(f'{request_id}| добавление пользователя')
    user = await usersManager.create(user, session, request_id)
    log.info(f'{request_id}| пользователь создан UUID:{user.uuid}')
    return user


@router.get('/me')
async def get_user(request: Request, session=Depends(get_async_session)):
    request_id = request.state.request_id
    log.info(f'{request_id}| получение пользователя')
    user = await usersManager.get(request.state.user_id, session, request.state.request_id)
    if user:
        log.info(f'{request_id}| пользователь получен')
        return user
    log.info(f'{request_id}| пользователь не найден но токен существует')
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)


def perm_role_write(request: Request):
    try:
        per: Permission = request.state.permissions
    except AttributeError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="На сервере выключена авторизация")
    if per.can_write(CategoryEnum.ROLE):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав')


@router.put('/{user_id}/permissions',
            dependencies=[Depends(perm_role_write)],
            responses={200: {category: LevelEnum.NONE for category in CategoryEnum}},
            status_code=status.HTTP_200_OK)
async def update_permissions(request: Request,
                             user_id: UUID4,
                             permissions: Dict[CategoryEnum, LevelEnum] = Body(
                                 ...,
                                 examples=[{category: LevelEnum.NONE for category in CategoryEnum}]),
                             session: AsyncSession = Depends(get_async_session)
                             ) -> Dict[CategoryEnum, LevelEnum]:
    request_id = request.state.request_id
    log.info(f'{request_id}| Изменение прав пользователя {user_id}')
    res = await usersManager.update_permissions(user_id, permissions, session, request_id)
    log.info(f'{request_id}|  Успешное изменены права {user_id}')
    return res
