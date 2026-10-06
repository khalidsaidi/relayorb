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

OS_ORDER = [
    ("ubuntu-latest", "Linux x64"),
    ("linux-arm64", "Linux arm64"),
    ("macos-latest", "macOS arm64"),
    ("macos-x64-rosetta", "macOS x64 (Rosetta)"),
    ("windows-latest", "Windows x64"),
]

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
    ("Claude Code 2.1.292 (Linux)", "relayorb binary as the MCP command, filesystem server", "pass", "2026-10-05"),
    ("Claude Code 2.1.292 (Linux)", "`npx -y @khalidsaidi/relayorb@latest` as the MCP command (no install)", "pass", "2026-10-06"),
    ("Claude Code 2.1.292 (Linux)", "two runs, file changed in between, `relayorb diff` pinpoints the changed call", "pass", "2026-10-06"),
    ("Codex CLI 0.160.1 (Linux)", "relayorb as an `mcp_servers` command; Codex listed and read files through it", "pass", "2026-10-06"),
    ("Cursor Agent CLI 2026.09.02 (Linux)", "relayorb in `.cursor/mcp.json`; Cursor listed and read files through it", "pass", "2026-10-06"),
    ("Cursor Agent CLI 2026.09.02 (Windows)", "`npx -y @khalidsaidi/relayorb` in `.cursor/mcp.json` on Windows", "pass", "2026-10-06"),
    ("Claude Desktop 1.44121.2 (Windows)", "`npx -y @khalidsaidi/relayorb` in `claude_desktop_config.json`, everything server: `echo` and `get-sum` recorded with their answers", "pass", "2026-10-06"),
]

# Things the agent tests surfaced that are not RelayOrb's to fix.
FINDINGS = [
    "Claude Desktop 1.44121.2 rejects tools whose `outputSchema` declares JSON Schema draft-07, and the official Node servers "
    "(`server-filesystem`, `server-memory`, part of `server-everything`) currently declare draft-07. Those tools fail in Claude "
    "Desktop with or without RelayOrb: the recorded `tools/list` is byte-identical to the server's own output. "
    "`relayorb show --json` is how this was diagnosed.",
]

FIXED = [
    "`list`/`show`: sessions stopped abruptly (Cursor and Codex force-kill their servers) stayed \"running\" forever. They now show as \"killed\" (0.3.3).",
    "`record`: if relayorb was killed (SIGKILL) right after a call, that call could be missing from the recording. Messages are now stored before they are forwarded.",
    "`check`: tools that ask the agent something mid-call (LLM sampling) failed, because check answered with an error. It now answers the way the agent did in the recording.",
    "Windows: `relayorb record -- npx ...` could not start the server (`npx` is a `.cmd` file). Commands are now resolved like `cmd.exe` does. This affected 0.3.0 on Windows.",
    "Windows: when several recordings started at the same instant on a new database, one could exit with \"database is locked\". Database setup now retries.",
]

NOT_TESTED = [
    "VS Code. It uses the same stdio protocol as the agents above, but has not been run yet.",
    "Remote MCP servers over HTTP. RelayOrb does not support them yet.",
    "Alpine Linux (musl). The Linux binaries need glibc.",
    "Sessions much longer than the nightly one-hour soak test, and recordings databases larger than a few hundred MB.",
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
    version = data[("compat", "ubuntu-latest")]["relayorb"].replace("relayorb ", "")
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

    npm_versions = sorted({d["relayorb"].replace("relayorb ", "") for (kind, _), d in data.items() if kind == "npm"})
    npm_label = f"npm package (npx, {', '.join(npm_versions)})" if npm_versions else "npm package (npx)"
    return {
        "version": version,
        "date": date,
        "run_url": run_url,
        "platforms": [label for _, label in oses],
        "summary": {
            "Real MCP servers (binary)": summary("compat"),
            "Stress tests": summary("stress"),
            npm_label: summary("npm"),
        },
        "steps": [{"step": s, "meaning": m} for s, m in STEP_INFO],
        "servers": servers,
        "stress": stress,
        "agents": [{"agent": a, "setup": s, "result": r, "date": d} for a, s, r, d in AGENT_TESTS],
        "soak": data.get(("soak", "ubuntu-latest")),
        "fixed": FIXED,
        "findings": FINDINGS,
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
    if r.get("soak"):
        k = r["soak"]
        lines += [
            "",
            "## Soak test",
            "",
            f"One recording ({k['relayorb']}) kept busy for {k['minutes']:g} minutes on {k['os']}: {k['calls']:,} calls "
            f"({k['large_responses']:,} with 200 KB responses, {k['notifications']:,} notifications). "
            f"Recorded: {k['recorded_calls']:,} of {k['calls']:,}. Memory: {k['rss_mb_after_warmup']} MB after warm-up, "
            f"{k['rss_mb_end']} MB at the end. Recordings database: {k['db_mb']:,} MB. Result: {'pass' if k['passed'] else 'FAIL'}.",
        ]
    lines += ["", "## Compatibility notes (not RelayOrb bugs)", ""]
    lines += [f"- {x}" for x in r.get("findings", [])]
    lines += ["", "## Bugs this suite found (all fixed)", ""]
    lines += [f"- {x}" for x in r["fixed"]]
    lines += ["", "## Not tested yet", ""]
    lines += [f"- {x}" for x in r["not_tested"]]
    return "\n".join(lines) + "\n"


README_START = "<!-- tested:start -->"
README_END = "<!-- tested:end -->"


def readme_section(r) -> str:
    p = r["platforms"]
    table = ["| | " + " | ".join(p) + " |", "|---|" + "---|" * len(p)]
    for name, row in r["summary"].items():
        table.append(f"| {name} | " + " | ".join(row.get(x, "-") for x in p) + " |")
    agents = sorted({a["agent"].split(" (")[0].rsplit(" ", 1)[0] for a in r["agents"]})
    soak = ""
    if r.get("soak"):
        k = r["soak"]
        soak = f" A one-hour soak test ({k['calls']:,} calls) recorded every call with flat memory ({k['rss_mb_end']} MB)."
    return "\n".join(
        [
            README_START,
            "## Tested",
            "",
            f"RelayOrb {r['version']} is tested against 7 real MCP servers (filesystem, everything, memory, time, git, fetch, "
            "and GitHub's official server) and 10 stress tests: 5 MB payloads, 2,000-call sessions, parallel recordings, "
            f"crashes and kills, batches, unicode, and notification floods. They run on {', '.join(p)}:",
            "",
            *table,
            "",
            f"Tested as the MCP layer of real agents: {', '.join(agents)}.{soak} Full results, including the bugs the tests "
            "found and what isn't tested yet: [TESTING.md](https://github.com/khalidsaidi/relayorb/blob/main/TESTING.md) · "
            "[relayorb.com/testing](https://relayorb.com/testing)",
            README_END,
        ]
    )


def update_readme(path: str, r) -> None:
    text = open(path).read()
    section = readme_section(r)
    if README_START in text:
        start = text.index(README_START)
        end = text.index(README_END) + len(README_END)
        text = text[:start] + section + text[end:]
    else:
        # First run: replace the hand-written "## Tested" section, up to the next heading.
        start = text.index("## Tested")
        end = text.index("\n## ", start + 1) + 1
        text = text[:start] + section + "\n\n" + text[end:]
    with open(path, "w") as f:
        f.write(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("results_dir")
    ap.add_argument("--run-url", required=True)
    ap.add_argument("--md", default="TESTING.md")
    ap.add_argument("--json", default="site/src/data/test-results.json")
    ap.add_argument("--readme", default="README.md")
    args = ap.parse_args()
    report = build(load(args.results_dir), args.run_url)
    with open(args.md, "w") as f:
        f.write(markdown(report))
    os.makedirs(os.path.dirname(args.json), exist_ok=True)
    with open(args.json, "w") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    if args.readme:
        update_readme(args.readme, report)
    print(f"wrote {args.md}, {args.json}, and the Tested section of {args.readme}")


if __name__ == "__main__":
    main()
