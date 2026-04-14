import asyncio
import io
import json
import logging
import pickle

import redis.asyncio as redis
from fastapi import HTTPException, status

from src.config import settings


class RedisClient:
    exp: int = settings.REDIS_EXP

    def __init__(self):
        self.redis = None

    async def connect(self):
        if self.redis is None:
            for attempt in range(3):
                try:
                    self.redis = await redis.from_url(settings.REDIS_URL, decode_responses=False)
                    await self.redis.ping()
                    print("✅ Successfully connected to Redis")
                    return
                except Exception as e:
                    print(f"⚠️ Redis connection failed (attempt {attempt + 1}/3): {e}")
                    await asyncio.sleep(2)

            print("❌ Could not connect to Redis after 3 attempts")
            raise RuntimeError("Redis connection failed")

    async def get_redis(self):
        if self.redis is None:
            print("🔄 Reconnecting to Redis...")
            await self.connect()

        if self.redis is None:
            raise ConnectionError("❌ Redis is unavailable")
        return self.redis

    async def close(self):
        if self.redis:
            await self.redis.close()

    async def load(self, name_obj, obj):
        try:
            r = await self.get_redis()
            await r.setex(name_obj,
                          60 * 3,
                          obj
                          )
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail={"msg": "Obj is not cached", })


redis_client = RedisClient()
log = logging.getLogger('Redis')

async def load_inf(key, data):
    await redis_client.load(key, json.dumps(data))


async def get_inf(key):
    try:
        redis = await redis_client.get_redis()
        data = await redis.get(key)
        if data:
            log.info('Из кеша')
            return json.loads(data)
        log.info('Не в кеше')
        return None
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail={"msg": "Obj is not cached", })
