from sqladmin import Admin

from src.admin.models import UsersAdmin, OrdersAdmin, KMDAdmin, DetailAdmin, MarksAdmin, FileAdmin, RelMarkaDelAdmin


def register_admin_views(admin: Admin):
    admin.add_view(UsersAdmin)
    admin.add_view(OrdersAdmin)
    admin.add_view(KMDAdmin)
    admin.add_view(DetailAdmin)
    admin.add_view(MarksAdmin)
    admin.add_view(FileAdmin)
    admin.add_view(RelMarkaDelAdmin)
