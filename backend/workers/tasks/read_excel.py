import logging
import sys
from src.broker import broker
from src.models.files import FileStatus
from workers.utils.excel import get_info, get_file_in_df, error_in_det, create_get_details, create_kmd, \
    create_get_marks, create_rel, update_kmd, update_kmd_shipped

if sys.argv[0] == 'worker':
    from workers.connect import async_session_factory

    log = logging.getLogger('Router')

@broker.task
async def update_kmd_task(kmd_list, request_id):
    log.info(f'{request_id}| Обновление нужных кмд')
    async with async_session_factory() as session:
        await update_kmd(kmd_list, session, request_id)
    log.info(f'{request_id}| Обновление завершено')


@broker.task
async def read_tech_file(file_uuid, request_id):
    async with async_session_factory() as session:
        fileORM, orderORM = await get_info(file_uuid, session, request_id)

        try:
            df = await get_file_in_df(file_uuid, request_id)
        except Exception as e:
            if fileORM:
                log.error(f'{request_id}| Ошибка при скачивании файла', exc_info=e)
                fileORM.status = FileStatus.ERROR
                fileORM.comment = [{
                    'mark': '',
                    'detail': ['Ошибка в обработке файла, файл не скачен'],
                    'num_details': ''
                }]
                await session.commit()
            return

        fileORM.status = FileStatus.IN_PROGRESS
        await session.commit()

        df_details_full, comment = error_in_det(df, request_id)
        try:
            if df_details_full is None:
                log.info(f'{request_id}| В деталях ошибка, файл ошибочный')
                fileORM.status = FileStatus.ERROR
                fileORM.comment = comment
                await session.commit()
            else:
                kmd_keys = await create_kmd(orderORM, df, session, request_id)

                values_list = list(kmd_keys.values())
                details = await create_get_details(kmd_keys, df_details_full, values_list, session)
                log.info(f'{request_id}| Детали получены и созданы')

                marks = await create_get_marks(kmd_keys, df, values_list, session)
                log.info(f'{request_id}| Марки получены и созданы')

                await create_rel(values_list, session, df, kmd_keys, marks, details)
                log.info(f'{request_id}| Связи созданы')
                fileORM.status = FileStatus.COMPLETED
                await session.commit()

                await update_kmd_task.kiq(kmd_list=values_list, request_id=request_id)
                log.info(f'{request_id}| Запущена задача на обновлении {len(values_list)} кмд')
            log.info(f'{request_id}| Данные сохранены')
        except Exception as e:
            await session.rollback()
            log.error(f'{request_id}| Неизвестная ошибка', exc_info=e)
            fileORM.status = FileStatus.ERROR
            await session.commit()
    log.info(f'{request_id}| Обработка файла завершена')

    return


@broker.task
async def update_kmd_shipped_task(kmd_uuids: list, request_id: str):
    """
    Фоновая задача. Вызывать после отгрузки марки:

        mark = await session.get(Marks, mark_id)
        await update_kmd_shipped_task.kiq(
            kmd_uuids=[str(mark.kmd_uuid)],
            request_id=request_id,
        )
    """
    log.info(f'{request_id}| [task] Обновление отгруженных агрегатов КМД: {kmd_uuids}')
    async with async_session_factory() as session:
        await update_kmd_shipped(kmd_uuids, session, request_id)
    log.info(f'{request_id}| [task] Готово')