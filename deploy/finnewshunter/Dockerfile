FROM python:3.11-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl build-essential netcat-openbsd \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git clone --depth 1 https://github.com/DemonDamon/FinnewsHunter.git .

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

COPY ensure_overrides.py /tmp/ensure_overrides.py
COPY overrides /tmp/overrides
RUN python /tmp/ensure_overrides.py

RUN pip install --no-cache-dir -r backend/requirements.txt

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PYTHONPATH=/app/backend

EXPOSE 8010

ENTRYPOINT ["/entrypoint.sh"]
