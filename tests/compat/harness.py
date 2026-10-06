#!/usr/bin/env python3
"""RelayOrb compatibility harness: drive real MCP servers through RelayOrb and verify every command.

For each server it:
  1. records a scripted session through `relayorb record` (a real MCP client: initialize,
     tools/list, tool calls, resources, prompts; it also answers server-initiated requests),
  2. verifies the proxy was transparent: every recorded response equals what the client got,
  3. checks `show --json` lists every call,
  4. exports the session and replays it: `relayorb replay` must return the recorded answers,
  5. runs `relayorb check` against the live server,
  6. records the session again and runs `relayorb diff` between the two runs.

Pure standard library so it runs on Linux, macOS, and Windows CI.

  python3 tests/compat/harness.py --relayorb target/release/relayorb --servers all
  python3 tests/compat/harness.py --relayorb "npx -y @khalidsaidi/relayorb@0.3.0" --servers everything,filesystem
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import queue
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback

WINDOWS = os.name == "nt"


def resolve(cmd: list[str]) -> list[str]:
    """Resolve the program on PATH (npx -> npx.cmd on Windows)."""
    exe = shutil.which(cmd[0]) or cmd[0]
    return [exe] + cmd[1:]


# ---------------------------------------------------------------- MCP client


class Client:
    """Minimal MCP stdio client. Answers server-initiated requests like a real host would."""

    def __init__(self, cmd: list[str], env: dict | None = None, cwd: str | None = None):
        self.proc = subprocess.Popen(
            resolve(cmd),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env={**os.environ, **(env or {})},
            cwd=cwd,
        )
        self.messages: queue.Queue = queue.Queue()
        self.next_id = 0
        self.notifications = 0
        self.server_requests = 0
        self.received: list[dict] = []  # every response the client got, in order
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        for raw in self.proc.stdout:
            line = raw.decode("utf-8", "replace").strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            for m in msg if isinstance(msg, list) else [msg]:
                self.messages.put(m)
        self.messages.put(None)

    def _send(self, obj):
        self.proc.stdin.write((json.dumps(obj) + "\n").encode())
        self.proc.stdin.flush()

    def _answer_server_request(self, msg):
        self.server_requests += 1
        method = msg.get("method")
        if method == "roots/list":
            result = {"roots": []}
        elif method == "sampling/createMessage":
            result = {
                "role": "assistant",
                "content": {"type": "text", "text": "harness sample"},
                "model": "harness",
                "stopReason": "endTurn",
            }
        elif method == "elicitation/create":
            result = {"action": "decline"}
        elif method == "ping":
            result = {}
        else:
            self._send({"jsonrpc": "2.0", "id": msg["id"], "error": {"code": -32601, "message": "not supported"}})
            return
        self._send({"jsonrpc": "2.0", "id": msg["id"], "result": result})

    def request(self, method: str, params=None, timeout: float = 90):
        self.next_id += 1
        rid = self.next_id
        req = {"jsonrpc": "2.0", "id": rid, "method": method}
        if params is not None:
            req["params"] = params
        self._send(req)
        deadline = time.time() + timeout
        while True:
            left = deadline - time.time()
            if left <= 0:
                raise TimeoutError(f"no answer to {method} within {timeout}s")
            msg = self.messages.get(timeout=left)
            if msg is None:
                raise EOFError(f"process closed its output while waiting for {method}")
            if "method" in msg and "id" in msg:
                self._answer_server_request(msg)
            elif "method" in msg:
                self.notifications += 1
            elif msg.get("id") == rid:
                self.received.append(msg)
                return msg

    def notify(self, method: str, params=None):
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self._send(msg)

    def close(self, timeout: float = 30) -> int:
        try:
            self.proc.stdin.close()
        except OSError:
            pass
        try:
            return self.proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            return -9


# ---------------------------------------------------------------- scenarios


def fill_args(schema: dict) -> dict:
    """Generic arguments for a tool: fill required properties with small safe values."""
    props = (schema or {}).get("properties", {}) or {}
    args = {}
    for name in (schema or {}).get("required", []) or []:
        spec = props.get(name, {}) or {}
        kind = spec.get("type")
        if "enum" in spec and spec["enum"]:
            args[name] = spec["enum"][0]
        elif kind in ("number", "integer"):
            args[name] = 1
        elif kind == "boolean":
            args[name] = False
        elif kind == "array":
            args[name] = []
        elif kind == "object":
            args[name] = {}
        else:
            args[name] = "hello"
    return args


def generic_scenario(c: Client, init: dict, pick_tools: list[str], extra_calls=()):
    """tools/list, call tools whose name contains any of pick_tools, then resources and prompts."""
    tools = c.request("tools/list").get("result", {}).get("tools", [])
    by_name = {t["name"]: t for t in tools}
    called = set()
    for want in pick_tools:
        for name, tool in by_name.items():
            if want.lower() in name.lower() and name not in called:
                called.add(name)
                c.request("tools/call", {"name": name, "arguments": fill_args(tool.get("inputSchema", {}))})
                break
    for name, args in extra_calls:
        c.request("tools/call", {"name": name, "arguments": args})
    caps = init.get("result", {}).get("capabilities", {})
    if "resources" in caps:
        res = c.request("resources/list").get("result", {}).get("resources", [])
        if res:
            c.request("resources/read", {"uri": res[0]["uri"]})
    if "prompts" in caps:
        prompts = c.request("prompts/list").get("result", {}).get("prompts", [])
        for p in prompts[:1]:
            args = {a["name"]: "hello" for a in p.get("arguments", []) if a.get("required")}
            c.request("prompts/get", {"name": p["name"], "arguments": args})


def run_session(cmd: list[str], scenario, env=None, cwd=None):
    c = Client(cmd, env=env, cwd=cwd)
    init = c.request(
        "initialize",
        {
            "protocolVersion": "2025-06-18",
            "capabilities": {"roots": {"listChanged": False}, "sampling": {}},
            "clientInfo": {"name": "relayorb-compat-harness", "version": "1.0"},
        },
    )
    if "error" in init:
        raise RuntimeError(f"initialize failed: {init['error']}")
    c.notify("notifications/initialized")
    scenario(c, init)
    code = c.close()
    return c, code


# ---------------------------------------------------------------- servers


def servers(work: str, only: set[str]):
    fsdir = os.path.join(work, "fs")
    os.makedirs(fsdir, exist_ok=True)
    with open(os.path.join(fsdir, "a.txt"), "w") as f:
        f.write("hello from a\n")
    with open(os.path.join(fsdir, "unicode-ü.txt"), "w", encoding="utf-8") as f:
        f.write("emoji 🚀 and ünïcödé\n")
    repo = os.path.join(work, "repo")
    os.makedirs(repo, exist_ok=True)
    git_env = {"GIT_AUTHOR_NAME": "h", "GIT_AUTHOR_EMAIL": "h@h", "GIT_COMMITTER_NAME": "h", "GIT_COMMITTER_EMAIL": "h@h"}
    if shutil.which("git") and not os.path.isdir(os.path.join(repo, ".git")):
        for args in (["init", "-q"], ["commit", "-q", "--allow-empty", "-m", "first"]):
            subprocess.run(["git", *args], cwd=repo, env={**os.environ, **git_env}, check=True)

    defs = [
        dict(
            name="filesystem",
            runtime="node",
            cmd=["npx", "-y", "@modelcontextprotocol/server-filesystem", fsdir],
            scenario=lambda c, init: generic_scenario(
                c,
                init,
                [],
                [
                    ("list_allowed_directories", {}),
                    ("list_directory", {"path": fsdir}),
                    ("read_text_file", {"path": os.path.join(fsdir, "a.txt")}),
                    ("read_text_file", {"path": os.path.join(fsdir, "unicode-ü.txt")}),
                    ("read_text_file", {"path": "/etc/hostname-outside-allowed"}),
                    ("search_files", {"path": fsdir, "pattern": "a"}),
                ],
            ),
            deterministic=True,
        ),
        dict(
            name="everything",
            runtime="node",
            cmd=["npx", "-y", "@modelcontextprotocol/server-everything"],
            scenario=lambda c, init: generic_scenario(
                c, init, ["echo", "sum", "add", "long", "sampl", "image", "annotat", "structured"]
            ),
            deterministic=True,  # check answers sampling requests from the recording
        ),
        dict(
            name="memory",
            runtime="node",
            cmd=["npx", "-y", "@modelcontextprotocol/server-memory"],
            env=lambda run: {"MEMORY_FILE_PATH": os.path.join(work, f"memory-{run}.jsonl")},
            scenario=lambda c, init: generic_scenario(
                c,
                init,
                [],
                [
                    ("create_entities", {"entities": [{"name": "RelayOrb", "entityType": "tool", "observations": ["records MCP"]}]}),
                    ("search_nodes", {"query": "RelayOrb"}),
                    ("read_graph", {}),
                ],
            ),
            deterministic=True,
        ),
        dict(
            name="time",
            runtime="python",
            cmd=["uvx", "mcp-server-time", "--local-timezone", "UTC"],
            scenario=lambda c, init: generic_scenario(
                c,
                init,
                [],
                [
                    ("convert_time", {"source_timezone": "UTC", "time": "12:00", "target_timezone": "Asia/Tokyo"}),
                    ("get_current_time", {"timezone": "UTC"}),
                ],
            ),
            deterministic=False,  # get_current_time changes every run
        ),
        dict(
            name="git",
            runtime="python",
            cmd=["uvx", "mcp-server-git", "--repository", repo],
            scenario=lambda c, init: generic_scenario(
                c, init, [], [("git_status", {"repo_path": repo}), ("git_log", {"repo_path": repo, "max_count": 5})]
            ),
            deterministic=True,
        ),
        dict(
            name="fetch",
            runtime="python",
            cmd=["uvx", "mcp-server-fetch"],
            scenario=lambda c, init: generic_scenario(
                c, init, [], [("fetch", {"url": "https://example.com", "max_length": 2000})]
            ),
            deterministic=True,
        ),
        dict(
            name="github",
            runtime="docker",
            cmd=[
                "docker", "run", "-i", "--rm",
                "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "-e", "GITHUB_READ_ONLY=1", "-e", "GITHUB_TOOLSETS=repos",
                "ghcr.io/github/github-mcp-server",
            ],
            scenario=lambda c, init: generic_scenario(
                c,
                init,
                [],
                [
                    ("search_repositories", {"query": "repo:khalidsaidi/relayorb"}),
                    ("get_file_contents", {"owner": "khalidsaidi", "repo": "relayorb", "path": "LICENSE"}),
                ],
            ),
            deterministic=False,  # search results carry live counters (stars, updated_at)
            needs_env=["GITHUB_PERSONAL_ACCESS_TOKEN"],
        ),
    ]
    return [d for d in defs if "all" in only or d["name"] in only]


# ---------------------------------------------------------------- checks


def strip_id(msg: dict) -> dict:
    return {k: v for k, v in msg.items() if k not in ("id", "jsonrpc")}


def relayorb_run(relayorb: list[str], db: str, args: list[str], timeout: float = 300, env: dict | None = None):
    return subprocess.run(
        resolve(relayorb) + ["--db", db] + args,
        capture_output=True,
        timeout=timeout,
        env={**os.environ, **(env or {})},
    )


def test_server(relayorb: list[str], spec: dict, work: str) -> dict:
    name = spec["name"]
    db = os.path.join(work, f"{name}.db")
    env_for = spec.get("env", lambda run: {})
    result = {"server": name, "runtime": spec["runtime"], "steps": {}, "notes": []}
    steps = result["steps"]

    for var in spec.get("needs_env", []):
        if not os.environ.get(var):
            result["skipped"] = f"{var} not set"
            return result
    if not shutil.which(spec["cmd"][0]):
        result["skipped"] = f"{spec['cmd'][0]} not installed"
        return result

    # 1. record
    rec_cmd = relayorb + ["--db", db, "record", "--name", name, "--"] + spec["cmd"]
    client, code = run_session(rec_cmd, spec["scenario"], env=env_for(1))
    steps["record"] = code == 0
    result["calls"] = len(client.received)
    result["notifications"] = client.notifications
    result["server_requests"] = client.server_requests
    if code != 0:
        result["notes"].append(f"record exit code {code}")

    # 2. transparency + 3. show
    shown = relayorb_run(relayorb, db, ["show", name, "--json"])
    calls = json.loads(shown.stdout)["calls"] if shown.returncode == 0 else []
    c2s = [c for c in calls if c["direction"] == "c2s"]
    steps["show"] = shown.returncode == 0 and len(c2s) == len(client.received)
    if not steps["show"]:
        result["notes"].append(f"show listed {len(c2s)} client calls, client sent {len(client.received)}")
    recorded = [strip_id(c["response"]) for c in c2s if c["response"]]
    got = [strip_id(m) for m in client.received]
    steps["transparent"] = recorded == got
    if not steps["transparent"]:
        result["notes"].append("recorded responses differ from what the client received")

    # 4. export + replay
    fixture = os.path.join(work, f"{name}.json")
    exp = relayorb_run(relayorb, db, ["export", name, "-o", fixture])
    steps["export"] = exp.returncode == 0 and os.path.isfile(fixture)
    replay_client, rcode = run_session(relayorb + ["replay", fixture], spec["scenario"], env=env_for(1))
    replayed = [strip_id(m) for m in replay_client.received]
    steps["replay"] = rcode == 0 and replayed == got
    if replayed != got:
        mismatches = sum(1 for a, b in zip(replayed, got) if a != b) + abs(len(replayed) - len(got))
        result["notes"].append(f"replay: {mismatches} answer(s) differ from the recording")

    # 5. check against the live server
    # The live server gets fresh state (e.g. its own memory file), like a clean CI run.
    chk = relayorb_run(relayorb, db, ["check", fixture, "--timeout", "90", "--"] + spec["cmd"], timeout=600, env=env_for("check"))
    result["check_exit"] = chk.returncode
    if spec["deterministic"]:
        steps["check"] = chk.returncode == 0
    else:
        # Non-deterministic servers: check must run cleanly (0 or 1), never crash (2).
        steps["check"] = chk.returncode in (0, 1)
        if chk.returncode == 1:
            result["notes"].append("check reported expected differences (non-deterministic server)")
    if chk.returncode == 2:
        result["notes"].append("check error: " + chk.stderr.decode(errors="replace").strip()[-200:])

    # 6. second run + diff
    time.sleep(0.05)
    run_session(rec_cmd, spec["scenario"], env=env_for(2))
    dif = relayorb_run(relayorb, db, ["diff", f"{name}~1", name, "--json"])
    try:
        report = json.loads(dif.stdout)
        result["diff_identical"] = report["identical"]
        steps["diff"] = dif.returncode in (0, 1) and (report["identical"] or not spec["deterministic"])
        if not report["identical"]:
            fd = report["first_divergence"]
            result["notes"].append(f"diff: first divergence at call #{fd['call']} ({fd['kind']}, {fd['a']['label'] if fd['a'] else '-'})")
    except (json.JSONDecodeError, KeyError):
        steps["diff"] = False
        result["notes"].append("diff output was not valid JSON")

    result["passed"] = all(steps.values())
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--relayorb", required=True, help="relayorb command, e.g. target/release/relayorb or 'npx -y @khalidsaidi/relayorb'")
    ap.add_argument("--servers", default="all")
    ap.add_argument("--out", help="write JSON results here")
    args = ap.parse_args()

    relayorb = shlex.split(args.relayorb, posix=not WINDOWS)
    version = subprocess.run(resolve(relayorb) + ["--version"], capture_output=True, text=True).stdout.strip()
    work = tempfile.mkdtemp(prefix="relayorb-compat-")
    only = set(args.servers.split(","))
    results = []
    for spec in servers(work, only):
        t0 = time.time()
        try:
            r = test_server(relayorb, spec, work)
        except Exception as e:  # noqa: BLE001 - report every failure, keep going
            r = {"server": spec["name"], "runtime": spec["runtime"], "passed": False, "steps": {}, "notes": [f"{type(e).__name__}: {e}"]}
            traceback.print_exc()
        r["seconds"] = round(time.time() - t0, 1)
        results.append(r)
        status = "SKIP" if r.get("skipped") else ("PASS" if r.get("passed") else "FAIL")
        steps = " ".join(f"{k}={'ok' if v else 'FAIL'}" for k, v in r.get("steps", {}).items())
        print(f"{status:4}  {r['server']:11} {steps}  {r.get('skipped', '')} {' | '.join(r.get('notes', []))}", flush=True)

    summary = {
        "relayorb": version,
        "os": f"{platform.system()} {platform.release()} {platform.machine()}",
        "python": platform.python_version(),
        "date": time.strftime("%Y-%m-%d"),
        "results": results,
    }
    if args.out:
        with open(args.out, "w") as f:
            json.dump(summary, f, indent=2)
    shutil.rmtree(work, ignore_errors=True)
    failed = [r for r in results if not r.get("skipped") and not r.get("passed")]
    print(f"\n{len(results) - len(failed)}/{len(results)} servers passed ({version}, {summary['os']})")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
