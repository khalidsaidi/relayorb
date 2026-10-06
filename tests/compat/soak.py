#!/usr/bin/env python3
"""Long-running soak test: one relayorb recording kept busy for N minutes.

Mixes small calls, 200 KB responses, and notification bursts, then verifies every call was
recorded and that relayorb's memory stayed flat. Linux only (reads /proc for memory).

  python3 tests/compat/soak.py --relayorb target/release/relayorb --minutes 60 --out soak.json
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shlex
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import harness  # noqa: E402
import stress  # noqa: E402


def rss_mb(pid: int) -> float:
    with open(f"/proc/{pid}/status") as f:
        for line in f:
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) / 1024
    return 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--relayorb", required=True)
    ap.add_argument("--minutes", type=float, default=60)
    ap.add_argument("--out")
    args = ap.parse_args()
    relayorb = shlex.split(args.relayorb)
    version = subprocess.run(harness.resolve(relayorb) + ["--version"], capture_output=True, text=True).stdout.strip()
    work = tempfile.mkdtemp(prefix="relayorb-soak-")
    x = stress.Ctx(relayorb, work)
    db = x.db()
    c = x.recorder(db, "soak")

    start = time.time()
    end = start + args.minutes * 60
    calls = notifications = big = 0
    samples = []  # (minute, rss MB)
    next_sample = start
    while time.time() < end:
        if calls % 50 == 0:
            resp = x.call(c, "big", size=200_000)
            assert len(stress.text_of(resp)) == 200_000
            big += 1
        elif calls % 97 == 0:
            before = c.notifications
            x.call(c, "flood", count=50)
            notifications += c.notifications - before
        else:
            assert stress.text_of(x.call(c, "echo", text=f"call {calls}")) == f"call {calls}"
        calls += 1
        if time.time() >= next_sample:
            samples.append((round((time.time() - start) / 60, 1), round(rss_mb(c.proc.pid), 1)))
            next_sample += 60
        time.sleep(0.02)

    rss_end = rss_mb(c.proc.pid)
    assert c.close() == 0
    recorded = [k for k in x.show(db, "soak")["calls"] if k["direction"] == "c2s"]
    db_mb = sum(os.path.getsize(os.path.join(work, f)) for f in os.listdir(work) if f.startswith("s1.db")) / 1e6

    # Memory must stay flat: compare the end with the 5-minute mark (after warm-up).
    warm = next((m for t, m in samples if t >= 5), samples[0][1] if samples else rss_end)
    growth = rss_end - warm
    passed = len(recorded) == calls + 1 and growth < 20
    result = {
        "relayorb": version,
        "os": f"{platform.system()} {platform.release()} {platform.machine()}",
        "date": time.strftime("%Y-%m-%d"),
        "minutes": args.minutes,
        "calls": calls,
        "recorded_calls": len(recorded) - 1,
        "large_responses": big,
        "notifications": notifications,
        "rss_mb_after_warmup": warm,
        "rss_mb_end": round(rss_end, 1),
        "rss_growth_mb": round(growth, 1),
        "db_mb": round(db_mb, 1),
        "rss_samples": samples,
        "passed": passed,
    }
    print(json.dumps({k: v for k, v in result.items() if k != "rss_samples"}, indent=2))
    if args.out:
        with open(args.out, "w") as f:
            json.dump(result, f, indent=2)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
