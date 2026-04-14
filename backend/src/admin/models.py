
from sqladmin import ModelView

from src.models import Users, Orders, Marks, Details, RelMarkaDel, Files, KMD


class UsersAdmin(ModelView, model=Users):
    column_list = [
        Users.username,
        Users.is_active,
    ]

class OrdersAdmin(ModelView, model=Orders):
    column_list = [
        Orders.name,
        Orders.num_orders,
        Orders.is_active,
    ]
    form_excluded_columns = [
        Orders.create_at,
        Orders.update_at,
        Orders.delete_at
    ]

class MarksAdmin(ModelView, model=Marks):
    column_list = [
        Marks.name,
        Marks.title,
    ]
    pass

class DetailAdmin(ModelView, model=Details):
    column_list = [
        Details.num_detail,
    ]
    pass

class RelMarkaDelAdmin(ModelView, model=RelMarkaDel):
    column_list = [
        RelMarkaDel.status, RelMarkaDel.details_id, RelMarkaDel.marks_id,
    ]
    pass

class FileAdmin(ModelView, model=Files):
    column_list = [
        Files.file_name
    ]
    pass

class KMDAdmin(ModelView, model=KMD):
    column_list = [
        KMD.num_kmd
    ]
    pass