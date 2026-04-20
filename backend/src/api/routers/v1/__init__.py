from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .auth import router as auth_router  # noqa: F401
from .orders import router as orders_router  # noqa: F401
from .kmd import router as kmd_router  # noqa: F401
from .marks import router as marks_router  # noqa: F401
from .users import router as users_router  # noqa: F401

from fastapi import APIRouter, Depends

http_bearer = HTTPBearer(auto_error=False)

async def for_documentation(api_key: HTTPAuthorizationCredentials = Depends(http_bearer)):
    pass
router = APIRouter(dependencies=[Depends(for_documentation)])

router.include_router(auth_router, prefix="/auth")
router.include_router(orders_router, prefix="/orders")
router.include_router(kmd_router, prefix="/kmd")
router.include_router(marks_router, prefix="/marks")
router.include_router(users_router, prefix="/users")


