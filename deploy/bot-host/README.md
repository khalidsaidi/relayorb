# RelayOrb Bot Host (Docker Compose)

This stack runs the real bots plus the RelayOrb agent on a single host. The UI stays on Firebase Hosting; the bot host pushes data to Firestore and executes commands.

## Layout
- `agent-config/` RelayOrb agent config (bots + API creds)
- `secrets/` Firebase service account JSON (never commit)

## One-time setup
1) Copy the sample configs:
```bash
cp agent-config/config.example.json agent-config/config.json
```

2) Place your Firebase service account JSON here:
```
secrets/service-account.json
```

3) Provide market data keys for Backtrader (via shell or a local `.env` file):
```bash
export MARKET_DATA_GATEWAY_URL=...
export FMP_API_KEY=...
```

Optional: enable event-triggered scans (market-intel new_batch):
```bash
export REDIS_URL=redis://10.19.89.107:6379
export REDIS_PREFIX=relayorb
```

4) Update `agent-config/config.json` with real credentials and ensure each bot `baseUrl` matches the Docker service name.
   - Optional: seed `desiredConfig` (mode/exchange/pairs/timeframe) and `capabilities` lists for the UI pickers.

## Start the stack
```bash
docker compose up -d
```

## Agent updates
The bot host pulls a prebuilt agent image from `gcr.io/relayorb/relayorb-agent`. Use the
"Update Agent" command in the UI to trigger a safe rolling update (pull + restart of the
agent container only). The `relayorb-updater` service watches for these commands.

## Notes
- Backtrader runs in paper mode by default. Add broker keys only when ready.
- The UI stores the trading universe in Firestore. Use the "Apply Config" action to trigger adapters; some bots still require manual config updates.
- The agent can write config files directly when mounted if an adapter supports local config sync.
- No ports are exposed publicly by default. Use SSH port-forwarding if you need to reach APIs.
