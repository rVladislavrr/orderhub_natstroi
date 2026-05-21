import logging
import math
from datetime import date
from typing import Dict, Optional

from fastapi import APIRouter, Request, Depends, Body, HTTPException, status, Query
from pydantic import UUID4, BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.base import DataBaseError, ErrorInDataBase
from src.db.connection import get_async_session
from src.db.usersManager import usersManager
from src.models import Users, RelUserDel, RelMarkaDel, KMD
from src.shemas import pagination
from src.shemas.pagination import PaginationInfo
from src.shemas.users import UsersRequest, CategoryEnum, LevelEnum, UsersUpdate, UsersRead

router = APIRouter(tags=["users"])

log = logging.getLogger('Юзерроутер')


@router.post('/add_user', summary='Добавление пользователя в систему')
async def add_user(request: Request, user: UsersRequest, session=Depends(get_async_session)):
    request_id = request.state.request_id
    log.info(f'{request_id}| добавление пользователя')
    user = await usersManager.create(user, session, request_id)
    log.info(f'{request_id}| пользователь создан UUID:{user.uuid}')
    return user


@router.get('/me',
            summary='Получение себя')
async def get_user(request: Request, session=Depends(get_async_session)):
    request_id = request.state.request_id
    log.info(f'{request_id}| получение пользователя')
    user = await usersManager.get(request.state.user_id, session, request.state.request_id)
    if user:
        log.info(f'{request_id}| пользователь получен')
        return user
    log.info(f'{request_id}| пользователь не найден но токен существует')
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

#
# def perm_role_write(request: Request):
#     try:
#         per: Permission = request.state.permissions
#     except AttributeError:
#         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="На сервере выключена авторизация")
#     if per.can_write(CategoryEnum.ROLE):
#         return
#     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав')


@router.put('/{user_id}/permissions',
            summary='Обновление прав пользователя',
            # dependencies=[Depends(perm_role_write)],
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
    request_user = request.state.user_id
    log.info(f'{request_id}| Изменение прав пользователя {user_id}')

    if str(user_id) == str(request_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Вы не можете менять права себе')

    res = await usersManager.update_permissions(user_id, permissions, session, request_id)
    log.info(f'{request_id}|  Успешное изменены права {user_id}')
    return res


@router.get('/{user_id}',
            summary='Получение конкретного пользователя',
            description='Получение конкретного пользователя по его UUID, доступно только с правами по ролю выше 1')
async def get_user(request: Request,
                   user_id: UUID4,
                   session: AsyncSession = Depends(get_async_session)):
    request_id = request.state.request_id
    log.info(f'{request_id}| Получение пользователя {user_id}')
    user = await usersManager.get(user_id, session, request_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Пользователь не найден')

    log.info(f'{request_id}| Успешно получен пользователя {user_id}')
    return user


@router.get('',
            summary='Получение всех пользователей')
async def get_users(request: Request,
                    limit: int = Query(5, gt=0),
                    page: int = Query(1, gt=0),
                    session: AsyncSession = Depends(get_async_session)) -> pagination.PaginatedResponseUsersRead:
    request_id = request.state.request_id
    try:
        log.info(f'{request_id}| Получение пользователей')
        users, total_count = await usersManager.get_users(limit, page, session, request.state.request_id)

        total_pages = math.ceil(total_count / limit) if total_count > 0 else 0
        has_more = page < total_pages
        has_prev = page > 1

        res = pagination.PaginatedResponseUsersRead(
            users=users,
            pagination=pagination.PaginationInfo(
                page=page,
                limit=limit,
                total_items=total_count,
                total_pages=total_pages,
                has_more=has_more,
                has_previous=has_prev,
                next_page=page + 1 if has_more else None,
                previous_page=page - 1 if has_prev else None
            )
        )
    except DataBaseError:
        log.error(f'{request_id}| база данных недоступна')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='База данных недоступна')

    except ErrorInDataBase:
        log.error(f'{request_id}| ошибка в получении')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Ошибка при получении')

    log.info(f'{request_id}| Пользователи успешно получены')
    return res


@router.put('/{user_id}',
            summary='Обновление пользователя')
async def update_users(
        request: Request,
        user_id: UUID4,
        user_data: UsersUpdate,
        session: AsyncSession = Depends(get_async_session),
):
    request_id = request.state.request_id
    log.info(f'{request_id} | Обновление параметров пользователя {user_id}')
    user = await usersManager.update_user(user_id, user_data, session, request_id)
    log.info(f'{request_id} | Успешное обновление параметров параметров пользователя {user_id}')
    return user


class UserWorkRecentItem(BaseModel):
    id: int
    mark_title: str  # Б2-30
    mark_name: str  # Балка
    detail_num: str  # номер детали
    detail_type: str  # Лист / Труба / ...
    detail_size: str  # типоразмер
    kmd_num: str  # номер КМД
    order_num: str  # номер заказа
    order_name: str  # название заказа
    quantity: int
    completion_date: date


class UserWorkStatsResponse(BaseModel):
    user_uuid: UUID4
    name: str
    lastname: str
    last_work_date: Optional[date]  # None если ещё ничего не делал
    today_quantity: int
    month_quantity: int
    recent_items: list[UserWorkRecentItem]
    pagination: PaginationInfo


@router.get(
    "/{user_uuid}/stats",
    response_model=UserWorkStatsResponse,
    summary="Статистика пользователя",
)
async def get_user_work_stats(
        user_uuid: UUID4,
        page: int = Query(1, ge=1, description="Номер страницы"),
        limit: int = Query(20, ge=1, le=100, description="Записей на странице"),
        session: AsyncSession = Depends(get_async_session),
):
    # 1. Проверяем пользователя
    user = await session.get(Users, user_uuid)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    today = date.today()
    month_start = today.replace(day=1)

    # 2. Количество деталей за сегодня
    today_qty = (await session.execute(
        select(func.coalesce(func.sum(RelUserDel.quantity), 0))
        .where(and_(
            RelUserDel.user_uuid == user_uuid,
            RelUserDel.completion_date == today,
        ))
    )).scalar_one()

    # 3. Количество деталей за текущий месяц
    month_qty = (await session.execute(
        select(func.coalesce(func.sum(RelUserDel.quantity), 0))
        .where(and_(
            RelUserDel.user_uuid == user_uuid,
            RelUserDel.completion_date >= month_start,
            RelUserDel.completion_date <= today,
        ))
    )).scalar_one()

    # 4. Дата последней сдачи
    last_date = (await session.execute(
        select(func.max(RelUserDel.completion_date))
        .where(RelUserDel.user_uuid == user_uuid)
    )).scalar_one()  # None если записей нет

    # 5. Последние детали с пагинацией
    offset = (page - 1) * limit

    total_items = (await session.execute(
        select(func.count())
        .select_from(RelUserDel)
        .where(RelUserDel.user_uuid == user_uuid)
    )).scalar_one()
    total_pages = math.ceil(total_items / limit) if total_items else 1

    entries = (await session.execute(
        select(RelUserDel)
        .where(RelUserDel.user_uuid == user_uuid)
        .options(
            selectinload(RelUserDel.rel_markadel).selectinload(RelMarkaDel.mark),
            selectinload(RelUserDel.rel_markadel).selectinload(RelMarkaDel.detail),
            selectinload(RelUserDel.rel_markadel)
            .selectinload(RelMarkaDel.kmd)
            .selectinload(KMD.order),
        )
        .order_by(RelUserDel.completion_date.desc(), RelUserDel.id.desc())
        .offset(offset)
        .limit(limit)
    )).scalars().all()

    recent_items = []
    for entry in entries:
        rel = entry.rel_markadel
        kmd = rel.kmd
        order = kmd.order
        recent_items.append(UserWorkRecentItem(
            id=entry.id,
            mark_title=rel.mark.title,
            mark_name=rel.mark.name,
            detail_num=rel.detail.num_detail,
            detail_type=rel.detail.type,
            detail_size=rel.detail.size,
            kmd_num=kmd.num_kmd,
            order_num=order.num_orders,
            order_name=order.name,
            quantity=entry.quantity,
            completion_date=entry.completion_date,
        ))

    return UserWorkStatsResponse(
        user_uuid=user.uuid,
        name=user.name,
        lastname=user.lastname,
        last_work_date=last_date,
        today_quantity=int(today_qty),
        month_quantity=int(month_qty),
        recent_items=recent_items,
        pagination=PaginationInfo(
            page=page,
            limit=limit,
            total_items=total_items,
            total_pages=total_pages,
            has_more=page < total_pages,
            has_previous=page > 1,
            next_page=page + 1 if page < total_pages else None,
            previous_page=page - 1 if page > 1 else None,
        ),
    )