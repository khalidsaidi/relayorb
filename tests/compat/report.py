#!/usr/bin/env python3
"""Turn compatibility-run artifacts into TESTING.md and the website's test-results data.

  gh run download <run-id> -D results/
  python3 tests/compat/report.py results/ --run-url https://github.com/.../actions/runs/<id>
"""
from __future__ import annotations

import argparse
import glob
import json
import os

OS_ORDER = [("ubuntu-latest", "Linux x64"), ("macos-latest", "macOS arm64"), ("windows-latest", "Windows x64")]

SERVER_INFO = {
    "filesystem": ("@modelcontextprotocol/server-filesystem", "Node", "reads, directory listing, search, unicode filenames, a denied path"),
    "everything": ("@modelcontextprotocol/server-everything", "Node", "the MCP reference test server: progress notifications, LLM sampling requests from the server, images, resources, prompts, structured content"),
    "memory": ("@modelcontextprotocol/server-memory", "Node", "writes then reads a knowledge graph"),
    "time": ("mcp-server-time", "Python", "deterministic conversion plus a clock that changes every run"),
    "git": ("mcp-server-git", "Python", "status and log on a real repository"),
    "fetch": ("mcp-server-fetch", "Python", "fetches a live web page"),
    "github": ("github/github-mcp-server", "Go (Docker)", "GitHub's official server, read-only: repository search and file contents"),
}

STEP_INFO = [
    ("record", "recorded through `relayorb record` with a real MCP client"),
    ("transparent", "every response recorded equals what the client received"),
    ("show", "`show --json` lists every call"),
    ("export", "`export` writes a session file"),
    ("replay", "`replay` returns the recorded answers for the same calls"),
    ("check", "`check` re-runs the calls against the live server"),
    ("diff", "`diff` compares two runs"),
]

AGENT_TESTS = [
    ("Claude Code 2.1.292", "relayorb binary as the MCP command, filesystem server", "pass", "2026-10-05"),
    ("Claude Code 2.1.292", "`npx -y @khalidsaidi/relayorb@latest` as the MCP command (no install)", "pass", "2026-10-06"),
    ("Claude Code 2.1.292", "two runs, file changed in between, `relayorb diff` pinpoints the changed call", "pass", "2026-10-06"),
]

FIXED = [
    "`record`: if relayorb was killed (SIGKILL) right after a call, that call could be missing from the recording. Messages are now stored before they are forwarded.",
    "`check`: tools that ask the agent something mid-call (LLM sampling) failed, because check answered with an error. It now answers the way the agent did in the recording.",
    "Windows: `relayorb record -- npx ...` could not start the server (`npx` is a `.cmd` file). Commands are now resolved like `cmd.exe` does. This affected 0.3.0 on Windows.",
    "Windows: when several recordings started at the same instant on a new database, one could exit with \"database is locked\". Database setup now retries.",
]

NOT_TESTED = [
    "Agents other than Claude Code: Cursor, Codex, Claude Desktop, VS Code. They use the same stdio protocol, but nobody has run them yet.",
    "Remote MCP servers over HTTP. RelayOrb does not support them yet.",
    "The Intel macOS and Linux ARM binaries. They are built and published but were not run in this suite.",
    "Alpine Linux (musl). The Linux binaries need glibc.",
    "Very long-running sessions (hours) and recordings databases larger than a few hundred MB.",
]


def load(dirpath: str):
    data = {}
    for f in glob.glob(os.path.join(dirpath, "**", "*.json"), recursive=True):
        base = os.path.basename(f)[:-5]
        kind, _, os_key = base.partition("-")
        data[(kind, os_key)] = json.load(open(f))
    return data


def mark(passed: bool, skipped: bool = False) -> str:
    return "skipped" if skipped else ("pass" if passed else "FAIL")


def build(data, run_url: str):
    version = next(iter(data.values()))["relayorb"].replace("relayorb ", "")
    date = max(d["date"] for d in data.values())
    oses = [(k, label) for k, label in OS_ORDER if ("compat", k) in data]

    def summary(kind):
        row = {}
        for k, label in oses:
            d = data.get((kind, k))
            if not d:
                row[label] = "-"
                continue
            rs = d["results"]
            skipped = [r for r in rs if r.get("skipped") or str(r.get("detail", "")).startswith("skipped")]
            passed = [r for r in rs if r.get("passed") and r not in skipped]
            row[label] = f"{len(passed)}/{len(rs) - len(skipped)}" + (f" ({len(skipped)} skipped)" if skipped else "")
        return row

    servers = []
    for name in SERVER_INFO:
        row = {"server": name, "package": SERVER_INFO[name][0], "runtime": SERVER_INFO[name][1], "covers": SERVER_INFO[name][2]}
        for k, label in oses:
            r = next((r for r in data[("compat", k)]["results"] if r["server"] == name), None)
            row[label] = "-" if r is None else mark(r.get("passed", False), bool(r.get("skipped")))
        servers.append(row)

    stress = []
    first = data[("stress", oses[0][0])]["results"]
    for t in first:
        row = {"test": t["test"], "detail": t["detail"]}
        for k, label in oses:
            r = next(r for r in data[("stress", k)]["results"] if r["test"] == t["test"])
            row[label] = mark(r["passed"], str(r["detail"]).startswith("skipped"))
        stress.append(row)

    return {
        "version": version,
        "date": date,
        "run_url": run_url,
        "platforms": [label for _, label in oses],
        "summary": {
            "Real MCP servers (binary)": summary("compat"),
            "Stress tests": summary("stress"),
            "npm package (npx)": summary("npm"),
        },
        "steps": [{"step": s, "meaning": m} for s, m in STEP_INFO],
        "servers": servers,
        "stress": stress,
        "agents": [{"agent": a, "setup": s, "result": r, "date": d} for a, s, r, d in AGENT_TESTS],
        "fixed": FIXED,
        "not_tested": NOT_TESTED,
    }


def markdown(r) -> str:
    p = r["platforms"]
    lines = [
        "# Test results",
        "",
        f"RelayOrb **{r['version']}**, tested {r['date']} on {', '.join(p)}. Full logs: [CI run]({r['run_url']}).",
        "",
        "Everything below comes from the compatibility suite in [`tests/compat/`](tests/compat/), run by the",
        "[Compatibility workflow](.github/workflows/compat.yml) on GitHub's Linux, macOS, and Windows machines.",
        "Run it yourself with `python3 tests/compat/harness.py --relayorb target/release/relayorb`.",
        "",
        "## Summary",
        "",
        "| | " + " | ".join(p) + " |",
        "|---|" + "---|" * len(p),
    ]
    for name, row in r["summary"].items():
        lines.append(f"| {name} | " + " | ".join(row.get(x, "-") for x in p) + " |")
    lines += ["", "## Real MCP servers", "", "Each server goes through every step:", ""]
    lines += [f"- **{s['step']}**: {s['meaning']}" for s in r["steps"]]
    lines += ["", "| Server | Runtime | Exercises | " + " | ".join(p) + " |", "|---|---|---|" + "---|" * len(p)]
    for s in r["servers"]:
        lines.append(f"| `{s['package']}` | {s['runtime']} | {s['covers']} | " + " | ".join(s[x] for x in p) + " |")
    lines += [
        "",
        "`time` and `github` return live data (the clock, star counts), so `check` and `diff` are expected to report",
        "differences there. They pass when relayorb runs cleanly and pinpoints the changed call.",
        "The GitHub server runs in Docker, so it is tested on Linux only.",
        "",
        "## Stress tests",
        "",
        "| Test | What happened | " + " | ".join(p) + " |",
        "|---|---|" + "---|" * len(p),
    ]
    for s in r["stress"]:
        lines.append(f"| {s['test']} | {s['detail']} | " + " | ".join(s[x] for x in p) + " |")
    lines += ["", "SIGTERM and SIGKILL do not exist on Windows, so those two tests are skipped there.", "", "## Real agents (manual)", "", "| Agent | Setup | Result | Date |", "|---|---|---|---|"]
    for a in r["agents"]:
        lines.append(f"| {a['agent']} | {a['setup']} | {a['result']} | {a['date']} |")
    lines += ["", "## Bugs this suite found (fixed in 0.3.1)", ""]
    lines += [f"- {x}" for x in r["fixed"]]
    lines += ["", "## Not tested yet", ""]
    lines += [f"- {x}" for x in r["not_tested"]]
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("results_dir")
    ap.add_argument("--run-url", required=True)
    ap.add_argument("--md", default="TESTING.md")
    ap.add_argument("--json", default="site/src/data/test-results.json")
    args = ap.parse_args()
    report = build(load(args.results_dir), args.run_url)
    with open(args.md, "w") as f:
        f.write(markdown(report))
    os.makedirs(os.path.dirname(args.json), exist_ok=True)
    with open(args.json, "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    print(f"wrote {args.md} and {args.json}")


if __name__ == "__main__":
    main()
