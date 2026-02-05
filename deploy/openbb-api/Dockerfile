FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir openbb

EXPOSE 6900

CMD ["openbb-api", "--host", "0.0.0.0", "--port", "6900"]
