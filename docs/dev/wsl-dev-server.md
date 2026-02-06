# RelayOrb UI Dev Server (WSL2 + Windows Browser)

This repo's UI is a Vite dev server running inside WSL2. If you open it from a Windows browser, the most reliable setup is to:

- Bind Vite to all interfaces (IPv4) inside WSL
- Open the UI using the WSL IP (not `localhost`)

## Start (Persistent)

Run from WSL (repo root) in `tmux` so it survives terminal/IDE restarts:

```bash
tmux new -d -s relayorb_dev 'cd /home/khalid/relayorb && npm run dev -- --host 0.0.0.0 --port 5173 --strictPort --clearScreen false'
```

## Verify It's Listening

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
hostname -I
```

Expected:

- `lsof` shows `node ... TCP *:5173 (LISTEN)`
- `hostname -I` prints one or more `172.x.x.x` WSL2 addresses (example: `172.25.148.103`)

## Open From Windows

Use the WSL IP reported by `hostname -I`:

- `http://172.25.148.103:5173/`

Avoid `http://localhost:5173/` from Windows if Vite HMR WebSocket is flaky; using the WSL IP makes the HMR WebSocket target the correct host.

## Debug (If You Can't Reach It)

```bash
tmux capture-pane -pt relayorb_dev | tail -n 80
```

Common fixes:

- Make sure you're opening the WSL IP URL (not `localhost`)
- Confirm port `5173` is not taken: `lsof -nP -iTCP:5173 -sTCP:LISTEN`
- If Windows Firewall blocks it, allow inbound `5173` to the WSL VM network

## Stop / Restart

```bash
tmux kill-session -t relayorb_dev
tmux new -d -s relayorb_dev 'cd /home/khalid/relayorb && npm run dev -- --host 0.0.0.0 --port 5173 --strictPort --clearScreen false'
```

## Similar Angular Flags

If you ever need the same behavior in an Angular dev server:

```bash
ng serve --host 0.0.0.0 --port 5173
```

If the Angular HMR client tries to connect to the wrong host, add a public host (set this to the WSL IP you open in the browser):

```bash
ng serve --host 0.0.0.0 --port 5173 --public-host 172.25.148.103:5173
```

