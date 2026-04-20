from fastapi import APIRouter, Request, Depends, Response

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.connection import get_async_session
from src.db.usersManager import usersManager
from src.shemas.users import Token, UserAuth, UserTokenCreate
from src.utils.auth_jwt import create_tokens

router = APIRouter(tags = ['auth'])


@router.post('/login', description='Авторизация или вход пользователя')
async def login(request: Request,
                response: Response,
                user_data: UserAuth,
                session: AsyncSession = Depends(get_async_session)) -> Token:
    request_id = request.state.request_id
    user_inf = await usersManager.authorization(session, user_data, request_id)
    user_token_inf = UserTokenCreate.model_validate(user_inf, from_attributes=True)
    return create_tokens(user_token_inf, response)


