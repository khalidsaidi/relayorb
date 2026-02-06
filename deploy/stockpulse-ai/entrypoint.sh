#!/usr/bin/env bash
set -euo pipefail

if [ ! -f stock_news.db ]; then
  python /app/stock_manager.py || true
fi

python /app/stock_monitor_enhanced.py &

exec python /app/dashboard.py
