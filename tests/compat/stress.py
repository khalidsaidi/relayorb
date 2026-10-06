#!/usr/bin/env python3
"""RelayOrb stress tests: large payloads, long and concurrent sessions, crashes, kills,
non-JSON output, batches, unicode, and notification floods.

  python3 tests/compat/stress.py --relayorb target/release/relayorb [--out results.json]
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shlex
import signal
import subprocess
import sys
import tempfile
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness  # noqa: E402

SERVER = [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "stress_server.py")]
WINDOWS = os.name == "nt"


class Ctx:
    def __init__(self, relayorb: list[str], work: str):
        self.relayorb = relayorb
        self.work = work
        self.n = 0

    def db(self):
        self.n += 1
        return os.path.join(self.work, f"s{self.n}.db")

    def recorder(self, db: str, name: str, extra_server_args=()):
        cmd = self.relayorb + ["--db", db, "record", "--name", name, "--"] + SERVER + list(extra_server_args)
        c = harness.Client(cmd, stderr_path=os.path.join(self.work, f"{name}.stderr"))
        init = c.request("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "stress", "version": "1"}})
        assert "result" in init, init
        c.notify("notifications/initialized")
        return c

    def run(self, db: str, args: list[str]):
        return subprocess.run(harness.resolve(self.relayorb) + ["--db", db] + args, capture_output=True, timeout=300)

    def show(self, db: str, name: str):
        out = self.run(db, ["show", name, "--json"])
        assert out.returncode == 0, out.stderr
        return json.loads(out.stdout)

    def call(self, c, name, **args):
        return c.request("tools/call", {"name": name, "arguments": args}, timeout=180)


def text_of(resp):
    return resp["result"]["content"][0]["text"]


# ---------------------------------------------------------------- tests


def t_large_payload(x: Ctx):
    db = x.db()
    c = x.recorder(db, "big")
    t0 = time.time()
    resp = x.call(c, "big", size=5_000_000)
    elapsed = time.time() - t0
    assert c.close() == 0
    assert len(text_of(resp)) == 5_000_000, len(text_of(resp))
    rec = x.show(db, "big")["calls"][-1]["response"]
    assert len(rec["result"]["content"][0]["text"]) == 5_000_000
    fixture = os.path.join(x.work, "big.json")
    assert x.run(db, ["export", "big", "-o", fixture]).returncode == 0
    r = harness.Client(x.relayorb + ["replay", fixture])
    r.request("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "s", "version": "1"}})
    replayed = r.request("tools/call", {"name": "big", "arguments": {"size": 5_000_000}})
    r.close()
    assert len(text_of(replayed)) == 5_000_000
    return f"5 MB response relayed, recorded, and replayed intact ({elapsed:.2f}s through the proxy)"


def t_long_session(x: Ctx):
    db = x.db()
    c = x.recorder(db, "long")
    t0 = time.time()
    for i in range(2000):
        assert text_of(x.call(c, "echo", text=f"call {i}")) == f"call {i}"
    elapsed = time.time() - t0
    assert c.close() == 0
    calls = [k for k in x.show(db, "long")["calls"] if k["direction"] == "c2s"]
    assert len(calls) == 2001, len(calls)  # initialize + 2000
    assert all(k["status"] == "ok" for k in calls)
    return f"2,000 sequential calls, all recorded ({elapsed / 2000 * 1000:.2f} ms per round trip incl. client)"


def t_concurrent(x: Ctx):
    db = x.db()
    errors = []
    start = threading.Barrier(5)  # all five create the brand-new database at the same instant

    def worker(i):
        try:
            start.wait()
            c = x.recorder(db, f"par{i}")
            for j in range(200):
                assert text_of(x.call(c, "echo", text=f"{i}-{j}")) == f"{i}-{j}"
            assert c.close() == 0
        except Exception as e:  # noqa: BLE001
            errors.append(f"worker {i}: {e}")

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors, errors
    for i in range(5):
        n = len([k for k in x.show(db, f"par{i}")["calls"] if k["direction"] == "c2s"])
        assert n == 201, (i, n)
    return "5 recordings started at the same instant on a new database, 200 calls each, nothing lost"


def t_server_crash(x: Ctx):
    db = x.db()
    c = x.recorder(db, "crash")
    x.call(c, "echo", text="before crash")
    try:
        x.call(c, "crash")
        raise AssertionError("crash call should not get an answer")
    except EOFError:
        pass
    code = c.close()
    assert code == 3, f"relayorb exit code {code}, expected the server's 3"
    shown = x.show(db, "crash")
    assert shown["session"].get("exit_code") == 3, shown["session"]
    statuses = [k["status"] for k in shown["calls"] if k["direction"] == "c2s"]
    assert statuses[-1] == "no answer", statuses
    return "server died mid-call: agent sees end-of-stream, relayorb exits with the server's code (3), session saved with the unanswered call"


def t_sigterm(x: Ctx):
    if WINDOWS:
        return "skipped on Windows (no SIGTERM)"
    db = x.db()
    c = x.recorder(db, "term", ["--marker-term"])
    x.call(c, "echo", text="hi")
    c.proc.send_signal(signal.SIGTERM)
    code = c.proc.wait(timeout=15)
    time.sleep(0.5)
    left = subprocess.run(["pgrep", "-f", "stress_server.py --marker-term"], capture_output=True, text=True).stdout.split()
    assert not left, f"server still running after SIGTERM: {left}"
    shown = x.show(db, "term")
    assert shown["session"].get("ended_at_ms"), "session not finished"
    return f"SIGTERM to relayorb: server stopped, session saved (relayorb exit {code})"


def t_sigkill(x: Ctx):
    if WINDOWS:
        return "skipped on Windows (no SIGKILL)"
    db = x.db()
    c = x.recorder(db, "kill", ["--marker-kill"])
    x.call(c, "echo", text="hi")
    c.proc.kill()
    c.proc.wait(timeout=15)
    deadline = time.time() + 10
    while time.time() < deadline:
        left = subprocess.run(["pgrep", "-f", "stress_server.py --marker-kill"], capture_output=True, text=True).stdout.split()
        if not left:
            break
        time.sleep(0.2)
    assert not left, f"server orphaned after relayorb was killed: {left}"
    calls = [k for k in x.show(db, "kill")["calls"] if k["direction"] == "c2s"]
    assert len(calls) == 2, len(calls)
    return "relayorb killed with SIGKILL: server exits on its own (stdin closes), calls recorded so far are kept; session stays marked running"


def t_garbage(x: Ctx):
    db = x.db()
    c = x.recorder(db, "garbage")
    assert text_of(x.call(c, "garbage")) == "after garbage"
    assert c.close() == 0
    out = x.run(db, ["show", "garbage"]).stdout.decode()
    assert "(not JSON-RPC) this is not json-rpc" in out, out
    return "non-JSON line on stdout: forwarded untouched, recorded and shown as (not JSON-RPC), session continues"


def t_batch(x: Ctx):
    db = x.db()
    c = x.recorder(db, "batch")
    c._send([
        {"jsonrpc": "2.0", "id": 101, "method": "tools/call", "params": {"name": "echo", "arguments": {"text": "one"}}},
        {"jsonrpc": "2.0", "id": 102, "method": "tools/call", "params": {"name": "echo", "arguments": {"text": "two"}}},
    ])
    got = {}
    while len(got) < 2:
        m = c.messages.get(timeout=20)
        if m and m.get("id") in (101, 102):
            got[m["id"]] = text_of(m)
    assert got == {101: "one", 102: "two"}, got
    assert c.close() == 0
    calls = [k for k in x.show(db, "batch")["calls"] if k["direction"] == "c2s" and k["method"] == "tools/call"]
    assert len(calls) == 2 and all(k["status"] == "ok" for k in calls), calls
    fixture = os.path.join(x.work, "batch.json")
    x.run(db, ["export", "batch", "-o", fixture])
    rp = subprocess.run(
        harness.resolve(x.relayorb) + ["replay", fixture],
        input=(json.dumps([
            {"jsonrpc": "2.0", "id": "a", "method": "tools/call", "params": {"name": "echo", "arguments": {"text": "one"}}},
            {"jsonrpc": "2.0", "id": "b", "method": "tools/call", "params": {"name": "echo", "arguments": {"text": "two"}}},
        ]) + "\n").encode(),
        capture_output=True, timeout=30,
    )
    reply = json.loads(rp.stdout.decode().strip().splitlines()[0])
    assert isinstance(reply, list) and [text_of(r) for r in reply] == ["one", "two"], reply
    return "JSON-RPC batch: both calls recorded and paired; replay answers a batch with a batch"


def t_unicode(x: Ctx):
    db = x.db()
    c = x.recorder(db, "unicode")
    s = "emoji 🚀🔥 中文 ünïcödé  sep  tab\t \"quotes\" \\backslash " + "é" * 10000
    assert text_of(x.call(c, "echo", text=s)) == s
    assert c.close() == 0
    rec = x.show(db, "unicode")["calls"][-1]["response"]["result"]["content"][0]["text"]
    assert rec == s
    return "unicode, emoji, line/paragraph separators, escapes: byte-exact through the proxy and in the recording"


def t_flood(x: Ctx):
    db = x.db()
    c = x.recorder(db, "flood")
    assert text_of(x.call(c, "flood", count=2000)) == "flooded"
    assert c.notifications == 2000, c.notifications
    assert c.close() == 0
    shown = x.run(db, ["show", "flood"]).stdout.decode()
    assert shown.count("notifications/progress") == 2000
    return "2,000 progress notifications during one call: all forwarded in order and recorded"


TESTS = [t_large_payload, t_long_session, t_concurrent, t_server_crash, t_sigterm, t_sigkill, t_garbage, t_batch, t_unicode, t_flood]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--relayorb", required=True)
    ap.add_argument("--out")
    args = ap.parse_args()
    relayorb = shlex.split(args.relayorb, posix=not WINDOWS)
    version = subprocess.run(harness.resolve(relayorb) + ["--version"], capture_output=True, text=True).stdout.strip()
    work = tempfile.mkdtemp(prefix="relayorb-stress-")
    x = Ctx(relayorb, work)
    results = []
    for t in TESTS:
        name = t.__name__[2:]
        t0 = time.time()
        try:
            detail = t(x)
            ok = True
        except Exception as e:  # noqa: BLE001
            detail, ok = f"{type(e).__name__}: {e}", False
        results.append({"test": name, "passed": ok, "detail": detail, "seconds": round(time.time() - t0, 1)})
        print(f"{'PASS' if ok else 'FAIL'}  {name:14} {detail}", flush=True)
    summary = {"relayorb": version, "os": f"{platform.system()} {platform.release()} {platform.machine()}", "date": time.strftime("%Y-%m-%d"), "results": results}
    if args.out:
        with open(args.out, "w") as f:
            json.dump(summary, f, indent=2)
    failed = [r for r in results if not r["passed"]]
    print(f"\n{len(results) - len(failed)}/{len(results)} stress tests passed ({version}, {summary['os']})")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
