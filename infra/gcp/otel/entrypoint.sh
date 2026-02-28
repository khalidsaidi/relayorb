#!/bin/sh
set -eu

# Start the IAM-aware proxy used by the collector's local Prometheus scrape.
/usr/local/bin/relayorb-metrics-proxy &
PROXY_PID="$!"

cleanup() {
  kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

/otelcol-contrib --config /etc/otelcol-contrib/config.yaml
