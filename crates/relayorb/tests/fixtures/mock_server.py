"""Minimal stdio MCP server used by relayorb's integration tests.

Set MOCK_VERSION=2 to simulate a regression in the `add` tool.
"""
import json
import os
import sys

VERSION = os.environ.get("MOCK_VERSION", "1")
TOOLS = [
    {"name": "add", "description": "Add two numbers",
     "inputSchema": {"type": "object", "properties": {"a": {"type": "number"}, "b": {"type": "number"}}}},
    {"name": "fail", "description": "Always fails", "inputSchema": {"type": "object"}},
]


def send(msg):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def handle(req):
    method, rid, params = req.get("method"), req.get("id"), req.get("params") or {}
    if rid is None:
        if method == "notifications/initialized":
            send({"jsonrpc": "2.0", "method": "notifications/message",
                  "params": {"level": "info", "data": "mock ready"}})
        return
    if method == "initialize":
        result = {"protocolVersion": params.get("protocolVersion", "2025-06-18"),
                  "capabilities": {"tools": {}},
                  "serverInfo": {"name": "mock", "version": VERSION}}
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call" and params.get("name") == "add":
        args = params.get("arguments", {})
        total = args.get("a", 0) + args.get("b", 0) + (1 if VERSION == "2" else 0)
        result = {"content": [{"type": "text", "text": str(total)}], "isError": False}
    elif method == "tools/call" and params.get("name") == "fail":
        result = {"content": [{"type": "text", "text": "boom"}], "isError": True}
    else:
        send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": "unknown " + str(method)}})
        return
    send({"jsonrpc": "2.0", "id": rid, "result": result})


print("mock server starting", file=sys.stderr)
for line in sys.stdin:
    if line.strip():
        handle(json.loads(line))
