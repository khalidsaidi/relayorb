#!/usr/bin/env bash
set -euo pipefail

if [ ! -f stock_news.db ]; then
  python /app/stock_manager.py || true
fi

# Seed an AI provider from env if none is configured yet.
# StockPulse stores provider config in the sqlite DB (ai_providers table); the UI calls the API to manage it,
# but for RelayOrb we want a working default out of the box when `OPENAI_API_KEY` is provided.
python - <<'PY' || true
import os, sys
sys.path.insert(0, "/app")

from settings_manager import init_settings_table, get_active_ai_provider, add_ai_provider

# Ensure the ai_providers table exists even if the DB was created by older scripts.
init_settings_table()

if get_active_ai_provider() is None:
    api_key = os.getenv("OPENAI_API_KEY") or ""
    if api_key.strip():
        model = os.getenv("STOCKPULSE_OPENAI_MODEL") or "gpt-4o-mini"
        add_ai_provider("openai", api_key.strip(), model, set_active=True)
PY

python /app/stock_monitor_enhanced.py &

exec python /app/dashboard.py
