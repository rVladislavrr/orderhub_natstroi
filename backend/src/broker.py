from taskiq_redis import RedisStreamBroker

from src.config import settings

broker = RedisStreamBroker(
    url=settings.REDIS_URL
)
