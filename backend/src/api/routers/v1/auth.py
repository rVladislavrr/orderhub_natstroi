from fastapi import APIRouter, Request, Depends, Response

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.connection import get_async_session
from src.db.usersManager import usersManager
from src.shemas.users import Token, UserAuth, UserTokenCreate
from src.utils.auth_jwt import create_tokens, get_payload_refresh

router = APIRouter(tags=['auth'])


@router.post('/login', summary='Авторизация или вход пользователя')
async def login(request: Request,
                response: Response,
                user_data: UserAuth,
                session: AsyncSession = Depends(get_async_session)) -> Token:
    request_id = request.state.request_id
    user_inf = await usersManager.authorization(session, user_data, request_id)
    user_token_inf = UserTokenCreate.model_validate(user_inf, from_attributes=True)
    return create_tokens(user_token_inf, response)


@router.post('/logout', summary='Выход из аккаунта')
async def logout(request: Request, response: Response):
    if request.cookies.get(settings.auth_jwt.key_cookie):
        response.delete_cookie(settings.auth_jwt.key_cookie)
    return {
        'detail': {"msg": "Ok", "request_id": request.state.request_id}
    }

@router.post('/refresh', summary='Обновление токена')
async def refresh(request: Request,
                  response: Response,
                  user=Depends(get_payload_refresh),
                  session: AsyncSession = Depends(get_async_session)) -> Token:
    request_id = request.state.request_id
    user_id = user['uuid']
    user = await usersManager.get_user_refresh(user_id, session, request_id)
    user_token_inf = UserTokenCreate.model_validate(user, from_attributes=True)
    return create_tokens(user_token_inf, response)
