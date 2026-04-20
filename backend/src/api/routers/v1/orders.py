import logging
import math

from fastapi import APIRouter, status, Depends, Request, HTTPException, UploadFile, BackgroundTasks
from fastapi.params import Query, File
from pydantic import UUID4
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.base import DataBaseError, ErrorInDataBase
from src.db.connection import get_async_session
from src.db.fileManager import filesManager
from src.db.ordersManager import ordersManager
from src.service.s3Manager import s3_client
from src.shemas import orders, pagination
from src.shemas.files import FileCreate, FileRead
from src.utils.check_excel import ExcelValidator
from src.utils.hash import calculate_file_hash
from workers.tasks.read_excel import read_tech_file

log = logging.getLogger('Ордер роутер')

router = APIRouter(
    tags=["orders"],
)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
async def create_orders(
        data_orders: orders.OrdersCreate,
        request: Request,
        session: AsyncSession = Depends(get_async_session)) -> orders.OrdersRead:
    request_id = request.state.request_id

    log.info(f'{request_id}| Создание заказа')

    try:
        order = await ordersManager.create(data_orders, session)

    except DataBaseError:
        log.error(f'{request_id}| база данных недоступна')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='База данных недоступна')

    except ErrorInDataBase:
        log.error(f'{request_id}| ошибка в создании')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Ошибка при создании')

    log.info(f'{request_id}| Заказ успешно создан {order.uuid}')
    return order


@router.get(
    '',
    status_code=status.HTTP_200_OK,
)
async def get_orders(request: Request,
                     limit: int = Query(5, gt=0),
                     page: int = Query(1, gt=0),
                     session: AsyncSession = Depends(get_async_session)) -> pagination.PaginatedResponseOrder:
    request_id = request.state.request_id
    log.info(f'{request_id}| Получение заказов')

    try:
        list_orders, total_items = await ordersManager.get_orders(session,
                                                                  limit=limit,
                                                                  page=page,
                                                                  request_id=request_id)

        total_pages = math.ceil(total_items / limit) if total_items > 0 else 0
        has_more = page < total_pages
        has_prev = page > 1

        res = pagination.PaginatedResponseOrder(
            orders=list_orders,
            pagination=pagination.PaginationInfo(
                page=page,
                limit=limit,
                total_items=total_items,
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

    log.info(f'{request_id}| Заказы успешно получены')
    return res


@router.get(
    '/{order_id}',
    status_code=status.HTTP_200_OK,
)
async def get_order(
        request: Request,
        order_id: UUID4,
        session: AsyncSession = Depends(get_async_session)
) -> orders.OrdersReadFileMarks:
    request_id = request.state.request_id
    log.info(f'{request_id}| Получение заказа')

    try:
        order: orders.OrdersReadFileMarks = await ordersManager.get_with_total(pk=order_id,
                                                                               session=session, request_id=request_id)

    except DataBaseError:
        log.error(f'{request_id}| база данных недоступна')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='База данных недоступна')

    except ErrorInDataBase:
        log.error(f'{request_id}| ошибка в получении')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Ошибка при получении')

    if order:
        log.info(f'{request_id}| Заказ успешно получен')
        return order
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Заказ не найден')


def get_file_api(file: UploadFile = File(...)) -> UploadFile:
    MAX_FILE_SIZE = 30 * 1024 * 1024
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Файл должен быть Excel (.xlsx или .xls)"
        )

    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимальный размер: {MAX_FILE_SIZE // (1024 * 1024)} MB"
        )
    return file


@router.post("/{order_id}/upload")
async def upload_file(request: Request,
                      order_id: UUID4,
                      background_tasks: BackgroundTasks,
                      session: AsyncSession = Depends(get_async_session),
                      file: UploadFile = Depends(get_file_api)) -> FileRead:
    order = await get_order(request, order_id, session)
    request_id = request.state.request_id

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Заказ не найден')

    log.info(f'{request_id}| Получен файл')
    file_bytes = await file.read()

    if not ExcelValidator.is_valid_excel_fast(file_bytes):
        log.info(f'{request_id}| Не прошёл базовую валидацию')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Ошибочный файл')

    log.info(f'{request_id}| Прошёл базовую валидацию')

    check, columns = ExcelValidator.check_columns_fast(file_bytes, ['Номер заказа',
                                                                    'Номер КМД',
                                                                    'Номер очереди',
                                                                    'Марка',
                                                                    'Наименование марки',
                                                                    'Кол-во марок на заказ. шт',
                                                                    'Вес 1 марки, кг',
                                                                    'Кооперация',
                                                                    '№ позиции', 'Кол-во позиций на однотипные марки',
                                                                    'Прокат', 'Типоразмер проката'])

    if not check:
        log.info(f'{request_id}| Не обнаружены нужные столбцы')
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Отсутствую столбцы: {columns}')

    log.info(f'{request_id}| Файл с нужными столбцами')

    try:

        log.info(f'{request_id}| Создание файла в бд')
        hash_sum = calculate_file_hash(file_bytes)
        fileORM: FileRead = await filesManager.create(
            create_data=FileCreate(
                file_name=file.filename,
                file_size=file.size,
                order_uuid=order_id,
                hash_sum=hash_sum,
            ), session=session, request_id=request_id
        )
    except HTTPException:
        raise
    except DataBaseError:
        log.error(f'{request_id}| база данных недоступна')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='База данных недоступна')

    except ErrorInDataBase:
        log.error(f'{request_id}| ошибка в создании')
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Ошибка при создании')

    log.info(f'{request_id}| Успешно создана метаинформация о файле')

    background_tasks.add_task(
        s3_client.upload_file,
        file_obj=file_bytes,
        obj_name=str(fileORM.uuid),
        bucket_name=settings.S3_BUCKET_NAME,
        request_id=request_id
    )

    log.info(f'{request_id}| Фоновая задача на загрузку в S3')
    await read_tech_file.kiq(fileORM.uuid, request_id)
    return fileORM
