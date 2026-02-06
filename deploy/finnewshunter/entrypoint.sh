#!/usr/bin/env bash
set -euo pipefail

export PYTHONPATH=${PYTHONPATH:-/app/backend}

# Wait for postgres
if [ -n "${POSTGRES_HOST:-}" ]; then
  echo "Waiting for Postgres at $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
  for i in $(seq 1 60); do
    if nc -z "$POSTGRES_HOST" "${POSTGRES_PORT:-5432}"; then
      break
    fi
    sleep 2
  done
fi

python /app/backend/init_db.py || true

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8010}
