from typing import Dict

from fastapi import APIRouter, Request, Depends, Response, Body, HTTPException, status
from pydantic import UUID4
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.connection import get_async_session
from src.db.usersManager import usersManager
from src.shemas.users import UsersRequest, Token, UserAuth, UserTokenCreate, CategoryEnum, LevelEnum, Permission
from src.utils.auth_jwt import create_tokens

router = APIRouter()


@router.post('/login', description='Авторизация или вход пользователя')
async def login(request: Request,
                response: Response,
                user_data: UserAuth,
                session: AsyncSession = Depends(get_async_session)) -> Token:
    request_id = request.state.request_id
    user_inf = await usersManager.authorization(session, user_data, request_id)
    user_token_inf = UserTokenCreate.model_validate(user_inf, from_attributes=True)
    return create_tokens(user_token_inf, response)


@router.post('/users/add_user')
async def add_user(request: Request, user: UsersRequest, session=Depends(get_async_session)):
    return await usersManager.create(user, session, request.state.request_id)


@router.get('/users/me')
async def get_user(request: Request, session=Depends(get_async_session)):
    user_id = request.state.user_id
    return await usersManager.get(user_id, session, request.state.request_id)


def perm_role_write(request: Request):
    per: Permission = request.state.permissions
    if per.can_write(CategoryEnum.ROLE):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, )


@router.put('/users/{user_id}/permissions')
async def update_permissions(request: Request, user_id: UUID4,
                             permissions: Dict[CategoryEnum, LevelEnum] = Body(
                                 ...,
                                 examples=[{category: LevelEnum.NONE for category in CategoryEnum}]
                             ),
                             _=Depends(perm_role_write)
                             ):
    return permissions, user_id
