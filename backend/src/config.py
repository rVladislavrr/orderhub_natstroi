from pathlib import Path

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).parent.parent

class AuthJWT(BaseModel):
    private_key_path: Path = BASE_DIR / "certs" / "jwt-private.pem"
    public_key_path: Path = BASE_DIR / "certs" / "jwt-public.pem"
    algorithm: str = 'RS256'
    access_token_expire_minutes: int = 360
    refresh_token_expire_days: int = 30
    # verify_token_expire_minutes: int = 15
    key_cookie: str = 'Auth-refresh'


class Settings(BaseSettings):

    DB_HOST: str
    DB_PORT: str
    DB_NAME: str
    DB_USER: str
    DB_PASS: str

    # S3_ENDPOINT: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET_NAME: str
    S3_REGION: str
    S3_ENDPOINTPUT: str

    REDIS_HOST: str = '127.0.0.1'
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str
    REDIS_DB_SESSIONS: int = 0
    REDIS_DB_CACHE: int = 1
    REDIS_EXP: 5

    LOG_LEVEL: str = 'DEBUG'

    auth_jwt: AuthJWT = AuthJWT()

    model_config = SettingsConfigDict(env_file=BASE_DIR/".env",
                                      extra="ignore")

    @property
    def DATABASE_URL(self):
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_ALEMBIC(self):
        return f"postgresql://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def REDIS_URL(self) -> str:
        return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}"


settings = Settings()
