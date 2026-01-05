# RelayOrb Bot Host (Docker Compose)

This stack runs the real bots plus the RelayOrb agent on a single host. The UI stays on Firebase Hosting; the bot host pushes data to Firestore and executes commands.

## Layout
- `agent-config/` RelayOrb agent config (bots + API creds)
- `freqtrade/` Freqtrade config and data
- `hummingbot/` Hummingbot API env + bot data
- `jesse/` Jesse project directory + .env
- `secrets/` Firebase service account JSON (never commit)

## One-time setup
1) Copy the sample configs:
```bash
cp agent-config/config.example.json agent-config/config.json
mkdir -p freqtrade/user_data
cp freqtrade/user_data/config.example.json freqtrade/user_data/config.json
cp hummingbot/.env.example hummingbot/.env
cp jesse/.env.example jesse/.env
```

2) Place your Firebase service account JSON here:
```
secrets/service-account.json
```

3) Initialize a Jesse project (required for `jesse run`):
```bash
docker run --rm -it -v "$PWD/jesse:/workspace" salehmir/jesse jesse make-project .
```

4) Update `agent-config/config.json` with real credentials and ensure each bot `baseUrl` matches the Docker service name.
   - Optional: seed `desiredConfig` (mode/exchange/pairs/timeframe) and `capabilities` lists for the UI pickers.

## Start the stack
```bash
docker compose up -d
```

## Notes
- Freqtrade runs in dry-run mode by default. Add exchange keys only when ready.
- Hummingbot API uses the Docker socket to orchestrate bots; that’s why `/var/run/docker.sock` is mounted.
- Jesse requires a valid `.env` with a non-empty `PASSWORD`.
- Jesse runs with its own Postgres container; keep the `POSTGRES_*` values in `jesse/.env` consistent.
- The UI stores the trading universe in Firestore. Use the "Apply Config" action to trigger adapters; some bots still require manual config updates.
- No ports are exposed publicly by default. Use SSH port-forwarding if you need to reach APIs.
