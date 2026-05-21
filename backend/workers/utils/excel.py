import asyncio
import logging
from decimal import Decimal, InvalidOperation
from io import BytesIO
from decimal import getcontext
import pandas as pd
from fastapi import HTTPException
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from src.config import settings
from src.db.base import ErrorInDataBase
from src.models import Files, Orders, RelMarkaDel, Details, Marks, KMD, MarkShipment
from src.models.files import FileStatus
from src.service.s3Manager import s3_client

getcontext().prec = 5
log = logging.getLogger('Utils router')


def find_error(df_det):
    list_errors = []
    position_standard = {}

    for _, row in df_det.iterrows():
        pos = row['№ позиции']
        details_tuple = (
            row['Прокат'],
            row['Типоразмер проката'],
            row['Ширина, мм'],
            row['Длина заготовки, мм'],
            row['Вес 1 заг., кг'],
            row['Марка стали'],
            row['Операции'],
        )
        mark = row['Марка']

        values = (mark, details_tuple)
        type_error = {
            0: 'Прокат',
            1: 'Типоразмер проката',
            2: 'Ширина, мм',
            3: 'Длина заготовки, мм',
            4: 'Вес 1 заг., кг',
            5: 'Марка стали',
            6: 'Операции',
        }

        if pos in position_standard:

            if position_standard[pos][1] != details_tuple:
                list_error_in_mark = []
                for ind, (new, old) in enumerate(zip(details_tuple, position_standard[pos][1]), 0):
                    if new != old:
                        list_error_in_mark.append(
                            f'Значение из марки {position_standard[pos][0]} столбца "{type_error[ind]}" не '
                            f'совпадает: {old} новое {new}'
                        )
                obj = {
                    'mark': mark,
                    'num_details': pos,
                    'detail': list_error_in_mark
                }
                list_errors.append(obj)
            else:
                continue
        else:
            position_standard[pos] = values
    return list_errors


async def get_info(file_uuid: str, session: AsyncSession, request_id):
    try:
        log.info(f'{request_id}| Получение метаинформации про файл')
        fileORM = await session.get(Files, file_uuid)

        if not fileORM:
            raise ErrorInDataBase('File not found')

        log.info(f'{request_id}| Получение заказа из файла')
        orderOrm = await session.get(Orders, fileORM.order_uuid, options=[selectinload(Orders.kmd_list)])

        if not orderOrm:
            raise ErrorInDataBase(f'{request_id}| Order not found')

    except ErrorInDataBase as e:
        log.error(f'{request_id}| Нужная информация не найдена {str(e)}')
        if fileORM:
            fileORM.status = FileStatus.ERROR
            fileORM.comment = {
                'mark': '',
                'detail': 'Ошибка в получении заказа из файла, фаил не привязан к заказу',
                'num_details': ''
            }
            await session.commit()
        raise

    except Exception as e:
        log.critical(f'{request_id}| Неизвестная ошибка', exc_info=e)
        if fileORM:
            fileORM.status = FileStatus.ERROR
            fileORM.comment = {
                'mark': '',
                'detail': 'Ошибка сервера в обработке файла, попробуйте перезагрузить фаил',
                'num_details': ''
            }
            await session.commit()
        raise

    return fileORM, orderOrm


async def get_file_in_df(file_uuid, request_id):
    try:
        await s3_client.connect(
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            endpoint_url=settings.S3_ENDPOINTPUT,
            region_name=settings.S3_REGION,
        )
        log.info(f'{request_id}| Успешно подключено к s3')
        file_bytes = await s3_client.download_file(str(file_uuid), settings.S3_BUCKET_NAME, request_id)

        log.info(f'{request_id}| Файл получен s3')
        excel_buffer = BytesIO(file_bytes)
        df = pd.read_excel(
            excel_buffer,
            dtype={'Вес 1 марки, кг': str,
                   'Вес 1 заг., кг': str},
            keep_default_na=False,
        )
    except HTTPException:
        try:
            await asyncio.sleep(2)
            df = await get_file_in_df(file_uuid, request_id)
        except Exception:
            raise
    except Exception as e:
        log.critical(f'{request_id}| Неизвестная ошибка', exc_info=e)
        raise

    return df


async def create_get_details(kmd_keys, df_details_full, values_list, session):
    query_get_kmd_d = select(Details.id,
                             Details.kmd_uuid,
                             Details.num_detail).select_from(Details).filter(Details.kmd_uuid.in_(values_list))
    kmd_d = (await session.execute(query_get_kmd_d)).all()
    set_kmd_details = set([(str(i[1]), i[2]) for i in kmd_d])

    details = {(i[2], i[1]): i[0] for i in kmd_d}

    details_create = []

    for _, row in df_details_full.iterrows():
        if (str(kmd_keys[row['Номер КМД']]), row['№ позиции']) not in set_kmd_details:
            details_create.append(Details(
                num_detail=row['№ позиции'],
                type=row['Прокат'].capitalize(),
                size=str(row['Типоразмер проката']),
                width=row['Ширина, мм'] if row['Ширина, мм'] != '-' and row['Ширина, мм'] != '' else None,
                length=row['Длина заготовки, мм'],
                weight=row['Вес 1 заг., кг'],
                steel_grade=row['Марка стали'],
                kmd_uuid=kmd_keys[row['Номер КМД']],
            ))
    log.info(f'Будет добавлено {len(details_create)} деталей')
    session.add_all(details_create)
    await session.flush()

    details.update({(i.num_detail, i.kmd_uuid): i.id for i in details_create})

    return details


async def create_get_marks(kmd_keys, df, values_list, session):
    query_get_kmd_marks = select(Marks.kmd_uuid,
                                 Marks.title, Marks.id).select_from(Marks).filter(Marks.kmd_uuid.in_(values_list))

    kmd_marks = (await session.execute(query_get_kmd_marks)).all()
    set_kmd_marks = set([(str(i[0]), i[1]) for i in kmd_marks])

    df_marks = df[['Марка', 'Наименование марки',
                   'Кол-во марок на заказ. шт', 'Вес 1 марки, кг',
                   'Кооперация', 'Признак монтажной детали', 'Номер КМД']].drop_duplicates()

    marks = {(i[1], i[0]): i[2] for i in kmd_marks}

    marks_create = []
    for _, row in df_marks.iterrows():
        if (str(kmd_keys[row['Номер КМД']]), row['Марка']) not in set_kmd_marks:
            marks_create.append(Marks(
                title=row['Марка'],
                name=row['Наименование марки'],
                quantity=row['Кол-во марок на заказ. шт'],
                weight=row['Вес 1 марки, кг'],
                cooperation=row['Кооперация'] if row['Кооперация'] != '-'
                                                 and row['Кооперация'] != '' else None,
                mounting_part=row['Признак монтажной детали'] if row['Признак монтажной детали'] != '-'
                                                                 and row[
                                                                     'Признак монтажной детали'] != '' else None,

                kmd_uuid=kmd_keys[row['Номер КМД']]
            ))

    log.info(f'Будет добавлено {len(marks_create)} марок')
    session.add_all(marks_create)
    await session.flush()

    marks.update({(i.title, i.kmd_uuid): i.id for i in marks_create})
    return marks


async def create_kmd(orderORM, df, session, request_id):
    try:
        kmd_keys = {}

        for kmd in orderORM.kmd_list:
            kmd_keys[kmd.num_kmd] = kmd.uuid

        df_kmd = df['Номер КМД'].drop_duplicates()

        for kmd_num in df_kmd.values:
            if kmd_num not in kmd_keys:
                kmd_ORM = KMD(
                    num_kmd=kmd_num,
                    order_uuid=orderORM.uuid)
                session.add(kmd_ORM)
                await session.flush()
                log.info(f'{request_id} | Создано кмд {kmd_num}, uuid={kmd_ORM.uuid}')
                kmd_keys[kmd_num] = kmd_ORM.uuid

        return kmd_keys
    except Exception as e:
        log.error(f'{request_id} |  Произошла ошибка при создании кмд', exc_info=e)
        raise


def safe_decimal_conversion(value):
    if pd.isna(value):
        return None
    str_val = str(value).strip()
    if not str_val or str_val.isspace():
        return None

    cleaned = ''
    for char in str_val:
        if char.isdigit() or char in '.-':
            cleaned += char

    if not cleaned or cleaned == '-':
        return None

    try:
        return Decimal(cleaned)
    except InvalidOperation:
        log.warning(f"Could not convert '{value}' to Decimal, setting to None")
        return None


def error_in_det(df, request_id):
    try:
        log.info(f'{request_id} | Проверка файла на ошибки в деталях')

        # Convert columns safely
        for col in ['Вес 1 марки, кг', 'Вес 1 заг., кг']:
            if col in df.columns:
                df[col] = df[col].apply(safe_decimal_conversion)
            else:
                log.warning(f'{request_id} | Column "{col}" not found in dataframe')

        df_details_full = df[['№ позиции', 'Прокат', 'Типоразмер проката', 'Ширина, мм',
                              'Длина заготовки, мм', 'Вес 1 заг., кг', 'Марка стали',
                             'Номер КМД']].drop_duplicates()

        df_details_num = df[['№ позиции', 'Номер КМД']].drop_duplicates()

        if len(df_details_full) != len(df_details_num):
            log.info(f'{request_id} | В файле найдены ошибки')
            comment = find_error(df)
            if not comment:
                comment = [{'mark': 'Нету', 'num_details': 'Неизвестно', 'detail': ['При проверке количество деталей '
                                                                                    'не сошлось,'
                                                                                    'но конкретные марки не удалось '
                                                                                    'найти, возможно ошибка на'
                                                                                    'сервере']}]
            return None, comment
        return df_details_full, None

    except Exception as e:
        log.info(f'{request_id} | Ошибка при поиске ошибок', exc_info=e)
        raise


async def create_rel(values_list, session, df, kmd_keys, marks, details):
    query_get_rel = (
        select(
            RelMarkaDel.kmd_uuid,
            Details.num_detail,
            Marks.title
        )
        .select_from(RelMarkaDel)
        .join(RelMarkaDel.detail)
        .join(RelMarkaDel.mark)
        .filter(RelMarkaDel.kmd_uuid.in_(values_list))
    )
    kmd_rel = (await session.execute(query_get_rel)).all()
    set_kmd_rel = set([(str(i[0]), i[1], i[2]) for i in kmd_rel])

    relMarkaDel = []
    relMarkaDel_df = df[
        ['Марка', '№ позиции', 'Кол-во позиций на однотипные марки', 'Номер КМД', 'Номер очереди', 'Операции']].drop_duplicates()
    for _, row in relMarkaDel_df.iterrows():
        if (str(kmd_keys[row['Номер КМД']]), row['№ позиции'], row['Марка']) not in set_kmd_rel:
            relMarkaDel.append(
                RelMarkaDel(
                    operation=row['Операции'],
                    que_num=row['Номер очереди'],
                    details_quantity=row['Кол-во позиций на однотипные марки'],
                    remaining_quantity=row['Кол-во позиций на однотипные марки'],
                    kmd_uuid=kmd_keys[row['Номер КМД']],
                    marks_id=marks[(row['Марка'], kmd_keys[row['Номер КМД']])],
                    details_id=details[(row['№ позиции'], kmd_keys[row['Номер КМД']])]
                ))
    log.info(f'Будет добавлено {len(relMarkaDel)} соединений между маркой и деталью')
    session.add_all(relMarkaDel)
    await session.flush()
    return


async def update_kmd(list_kmd, session, request_id):
    query = (
        select(
            Marks.kmd_uuid,
            func.count(Marks.id).label('count_uq'),
            func.sum(Marks.quantity).label('count'),
            func.sum(Marks.weight * Marks.quantity).label('total_weight'),
        )
        .where(Marks.kmd_uuid.in_(list_kmd))
        .group_by(Marks.kmd_uuid)
    )

    results = (await session.execute(query)).all()
    log.info(f'{request_id}| Получение и подсчёт всех использованных кмд')

    updated_count = 0
    for r in results:
        weight = r.total_weight if r.total_weight is not None else 0.0
        rounded_weight = round(float(weight), 2)

        # Обновляем каждую запись
        await session.execute(
            update(KMD)
            .where(KMD.uuid == r.kmd_uuid)
            .values(
                count_marks_uq=r.count_uq or 0,
                count_marks=r.count or 0,
                marks_weight=rounded_weight
            )
        )
        updated_count += 1

    await session.commit()
    log.info(f'{request_id}| Обновлено {updated_count} записей')
    return


async def _calc_shipped_for_kmds(kmd_uuids: list, session) -> dict:
    query = (
        select(
            Marks.kmd_uuid,
            func.coalesce(func.sum(MarkShipment.quantity), 0).label('shipped_count'),
            func.coalesce(
                func.sum(MarkShipment.quantity * Marks.weight), 0
            ).label('shipped_weight'),
        )
        .join(MarkShipment, MarkShipment.mark_id == Marks.id)
        .where(Marks.kmd_uuid.in_(kmd_uuids))
        .group_by(Marks.kmd_uuid)
    )
    results = (await session.execute(query)).all()

    # kmd_uuid → {shipped_count, shipped_weight}
    return {
        str(r.kmd_uuid): {
            'shipped_marks_count': int(r.shipped_count),
            'shipped_marks_weight': round(float(r.shipped_weight), 2),
        }
        for r in results
    }


async def _calc_shipped_for_kmds(kmd_uuids: list, session) -> dict:
    """
    Считает отгруженные агрегаты для списка KMD одним запросом.

    SELECT
        marks.kmd_uuid,
        SUM(ms.quantity)                     AS shipped_count,
        SUM(ms.quantity * marks.weight)      AS shipped_weight
    FROM mark_shipment ms
    JOIN marks ON marks.id = ms.mark_id
    WHERE marks.kmd_uuid IN (...)
    GROUP BY marks.kmd_uuid
    """
    query = (
        select(
            Marks.kmd_uuid,
            func.coalesce(func.sum(MarkShipment.quantity), 0).label('shipped_count'),
            func.coalesce(
                func.sum(MarkShipment.quantity * Marks.weight), 0
            ).label('shipped_weight'),
        )
        .join(MarkShipment, MarkShipment.mark_id == Marks.id)
        .where(Marks.kmd_uuid.in_(kmd_uuids))
        .group_by(Marks.kmd_uuid)
    )
    results = (await session.execute(query)).all()

    # kmd_uuid → {shipped_count, shipped_weight}
    return {
        str(r.kmd_uuid): {
            'shipped_marks_count': int(r.shipped_count),
            'shipped_marks_weight': round(float(r.shipped_weight), 2),
        }
        for r in results
    }


async def update_kmd_shipped(kmd_uuids: list, session, request_id: str) -> None:
    """
    Обновляет shipped_marks_count и shipped_marks_weight для переданных KMD.
    Вызывается внутри фоновой задачи или напрямую если нужна синхронность.
    """
    if not kmd_uuids:
        return

    aggregates = await _calc_shipped_for_kmds(kmd_uuids, session)
    log.info(f'{request_id}| Подсчитаны отгрузки для {len(aggregates)} КМД')

    updated = 0
    for kmd_uuid_str, values in aggregates.items():
        await session.execute(
            update(KMD)
            .where(KMD.uuid == kmd_uuid_str)
            .values(**values)
        )
        updated += 1

    # Если у каких-то KMD из списка ещё нет ни одной отгрузки —
    # они не попадут в aggregates, сбрасываем их в 0 явно
    kmd_uuids_str = {str(u) for u in kmd_uuids}
    no_shipments = kmd_uuids_str - set(aggregates.keys())
    for kmd_uuid_str in no_shipments:
        await session.execute(
            update(KMD)
            .where(KMD.uuid == kmd_uuid_str)
            .values(shipped_marks_count=0, shipped_marks_weight=0)
        )

    await session.commit()
    log.info(f'{request_id}| Обновлено отгрузок: {updated} КМД')
