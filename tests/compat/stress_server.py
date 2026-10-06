#!/usr/bin/env python3
"""MCP stdio server for RelayOrb stress tests. Tools:
  big(size)      text result of `size` bytes
  echo(text)     returns text (unicode, long lines)
  flood(count)   sends `count` progress notifications, then answers
  garbage()      prints a non-JSON line on stdout, then answers
  crash()        exits immediately with code 3 without answering
Also accepts JSON-RPC batches (arrays).
"""
import json
import sys

TOOLS = [{"name": n, "inputSchema": {"type": "object"}} for n in ("big", "echo", "flood", "garbage", "crash")]


def out(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle(req):
    method, rid, params = req.get("method"), req.get("id"), req.get("params") or {}
    if rid is None:
        return None
    if method == "initialize":
        return {"jsonrpc": "2.0", "id": rid, "result": {
            "protocolVersion": params.get("protocolVersion", "2025-06-18"),
            "capabilities": {"tools": {}}, "serverInfo": {"name": "stress", "version": "1"}}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": rid, "result": {"tools": TOOLS}}
    if method == "tools/call":
        name, args = params.get("name"), params.get("arguments") or {}
        if name == "big":
            text = ("x" * 99 + "\n") * (int(args.get("size", 1000)) // 100)
        elif name == "echo":
            text = args.get("text", "")
        elif name == "flood":
            for i in range(int(args.get("count", 10))):
                out({"jsonrpc": "2.0", "method": "notifications/progress", "params": {"progressToken": "t", "progress": i}})
            text = "flooded"
        elif name == "garbage":
            sys.stdout.write("this is not json-rpc\n")
            sys.stdout.flush()
            text = "after garbage"
        elif name == "crash":
            sys.exit(3)
        else:
            return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32602, "message": "unknown tool"}}
        return {"jsonrpc": "2.0", "id": rid, "result": {"content": [{"type": "text", "text": text}]}}
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": "unknown method"}}


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    msg = json.loads(line)
    if isinstance(msg, list):
        replies = [r for r in (handle(m) for m in msg) if r]
        if replies:
            out(replies)
    else:
        reply = handle(msg)
        if reply:
            out(reply)
