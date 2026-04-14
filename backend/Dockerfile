FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .


RUN pip install --upgrade pip --timeout 100 && \
#    pip install taskiq && pip install taskiq-redis && \
    pip install -r requirements.txt --timeout 100 --retries 10 --index-url https://pypi.org/simple/


COPY . .


EXPOSE 8000


CMD alembic upgrade head && \
    gunicorn src.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
