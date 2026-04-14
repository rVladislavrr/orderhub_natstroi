from src.db.base import BaseManager
from src.models import Files
from src.shemas.files import FileCreate, FileRead, FileUpdate


class FilesManager(BaseManager[FileCreate, FileRead, FileUpdate, Files]):
    model = Files
    create_schema = FileCreate
    read_schema = FileRead
    update_schema = FileUpdate


filesManager = FilesManager()
