# RelayOrb UI Dev Server (Windows + WSL)

Goal: make the Vite dev server reachable from **Windows browsers** and keep HMR stable.

## Start / Stop (tmux)

From WSL in the repo root:

```bash
cd /home/khalid/relayorb

# Start (keeps running even if the IDE/terminal dies)
bash scripts/ui-dev.sh start
#
# Or pick a known-good port explicitly:
# bash scripts/ui-dev.sh start 5300

# Status + last logs
bash scripts/ui-dev.sh status

# Stop / restart
bash scripts/ui-dev.sh stop
bash scripts/ui-dev.sh restart
#
# Or restart on a specific port:
# bash scripts/ui-dev.sh restart 5300
```

Default URL (Windows + WSL): `http://localhost:5170/` (override with the optional port arg).

## Why Not 5173?

Many Windows setups reserve/exclude port ranges that include Vite's default `5173`.

Check on Windows:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

If you see `5171-5270` excluded, `5173` will not work from Windows even if the server is running in WSL.

## Pick Another Port

Override the port (one-off):

```bash
cd /home/khalid/relayorb
bash scripts/ui-dev.sh restart 5300
```

Then open: `http://localhost:5300/`

## HMR (WebSocket) Stability

The dev script forces the HMR websocket to IPv4 (`127.0.0.1`) and uses the same port as HTTP.

If you see:
`[vite] failed to connect to websocket`

it almost always means you opened the wrong port (e.g. `5173` instead of `5170`) or Windows has excluded the chosen port.

## Firebase Auth: `auth/unauthorized-domain`

Firebase popup auth typically authorizes `localhost` but not `127.0.0.1` or a WSL IP like `172.x.x.x`.

In dev, the app auto-redirects Windows browsers opened on an IP/`127.0.0.1` to `localhost` to keep sign-in working.

## Angular Equivalent Flags (Same Intent)

If you need the same "bind all interfaces + fixed port" behavior with Angular CLI:

```bash
ng serve --host 0.0.0.0 --port 5300 --disable-host-check
```

If HMR websocket resolution is flaky in Windows+WSL, also set an explicit public host:

```bash
ng serve --host 0.0.0.0 --port 5300 --public-host localhost:5300 --hmr
```
