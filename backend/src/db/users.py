from src.db.base import BaseManager
from src.models import Users
from src.shemas.users import UsersCreate, UsersRead, UsersUpdate


class UsersManager(BaseManager[UsersCreate, UsersRead, UsersUpdate, Users]):
    model = Users
    create_schema = UsersCreate
    read_schema = UsersRead
    update_schema = UsersUpdate


usersManager = UsersManager()
